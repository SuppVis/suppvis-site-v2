import json
import os
from datetime import datetime, timezone

import boto3
from botocore.exceptions import ClientError


dynamodb = boto3.resource("dynamodb")


def now_iso():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def table(name):
    return dynamodb.Table(os.environ[name])


def tag_value(tags, name):
    value = tags.get(name)
    if isinstance(value, list):
        return value[0] if value else None
    return value


def event_time(payload):
    mail = payload.get("mail") or {}
    return (
        payload.get("eventTime")
        or payload.get("timestamp")
        or mail.get("timestamp")
        or now_iso()
    )


def safe_delivery_delay_reason(payload):
    delay = payload.get("deliveryDelay") or payload.get("delivery_delay") or {}
    reason = delay.get("delayedRecipients", [{}])[0].get("diagnosticCode")
    if not reason:
        reason = delay.get("delayType") or delay.get("expirationTime")
    return str(reason or "delivery_delayed")[:180]


def safe_bounce_type(payload):
    bounce = payload.get("bounce") or {}
    return str(bounce.get("bounceType") or bounce.get("bounceSubType") or "bounce")[:80]


def safe_complaint_type(payload):
    complaint = payload.get("complaint") or {}
    return str(complaint.get("complaintFeedbackType") or "complaint")[:80]


def update_recipient_once(campaign_id, subscriber_id, expression, names, values, condition=None):
    kwargs = {
        "Key": {"campaign_id": campaign_id, "subscriber_id": subscriber_id},
        "UpdateExpression": expression,
        "ExpressionAttributeNames": names,
        "ExpressionAttributeValues": values,
    }
    if condition:
        kwargs["ConditionExpression"] = condition
    try:
        table("DYNAMODB_EMAIL_CAMPAIGN_RECIPIENTS_TABLE").update_item(**kwargs)
        return True
    except ClientError as error:
        if error.response.get("Error", {}).get("Code") == "ConditionalCheckFailedException":
            return False
        raise


def increment_campaign(campaign_id, field):
    table("DYNAMODB_EMAIL_CAMPAIGNS_TABLE").update_item(
        Key={"id": campaign_id},
        UpdateExpression="ADD #field :one SET updated_at = :now",
        ExpressionAttributeNames={"#field": field},
        ExpressionAttributeValues={":one": 1, ":now": now_iso()},
    )


def suppress_subscriber(subscriber_id, status, timestamp, field_name):
    table("DYNAMODB_EMAIL_SUBSCRIBERS_TABLE").update_item(
        Key={"id": subscriber_id},
        UpdateExpression=(
            "SET #status = :status, #field = :timestamp, updated_at = :timestamp"
        ),
        ExpressionAttributeNames={"#status": "status", "#field": field_name},
        ExpressionAttributeValues={
            ":status": status,
            ":timestamp": timestamp,
        },
    )


def handle_campaign_event(payload):
    event_type = payload.get("eventType") or payload.get("notificationType")
    mail = payload.get("mail") or {}
    message_id = mail.get("messageId")
    tags = mail.get("tags") or {}
    campaign_id = tag_value(tags, "campaign_id")
    subscriber_id = tag_value(tags, "subscriber_id")
    message_type = tag_value(tags, "message_type")
    timestamp = event_time(payload)

    if message_type != "admin_campaign":
        return

    if not campaign_id or not subscriber_id:
        print(
            json.dumps(
                {
                    "level": "info",
                    "event": "campaign_ses_event_skipped",
                    "reason": "missing_tags",
                    "event_type": event_type,
                    "message_id": message_id,
                }
            )
        )
        return

    common_names = {
        "#lastType": "last_ses_event_type",
        "#lastAt": "last_ses_event_at",
        "#lastMessageId": "last_ses_message_id",
    }
    common_values = {
        ":eventType": event_type,
        ":timestamp": timestamp,
        ":messageId": message_id,
    }

    if event_type == "SEND":
        update_recipient_once(
            campaign_id,
            subscriber_id,
            (
                "SET ses_send_at = if_not_exists(ses_send_at, :timestamp), "
                "ses_send_message_id = if_not_exists(ses_send_message_id, :messageId), "
                "#lastType = :eventType, #lastAt = :timestamp, #lastMessageId = :messageId"
            ),
            common_names,
            common_values,
        )
        return

    if event_type == "DELIVERY":
        wrote = update_recipient_once(
            campaign_id,
            subscriber_id,
            (
                "SET #status = :delivered, delivered_at = :timestamp, "
                "ses_delivery_at = :timestamp, ses_delivery_message_id = :messageId, "
                "#lastType = :eventType, #lastAt = :timestamp, #lastMessageId = :messageId"
            ),
            {**common_names, "#status": "status"},
            {**common_values, ":delivered": "delivered"},
            "attribute_not_exists(delivered_at)",
        )
        if wrote:
            increment_campaign(campaign_id, "delivered_count")
        return

    if event_type == "DELIVERY_DELAY":
        wrote = update_recipient_once(
            campaign_id,
            subscriber_id,
            (
                "SET #status = :deliveryDelayed, delivery_delay_at = :timestamp, "
                "ses_delivery_delay_at = :timestamp, ses_delivery_delay_message_id = :messageId, "
                "ses_delivery_delay_reason = :reason, #lastType = :eventType, "
                "#lastAt = :timestamp, #lastMessageId = :messageId"
            ),
            {**common_names, "#status": "status"},
            {
                **common_values,
                ":deliveryDelayed": "delivery_delayed",
                ":reason": safe_delivery_delay_reason(payload),
            },
            "attribute_not_exists(delivery_delay_at)",
        )
        if wrote:
            increment_campaign(campaign_id, "delivery_delay_count")
        return

    if event_type == "BOUNCE":
        wrote = update_recipient_once(
            campaign_id,
            subscriber_id,
            (
                "SET #status = :bounced, bounced_at = :timestamp, bounce_type = :bounceType, "
                "#lastType = :eventType, #lastAt = :timestamp, #lastMessageId = :messageId"
            ),
            {**common_names, "#status": "status"},
            {**common_values, ":bounced": "bounced", ":bounceType": safe_bounce_type(payload)},
            "attribute_not_exists(bounced_at)",
        )
        if wrote:
            increment_campaign(campaign_id, "bounced_count")
        suppress_subscriber(subscriber_id, "bounced", timestamp, "bounced_at")
        return

    if event_type == "COMPLAINT":
        wrote = update_recipient_once(
            campaign_id,
            subscriber_id,
            (
                "SET #status = :complained, complained_at = :timestamp, "
                "complaint_feedback_type = :feedbackType, #lastType = :eventType, "
                "#lastAt = :timestamp, #lastMessageId = :messageId"
            ),
            {**common_names, "#status": "status"},
            {
                **common_values,
                ":complained": "complained",
                ":feedbackType": safe_complaint_type(payload),
            },
            "attribute_not_exists(complained_at)",
        )
        if wrote:
            increment_campaign(campaign_id, "complained_count")
        suppress_subscriber(subscriber_id, "complained", timestamp, "complained_at")
        return

    if event_type == "REJECT":
        wrote = update_recipient_once(
            campaign_id,
            subscriber_id,
            (
                "SET #status = :rejected, rejected_at = :timestamp, "
                "reject_reason = :reason, #lastType = :eventType, "
                "#lastAt = :timestamp, #lastMessageId = :messageId"
            ),
            {**common_names, "#status": "status"},
            {
                **common_values,
                ":rejected": "rejected",
                ":reason": str((payload.get("reject") or {}).get("reason") or "reject")[:120],
            },
            "attribute_not_exists(rejected_at)",
        )
        if wrote:
            increment_campaign(campaign_id, "rejected_count")
        return

    print(
        json.dumps(
            {
                "level": "info",
                "event": "campaign_ses_event_skipped",
                "reason": "unsupported_event_type",
                "event_type": event_type,
                "message_id": message_id,
            }
        )
    )


def lambda_handler(event, context):
    for record in event.get("Records", []):
        try:
            message = json.loads(record.get("Sns", {}).get("Message") or "{}")
            handle_campaign_event(message)
        except Exception as error:
            print(
                json.dumps(
                    {
                        "level": "error",
                        "event": "campaign_ses_event_failed",
                        "error": error.__class__.__name__,
                    }
                )
            )
    return {"ok": True}
