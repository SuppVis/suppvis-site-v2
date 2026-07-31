import base64
import json
import os
import re
from datetime import datetime, timezone
from urllib.parse import urlencode, urlsplit, urlunsplit, parse_qsl
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

import boto3
from botocore.exceptions import ClientError


dynamodb = boto3.resource("dynamodb")


MAX_RETRIES = int(os.environ.get("MAX_SEND_RETRIES", "3"))
PHONE_RE = re.compile(r"^\+\d{8,15}$")
ELIGIBLE_SMS_STATUSES = {"subscribed", "active"}
PERMANENT_ERROR_CODES = {"21211", "21610"}


def now_iso():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def table(name):
    return dynamodb.Table(os.environ[name])


def safe_error_code(error):
    if isinstance(error, ClientError):
        return error.response.get("Error", {}).get("Code", "client_error")[:80]
    if isinstance(error, HTTPError):
        return f"twilio_http_{error.code}"[:80]
    if isinstance(error, URLError):
        return "twilio_url_error"
    return error.__class__.__name__[:80]


def safe_id(value):
    value = str(value or "")
    if len(value) <= 12:
        return value
    return f"{value[:10]}..."


def mask_phone(value):
    digits = re.sub(r"\D", "", str(value or ""))
    if len(digits) < 4:
        return None
    return f"(***) ***-{digits[-4:]}"


def callback_url(campaign_id, subscriber_id):
    configured = os.environ.get("TWILIO_STATUS_CALLBACK_URL", "").strip()
    if not configured:
        return None

    parts = urlsplit(configured)
    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    query.update(
        {
            "message_type": "admin_campaign_sms",
            "campaign": campaign_id,
            "subscriber": subscriber_id,
        }
    )
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


def is_valid_sms_subscriber(subscriber):
    if not subscriber:
        return False, "subscriber_missing"

    status = str(subscriber.get("status") or "")
    if status not in ELIGIBLE_SMS_STATUSES:
        return False, "subscriber_suppressed"

    if subscriber.get("sms_global_opt_out") or subscriber.get("opt_out_timestamp"):
        return False, "sms_opted_out"

    if not subscriber.get("sms_informational_consent"):
        return False, "missing_informational_consent"

    phone = str(subscriber.get("phone_number_e164") or "").strip()
    if not PHONE_RE.match(phone):
        return False, "invalid_phone"

    if str(subscriber.get("last_sms_error_code") or "") in PERMANENT_ERROR_CODES:
        return False, "sms_suppressed"

    return True, phone


def reserve_recipient(campaign_id, subscriber_id):
    recipients = table("DYNAMODB_EMAIL_CAMPAIGN_RECIPIENTS_TABLE")
    now = now_iso()
    try:
        return recipients.update_item(
            Key={"campaign_id": campaign_id, "subscriber_id": subscriber_id},
            UpdateExpression=(
                "SET #status = :sending, send_attempted_at = :now, updated_at = :now, "
                "retry_count = if_not_exists(retry_count, :zero) + :one"
            ),
            ConditionExpression=(
                "#status = :queued AND #channel = :sms AND attribute_not_exists(twilio_message_sid)"
            ),
            ExpressionAttributeNames={"#status": "status", "#channel": "channel"},
            ExpressionAttributeValues={
                ":sending": "sending",
                ":queued": "queued",
                ":sms": "sms",
                ":now": now,
                ":zero": 0,
                ":one": 1,
            },
            ReturnValues="ALL_NEW",
        )["Attributes"]
    except ClientError as error:
        if error.response.get("Error", {}).get("Code") == "ConditionalCheckFailedException":
            print(
                json.dumps(
                    {
                        "level": "info",
                        "event": "sms_recipient_reservation_skipped",
                        "campaign_id": campaign_id,
                        "subscriber": safe_id(subscriber_id),
                    }
                )
            )
            return None
        raise


def update_campaign_counter(campaign_id, field, status=None):
    campaigns = table("DYNAMODB_EMAIL_CAMPAIGNS_TABLE")
    update_expression = "ADD #field :one SET updated_at = :now"
    names = {"#field": field}
    values = {":one": 1, ":now": now_iso()}
    if status:
        update_expression += ", #status = :status"
        names["#status"] = "status"
        values[":status"] = status

    campaigns.update_item(
        Key={"id": campaign_id},
        UpdateExpression=update_expression,
        ExpressionAttributeNames=names,
        ExpressionAttributeValues=values,
    )


def mark_skipped(campaign_id, subscriber_id, reason):
    recipients = table("DYNAMODB_EMAIL_CAMPAIGN_RECIPIENTS_TABLE")
    recipients.update_item(
        Key={"campaign_id": campaign_id, "subscriber_id": subscriber_id},
        UpdateExpression=(
            "SET #status = :skipped, eligibility_decision = :excluded, "
            "skip_reason = :reason, updated_at = :now"
        ),
        ExpressionAttributeNames={"#status": "status"},
        ExpressionAttributeValues={
            ":skipped": "skipped",
            ":excluded": "excluded",
            ":reason": reason,
            ":now": now_iso(),
        },
    )
    update_campaign_counter(campaign_id, "sms_skipped_count")


def complete_campaign_if_done(campaign_id):
    recipients = table("DYNAMODB_EMAIL_CAMPAIGN_RECIPIENTS_TABLE")
    campaigns = table("DYNAMODB_EMAIL_CAMPAIGNS_TABLE")
    items = []
    response = recipients.query(
        KeyConditionExpression="campaign_id = :campaign_id",
        ExpressionAttributeValues={":campaign_id": campaign_id},
        ProjectionExpression="#status",
        ExpressionAttributeNames={"#status": "status"},
    )
    items.extend(response.get("Items", []))
    while "LastEvaluatedKey" in response:
        response = recipients.query(
            KeyConditionExpression="campaign_id = :campaign_id",
            ExpressionAttributeValues={":campaign_id": campaign_id},
            ProjectionExpression="#status",
            ExpressionAttributeNames={"#status": "status"},
            ExclusiveStartKey=response["LastEvaluatedKey"],
        )
        items.extend(response.get("Items", []))

    if not items:
        return

    terminal = {
        "sent",
        "delivered",
        "bounced",
        "complained",
        "rejected",
        "skipped",
        "failed",
    }
    if any(item.get("status") not in terminal for item in items):
        return

    has_failures = any(
        item.get("status") in {"bounced", "complained", "rejected", "failed"}
        for item in items
    )

    try:
        campaigns.update_item(
            Key={"id": campaign_id},
            UpdateExpression=(
                "SET #status = :status, completed_at = if_not_exists(completed_at, :now), "
                "updated_at = :now"
            ),
            ConditionExpression="#status <> :completed AND #status <> :completed_with_failures",
            ExpressionAttributeNames={"#status": "status"},
            ExpressionAttributeValues={
                ":status": "completed_with_failures" if has_failures else "completed",
                ":completed": "completed",
                ":completed_with_failures": "completed_with_failures",
                ":now": now_iso(),
            },
        )
    except ClientError as error:
        if error.response.get("Error", {}).get("Code") != "ConditionalCheckFailedException":
            raise


def send_twilio_sms(to, body, status_callback):
    account_sid = os.environ["TWILIO_ACCOUNT_SID"].strip()
    auth_token = os.environ["TWILIO_AUTH_TOKEN"].strip()
    messaging_service_sid = os.environ["TWILIO_MESSAGING_SERVICE_SID"].strip()
    from_number = os.environ.get("TWILIO_SMS_FROM_NUMBER", "+16507025913").strip()

    form = {
        "To": to,
        "Body": body,
        "MessagingServiceSid": messaging_service_sid,
        "From": from_number,
    }
    if status_callback:
        form["StatusCallback"] = status_callback

    encoded = urlencode(form).encode("utf-8")
    credentials = f"{account_sid}:{auth_token}".encode("utf-8")
    request = Request(
        f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json",
        data=encoded,
        headers={
            "Authorization": f"Basic {base64.b64encode(credentials).decode('ascii')}",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        method="POST",
    )

    with urlopen(request, timeout=12) as response:
        payload = json.loads(response.read().decode("utf-8"))

    if not payload.get("sid"):
        raise RuntimeError("twilio_missing_message_sid")

    return payload


def mark_send_failure(campaign_id, subscriber_id, reservation, code):
    recipients = table("DYNAMODB_EMAIL_CAMPAIGN_RECIPIENTS_TABLE")
    retry_count = int(reservation.get("retry_count", 1))
    if retry_count < MAX_RETRIES:
        recipients.update_item(
            Key={"campaign_id": campaign_id, "subscriber_id": subscriber_id},
            UpdateExpression="SET #status = :queued, safe_failure_code = :code, updated_at = :now",
            ExpressionAttributeNames={"#status": "status"},
            ExpressionAttributeValues={
                ":queued": "queued",
                ":code": code,
                ":now": now_iso(),
            },
        )
        raise RuntimeError(code)

    recipients.update_item(
        Key={"campaign_id": campaign_id, "subscriber_id": subscriber_id},
        UpdateExpression=(
            "SET #status = :failed, failed_at = :now, safe_failure_code = :code, "
            "updated_at = :now"
        ),
        ExpressionAttributeNames={"#status": "status"},
        ExpressionAttributeValues={
            ":failed": "failed",
            ":now": now_iso(),
            ":code": code,
        },
    )
    update_campaign_counter(campaign_id, "sms_failed_count", "completed_with_failures")
    complete_campaign_if_done(campaign_id)


def process_job(campaign_id, subscriber_id):
    campaigns = table("DYNAMODB_EMAIL_CAMPAIGNS_TABLE")
    subscribers = table("DYNAMODB_SMS_SUBSCRIBERS_TABLE")
    recipients = table("DYNAMODB_EMAIL_CAMPAIGN_RECIPIENTS_TABLE")

    campaign = campaigns.get_item(Key={"id": campaign_id}).get("Item")
    if not campaign or campaign.get("status") not in {"queued", "sending"}:
        print(
            json.dumps(
                {
                    "level": "info",
                    "event": "sms_campaign_not_sendable",
                    "campaign_id": campaign_id,
                    "status": campaign.get("status") if campaign else "missing",
                }
            )
        )
        return

    reservation = reserve_recipient(campaign_id, subscriber_id)
    if not reservation:
        return

    subscriber = subscribers.get_item(Key={"id": subscriber_id}).get("Item")
    valid, value = is_valid_sms_subscriber(subscriber)
    if not valid:
        mark_skipped(campaign_id, subscriber_id, value)
        complete_campaign_if_done(campaign_id)
        return

    message_body = str(campaign.get("sms_rendered_body") or "").strip()
    if not message_body:
        mark_skipped(campaign_id, subscriber_id, "missing_sms_body")
        complete_campaign_if_done(campaign_id)
        return

    try:
        output = send_twilio_sms(
            to=value,
            body=message_body,
            status_callback=callback_url(campaign_id, subscriber_id),
        )
    except Exception as error:
        mark_send_failure(campaign_id, subscriber_id, reservation, safe_error_code(error))
        return

    message_sid = output.get("sid")
    provider_status = str(output.get("status") or "accepted").lower()
    sender_masked = mask_phone(output.get("from") or os.environ.get("TWILIO_SMS_FROM_NUMBER"))
    now = now_iso()
    recipients.update_item(
        Key={"campaign_id": campaign_id, "subscriber_id": subscriber_id},
        UpdateExpression=(
            "SET #status = :sent, accepted_at = :now, sent_at = :now, "
            "twilio_message_sid = :message_sid, twilio_provider_status = :provider_status, "
            "twilio_sender_masked = :sender_masked, updated_at = :now"
        ),
        ExpressionAttributeNames={"#status": "status"},
        ExpressionAttributeValues={
            ":sent": "sent",
            ":now": now,
            ":message_sid": message_sid,
            ":provider_status": provider_status,
            ":sender_masked": sender_masked,
        },
    )
    campaigns.update_item(
        Key={"id": campaign_id},
        UpdateExpression=(
            "ADD sms_sent_count :one SET #status = :sending, sent_at = if_not_exists(sent_at, :now), "
            "updated_at = :now"
        ),
        ExpressionAttributeNames={"#status": "status"},
        ExpressionAttributeValues={
            ":one": 1,
            ":sending": "sending",
            ":now": now,
        },
    )
    print(
        json.dumps(
            {
                "level": "info",
                "event": "campaign_sms_accepted",
                "campaign_id": campaign_id,
                "subscriber": safe_id(subscriber_id),
                "message_sid": message_sid,
                "provider_status": provider_status,
                "sender": sender_masked,
            }
        )
    )
    complete_campaign_if_done(campaign_id)


def lambda_handler(event, context):
    failures = []
    for record in event.get("Records", []):
        message_id = record.get("messageId")
        try:
            body = json.loads(record.get("body") or "{}")
            campaign_id = body.get("campaignId")
            subscriber_id = body.get("subscriberId")
            if not campaign_id or not subscriber_id:
                print(json.dumps({"level": "info", "event": "malformed_sms_sqs_message"}))
                continue
            process_job(campaign_id, subscriber_id)
        except Exception as error:
            print(
                json.dumps(
                    {
                        "level": "error",
                        "event": "campaign_sms_job_failed",
                        "message_id": message_id,
                        "error": safe_error_code(error),
                    }
                )
            )
            if message_id:
                failures.append({"itemIdentifier": message_id})

    return {"batchItemFailures": failures}
