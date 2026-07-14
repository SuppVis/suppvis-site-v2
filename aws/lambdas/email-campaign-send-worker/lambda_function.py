import html
import json
import os
import re
from datetime import datetime, timezone
from urllib.parse import urlencode

import boto3
from botocore.exceptions import ClientError


dynamodb = boto3.resource("dynamodb")
ses = boto3.client("sesv2")


MAX_RETRIES = int(os.environ.get("MAX_SEND_RETRIES", "3"))
EMAIL_RE = re.compile(
    r"^[^\s@]{1,64}@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$"
)


def now_iso():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def table(name):
    return dynamodb.Table(os.environ[name])


def safe_tag(value):
    return re.sub(r"[^A-Za-z0-9_-]", "_", str(value or ""))[:256]


def safe_error_code(error):
    if isinstance(error, ClientError):
        return error.response.get("Error", {}).get("Code", "client_error")[:80]
    return error.__class__.__name__[:80]


def format_from_address():
    email = os.environ["SES_FROM_EMAIL"].strip()
    display = os.environ.get("SES_FROM_NAME", "SuppVis Beta Testers").strip()
    display = re.sub(r"[\"\\\r\n]", "", display)
    return f"{display} <{email}>" if display else email


def is_valid_subscriber(subscriber):
    if not subscriber:
        return False, "subscriber_missing"
    if subscriber.get("status") != "subscribed":
        return False, "subscriber_suppressed"
    normalized_email = str(subscriber.get("normalized_email") or "").strip().lower()
    if not normalized_email:
        return False, "missing_email"
    if len(normalized_email) > 254 or not EMAIL_RE.match(normalized_email):
        return False, "invalid_email"
    if not str(subscriber.get("unsubscribe_token") or "").strip():
        return False, "missing_unsubscribe_token"
    if not subscriber.get("consent_timestamp") or not subscriber.get("consent_source"):
        return False, "missing_consent"
    return True, normalized_email


def unsubscribe_url(subscriber):
    base_url = os.environ["APP_BASE_URL"].rstrip("/")
    query = urlencode(
        {
            "subscriber": subscriber["id"],
            "token": subscriber["unsubscribe_token"],
        }
    )
    return f"{base_url}/unsubscribe?{query}"


def paragraphs(body):
    return [part.strip() for part in re.split(r"\n{2,}", str(body or "").strip()) if part.strip()]


def paragraph_html(copy):
    escaped = "<br />".join(html.escape(line) for line in copy.splitlines())
    return (
        '<p style="margin:0 0 18px 0;color:#9BAFBF;font-size:16px;'
        f'line-height:1.65;">{escaped}</p>'
    )


def render_email(campaign, subscriber):
    subject = str(campaign["subject"])
    heading = str(campaign["heading"])
    body = str(campaign["body"])
    cta_label = str(campaign.get("cta_label") or "").strip()
    cta_url = str(campaign.get("cta_url") or "").strip()
    app_base_url = os.environ["APP_BASE_URL"].rstrip("/")
    brand_icon_url = html.escape(f"{app_base_url}/favicon.svg")
    unsub_url = unsubscribe_url(subscriber)
    body_html = "\n".join(paragraph_html(part) for part in paragraphs(body))

    if cta_label and cta_url:
        body_html += (
            '<p style="margin:0 0 18px 0;text-align:center;">'
            f'<a href="{html.escape(cta_url)}" style="display:inline-block;'
            "border-radius:999px;background:#14B8A6;color:#0A0F14;"
            "text-decoration:none;font-size:16px;font-weight:800;padding:14px 24px;"
            f'">{html.escape(cta_label)}</a></p>'
        )
        body_html += (
            '<p style="margin:0 0 22px 0;color:#9BAFBF;font-size:13px;'
            "line-height:1.55;word-break:break-all;text-align:center;"
            f'">{html.escape(cta_url)}</p>'
        )

    text_parts = [
        heading,
        "",
        body.strip(),
        "",
        f"{cta_label}: {cta_url}" if cta_label and cta_url else "",
        "",
        "You are receiving this because you joined the SuppVis beta.",
        f"Unsubscribe: {unsub_url}",
    ]
    text = "\n".join(part for part in text_parts if part is not None)

    html_body = f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{html.escape(subject)}</title>
  </head>
  <body style="margin:0;background:#0A0F14;color:#F0F4F8;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0A0F14;margin:0;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;border-collapse:collapse;">
            <tr>
              <td style="padding:0 0 18px 0;text-align:left;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                  <tr>
                    <td style="text-align:left;vertical-align:middle;">
                      <div style="font-size:24px;line-height:1;font-weight:800;letter-spacing:0;color:#F0F4F8;">SuppVis</div>
                      <div style="padding-top:7px;color:#14B8A6;font-size:11px;line-height:1;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;">Beta update</div>
                    </td>
                    <td align="right" style="vertical-align:middle;">
                      <div style="display:inline-block;width:42px;height:42px;border:1px solid rgba(20,184,166,0.42);border-radius:14px;background:rgba(20,184,166,0.10);overflow:hidden;">
                        <img src="{brand_icon_url}" width="42" height="42" alt="SuppVis" style="display:block;width:42px;height:42px;border:0;outline:none;text-decoration:none;" />
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="background:#0D1117;border:1px solid rgba(20,184,166,0.22);border-radius:18px;padding:34px 28px;box-shadow:0 18px 50px rgba(0,0,0,0.28);">
                <p style="margin:0 0 14px 0;color:#14B8A6;font-size:12px;line-height:1;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;">Beta update</p>
                <h1 style="margin:0 0 22px 0;color:#F0F4F8;font-size:28px;line-height:1.15;font-weight:800;">{html.escape(heading)}</h1>
                {body_html}
              </td>
            </tr>
            <tr>
              <td style="padding:18px 8px 0 8px;text-align:center;color:#5A7089;font-size:12px;line-height:1.6;">
                You are receiving this because you joined the SuppVis beta.
                <br />
                <a href="{html.escape(unsub_url)}" style="color:#14B8A6;text-decoration:underline;">Unsubscribe</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>"""

    return subject, html_body, text


def update_campaign_counter(campaign_id, field):
    campaigns = table("DYNAMODB_EMAIL_CAMPAIGNS_TABLE")
    campaigns.update_item(
        Key={"id": campaign_id},
        UpdateExpression="ADD #field :one SET updated_at = :now",
        ExpressionAttributeNames={"#field": field},
        ExpressionAttributeValues={":one": 1, ":now": now_iso()},
    )


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
    processed = [item for item in items if item.get("status") in terminal]
    if len(processed) != len(items):
        return

    has_failures = any(
        item.get("status") in {"bounced", "complained", "rejected", "failed"}
        for item in items
    )
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
            ConditionExpression="#status = :queued AND attribute_not_exists(ses_message_id)",
            ExpressionAttributeNames={"#status": "status"},
            ExpressionAttributeValues={
                ":sending": "sending",
                ":queued": "queued",
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
                        "event": "recipient_reservation_skipped",
                        "campaign_id": campaign_id,
                        "subscriber_id": subscriber_id,
                    }
                )
            )
            return None
        raise


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
    update_campaign_counter(campaign_id, "skipped_count")


def process_job(campaign_id, subscriber_id):
    campaigns = table("DYNAMODB_EMAIL_CAMPAIGNS_TABLE")
    subscribers = table("DYNAMODB_EMAIL_SUBSCRIBERS_TABLE")
    recipients = table("DYNAMODB_EMAIL_CAMPAIGN_RECIPIENTS_TABLE")

    campaign = campaigns.get_item(Key={"id": campaign_id}).get("Item")
    if not campaign or campaign.get("status") not in {"queued", "sending"}:
        print(
            json.dumps(
                {
                    "level": "info",
                    "event": "campaign_not_sendable",
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
    valid, value = is_valid_subscriber(subscriber)
    if not valid:
        mark_skipped(campaign_id, subscriber_id, value)
        complete_campaign_if_done(campaign_id)
        return

    recipient_email = value
    subject, html_body, text_body = render_email(campaign, subscriber)

    try:
        output = ses.send_email(
            FromEmailAddress=format_from_address(),
            ReplyToAddresses=[os.environ["SES_FROM_EMAIL"].strip()],
            Destination={"ToAddresses": [recipient_email]},
            ConfigurationSetName=os.environ["SES_CONFIGURATION_SET"],
            EmailTags=[
                {"Name": "campaign_id", "Value": safe_tag(campaign_id)},
                {"Name": "subscriber_id", "Value": safe_tag(subscriber_id)},
                {"Name": "message_type", "Value": "admin_campaign"},
                {
                    "Name": "campaign_message_type",
                    "Value": safe_tag(campaign.get("message_type", "beta_update")),
                },
            ],
            Content={
                "Simple": {
                    "Subject": {"Charset": "UTF-8", "Data": subject},
                    "Body": {
                        "Html": {"Charset": "UTF-8", "Data": html_body},
                        "Text": {"Charset": "UTF-8", "Data": text_body},
                    },
                }
            },
        )
    except Exception as error:
        retry_count = int(reservation.get("retry_count", 1))
        code = safe_error_code(error)
        if retry_count < MAX_RETRIES:
            recipients.update_item(
                Key={"campaign_id": campaign_id, "subscriber_id": subscriber_id},
                UpdateExpression=(
                    "SET #status = :queued, safe_failure_code = :code, "
                    "updated_at = :now"
                ),
                ExpressionAttributeNames={"#status": "status"},
                ExpressionAttributeValues={
                    ":queued": "queued",
                    ":code": code,
                    ":now": now_iso(),
                },
            )
            raise

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
        update_campaign_counter(campaign_id, "failed_count")
        complete_campaign_if_done(campaign_id)
        return

    message_id = output.get("MessageId")
    recipients.update_item(
        Key={"campaign_id": campaign_id, "subscriber_id": subscriber_id},
        UpdateExpression=(
            "SET #status = :sent, sent_at = :now, ses_message_id = :message_id, "
            "updated_at = :now"
        ),
        ExpressionAttributeNames={"#status": "status"},
        ExpressionAttributeValues={
            ":sent": "sent",
            ":now": now_iso(),
            ":message_id": message_id,
        },
    )
    campaigns.update_item(
        Key={"id": campaign_id},
        UpdateExpression=(
            "ADD sent_count :one SET #status = :sending, sent_at = :now, "
            "updated_at = :now"
        ),
        ExpressionAttributeNames={"#status": "status"},
        ExpressionAttributeValues={
            ":one": 1,
            ":sending": "sending",
            ":now": now_iso(),
        },
    )
    print(
        json.dumps(
            {
                "level": "info",
                "event": "campaign_email_sent",
                "campaign_id": campaign_id,
                "subscriber_id": subscriber_id,
                "message_id": message_id,
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
                print(json.dumps({"level": "info", "event": "malformed_sqs_message"}))
                continue
            process_job(campaign_id, subscriber_id)
        except Exception as error:
            print(
                json.dumps(
                    {
                        "level": "error",
                        "event": "campaign_job_failed",
                        "message_id": message_id,
                        "error": safe_error_code(error),
                    }
                )
            )
            if message_id:
                failures.append({"itemIdentifier": message_id})

    return {"batchItemFailures": failures}
