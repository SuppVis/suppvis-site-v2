#!/usr/bin/env python3
import os
import json
from collections import Counter

import boto3


REGION = os.environ.get("AWS_REGION", "us-east-1")
CAMPAIGN_ID = os.environ.get("CAMPAIGN_ID", "").strip()
APPLY = os.environ.get("APPLY_REQUEUE_STUCK_CAMPAIGN_RECIPIENTS") == "yes"
ALLOW_NONEMPTY_QUEUES = os.environ.get("ALLOW_NONEMPTY_CAMPAIGN_QUEUES") == "yes"

CAMPAIGN_TABLE = os.environ.get(
    "DYNAMODB_EMAIL_CAMPAIGNS_TABLE",
    "suppvis-prod-email-campaigns",
)
RECIPIENTS_TABLE = os.environ.get(
    "DYNAMODB_EMAIL_CAMPAIGN_RECIPIENTS_TABLE",
    "suppvis-prod-email-campaign-recipients",
)
EMAIL_QUEUE_NAME = os.environ.get(
    "EMAIL_CAMPAIGN_QUEUE_NAME",
    "suppvis-email-campaign-send-queue",
)
SMS_QUEUE_NAME = os.environ.get(
    "SMS_ANNOUNCEMENT_QUEUE_NAME",
    "suppvis-sms-announcement-send-queue",
)

if not CAMPAIGN_ID.startswith("email_campaign_"):
    raise SystemExit("Set CAMPAIGN_ID=email_campaign_... before running.")

ddb = boto3.resource("dynamodb", region_name=REGION)
sqs = boto3.client("sqs", region_name=REGION)


def queue_url(queue_name):
    return sqs.get_queue_url(QueueName=queue_name)["QueueUrl"]


def queue_counts(url):
    attrs = sqs.get_queue_attributes(
        QueueUrl=url,
        AttributeNames=[
            "ApproximateNumberOfMessages",
            "ApproximateNumberOfMessagesNotVisible",
            "ApproximateNumberOfMessagesDelayed",
        ],
    )["Attributes"]
    return {key: int(value) for key, value in attrs.items()}


def query_recipients():
    table = ddb.Table(RECIPIENTS_TABLE)
    rows = []
    kwargs = {
        "KeyConditionExpression": "campaign_id = :campaign_id",
        "ExpressionAttributeValues": {":campaign_id": CAMPAIGN_ID},
    }

    while True:
        page = table.query(**kwargs)
        rows.extend(page.get("Items", []))
        if "LastEvaluatedKey" not in page:
            return rows
        kwargs["ExclusiveStartKey"] = page["LastEvaluatedKey"]


def is_stuck_email(row):
    return (
        row.get("channel", "email") == "email"
        and row.get("status") == "queued"
        and not row.get("ses_message_id")
        and row.get("eligibility_decision") == "eligible"
    )


def is_stuck_sms(row):
    return (
        row.get("channel") == "sms"
        and row.get("status") == "queued"
        and not row.get("twilio_message_sid")
        and row.get("eligibility_decision") == "eligible"
    )


def send_job(url, row, channel):
    subscriber_id = row["subscriber_id"]
    attributes = {
        "campaign_id": {"DataType": "String", "StringValue": CAMPAIGN_ID},
        "subscriber_id": {"DataType": "String", "StringValue": subscriber_id},
    }
    if channel == "sms":
        attributes["channel"] = {"DataType": "String", "StringValue": "sms"}

    sqs.send_message(
        QueueUrl=url,
        MessageBody=json.dumps(
            {"campaignId": CAMPAIGN_ID, "subscriberId": subscriber_id},
            separators=(",", ":"),
        ),
        MessageAttributes=attributes,
    )


email_queue_url = queue_url(EMAIL_QUEUE_NAME)
sms_queue_url = queue_url(SMS_QUEUE_NAME)
email_queue_counts = queue_counts(email_queue_url)
sms_queue_counts = queue_counts(sms_queue_url)
rows = query_recipients()
stuck_email = [row for row in rows if is_stuck_email(row)]
stuck_sms = [row for row in rows if is_stuck_sms(row)]

print(f"Region: {REGION}")
print(f"Campaign: {CAMPAIGN_ID}")
print(f"Mode: {'APPLY' if APPLY else 'DRY RUN'}")
print(f"Recipient rows: {len(rows)}")
print("Recipient statuses:", dict(Counter(row.get("status", "missing") for row in rows)))
print(f"Stuck queued email recipients: {len(stuck_email)}")
print(f"Stuck queued SMS recipients: {len(stuck_sms)}")
print(f"Email queue counts: {email_queue_counts}")
print(f"SMS queue counts: {sms_queue_counts}")

if not APPLY:
    print()
    print("Dry run complete. No queue messages were created.")
    print("To requeue these stuck recipients after approval, run:")
    print(
        "APPLY_REQUEUE_STUCK_CAMPAIGN_RECIPIENTS=yes "
        f"CAMPAIGN_ID={CAMPAIGN_ID} "
        "python3 aws/scripts/requeue-stuck-campaign-recipients.py"
    )
    raise SystemExit(0)

if not ALLOW_NONEMPTY_QUEUES:
    for name, counts in ((EMAIL_QUEUE_NAME, email_queue_counts), (SMS_QUEUE_NAME, sms_queue_counts)):
        if any(counts.values()):
            raise SystemExit(
                f"Refusing to requeue because {name} is not empty. "
                "Set ALLOW_NONEMPTY_CAMPAIGN_QUEUES=yes only after confirming duplicates are impossible."
            )

for row in stuck_email:
    send_job(email_queue_url, row, "email")

for row in stuck_sms:
    send_job(sms_queue_url, row, "sms")

print()
print(
    "Requeue complete. Worker delivery will continue asynchronously. "
    "No recipient identities were printed."
)
