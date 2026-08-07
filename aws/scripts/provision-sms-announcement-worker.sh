#!/usr/bin/env bash
set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
QUEUE_NAME="${SMS_ANNOUNCEMENT_QUEUE_NAME:-suppvis-sms-announcement-send-queue}"
DLQ_NAME="${SMS_ANNOUNCEMENT_DLQ_NAME:-suppvis-sms-announcement-send-dlq}"
FUNCTION_NAME="${SMS_ANNOUNCEMENT_WORKER_NAME:-suppvis-sms-announcement-send-worker}"
ROLE_NAME="${SMS_ANNOUNCEMENT_WORKER_ROLE_NAME:-suppvis-sms-announcement-send-worker-role}"
POLICY_NAME="${SMS_ANNOUNCEMENT_WORKER_POLICY_NAME:-SuppVisSmsAnnouncementSendWorker}"
APP_USER="${SUPPVIS_VERCEL_APP_USER:-suppvis-site-v2-vercel-app}"
APP_POLICY_NAME="${SUPPVIS_VERCEL_SMS_QUEUE_POLICY_NAME:-SuppVisSmsAnnouncementQueueSend}"

EMAIL_CAMPAIGNS_TABLE="${DYNAMODB_EMAIL_CAMPAIGNS_TABLE:-suppvis-prod-email-campaigns}"
RECIPIENTS_TABLE="${DYNAMODB_EMAIL_CAMPAIGN_RECIPIENTS_TABLE:-suppvis-prod-email-campaign-recipients}"
SMS_SUBSCRIBERS_TABLE="${DYNAMODB_SMS_SUBSCRIBERS_TABLE:-suppvis-prod-sms-subscribers}"
STATUS_CALLBACK_URL="${TWILIO_STATUS_CALLBACK_URL:-https://www.suppvis.health/api/webhooks/twilio/status}"
SMS_FROM_NUMBER="${TWILIO_SMS_FROM_NUMBER:-+16507025913}"
MESSAGING_SERVICE_SID="${TWILIO_MESSAGING_SERVICE_SID:-MGa88964d7c8a19058525ba21ca648715e}"
RAW_LAMBDA_URL="${SMS_WORKER_RAW_URL:-https://raw.githubusercontent.com/SuppVis/suppvis-site-v2/main/aws/lambdas/sms-announcement-send-worker/lambda_function.py}"
TMP_FILES=()

cleanup() {
  for file in "${TMP_FILES[@]}"; do
    [[ -n "${file}" && -f "${file}" ]] && rm -f "${file}"
  done
}

trap cleanup EXIT

require_secret() {
  local name="$1"
  local prompt="$2"
  if [[ -z "${!name:-}" ]]; then
    read -rsp "${prompt}: " "${name}"
    echo
    export "${name}"
  fi
}

require_value() {
  local name="$1"
  local prompt="$2"
  if [[ -z "${!name:-}" ]]; then
    read -rp "${prompt}: " "${name}"
    export "${name}"
  fi
}

require_value "TWILIO_ACCOUNT_SID" "Twilio Account SID"
require_secret "TWILIO_AUTH_TOKEN" "Twilio Auth Token"

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"

echo "AWS account: ${ACCOUNT_ID}"
echo "Region: ${REGION}"
echo "Creating or updating SMS announcement queue resources..."

DLQ_ATTRS="$(mktemp)"
TMP_FILES+=("${DLQ_ATTRS}")
cat >"${DLQ_ATTRS}" <<'JSON'
{
  "MessageRetentionPeriod": "1209600",
  "SqsManagedSseEnabled": "true"
}
JSON

DLQ_URL="$(aws sqs create-queue \
  --region "${REGION}" \
  --queue-name "${DLQ_NAME}" \
  --attributes "file://${DLQ_ATTRS}" \
  --query QueueUrl \
  --output text)"
DLQ_ARN="$(aws sqs get-queue-attributes \
  --region "${REGION}" \
  --queue-url "${DLQ_URL}" \
  --attribute-names QueueArn \
  --query 'Attributes.QueueArn' \
  --output text)"

REDRIVE_POLICY="$(printf '{"deadLetterTargetArn":"%s","maxReceiveCount":"3"}' "${DLQ_ARN}")"
QUEUE_ATTRS="$(mktemp)"
TMP_FILES+=("${QUEUE_ATTRS}")
cat >"${QUEUE_ATTRS}" <<JSON
{
  "MessageRetentionPeriod": "1209600",
  "VisibilityTimeout": "120",
  "SqsManagedSseEnabled": "true",
  "RedrivePolicy": "${REDRIVE_POLICY//\"/\\\"}"
}
JSON
QUEUE_URL="$(aws sqs create-queue \
  --region "${REGION}" \
  --queue-name "${QUEUE_NAME}" \
  --attributes "file://${QUEUE_ATTRS}" \
  --query QueueUrl \
  --output text)"
QUEUE_ARN="$(aws sqs get-queue-attributes \
  --region "${REGION}" \
  --queue-url "${QUEUE_URL}" \
  --attribute-names QueueArn \
  --query 'Attributes.QueueArn' \
  --output text)"

TRUST_POLICY="$(mktemp)"
TMP_FILES+=("${TRUST_POLICY}")
cat >"${TRUST_POLICY}" <<'JSON'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
JSON

if ! aws iam get-role --role-name "${ROLE_NAME}" >/dev/null 2>&1; then
  aws iam create-role \
    --role-name "${ROLE_NAME}" \
    --assume-role-policy-document "file://${TRUST_POLICY}" >/dev/null
fi

ROLE_ARN="$(aws iam get-role --role-name "${ROLE_NAME}" --query 'Role.Arn' --output text)"

POLICY_DOC="$(mktemp)"
TMP_FILES+=("${POLICY_DOC}")
cat >"${POLICY_DOC}" <<JSON
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "WriteWorkerLogs",
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": [
        "arn:aws:logs:${REGION}:${ACCOUNT_ID}:log-group:/aws/lambda/${FUNCTION_NAME}",
        "arn:aws:logs:${REGION}:${ACCOUNT_ID}:log-group:/aws/lambda/${FUNCTION_NAME}:*"
      ]
    },
    {
      "Sid": "ConsumeSmsAnnouncementQueue",
      "Effect": "Allow",
      "Action": [
        "sqs:ReceiveMessage",
        "sqs:DeleteMessage",
        "sqs:GetQueueAttributes",
        "sqs:ChangeMessageVisibility"
      ],
      "Resource": "${QUEUE_ARN}"
    },
    {
      "Sid": "ReadCampaignAndSmsSubscriberRecords",
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem"
      ],
      "Resource": [
        "arn:aws:dynamodb:${REGION}:${ACCOUNT_ID}:table/${EMAIL_CAMPAIGNS_TABLE}",
        "arn:aws:dynamodb:${REGION}:${ACCOUNT_ID}:table/${SMS_SUBSCRIBERS_TABLE}"
      ]
    },
    {
      "Sid": "ReadAndUpdateCampaignRecipientRecords",
      "Effect": "Allow",
      "Action": [
        "dynamodb:Query",
        "dynamodb:UpdateItem"
      ],
      "Resource": [
        "arn:aws:dynamodb:${REGION}:${ACCOUNT_ID}:table/${RECIPIENTS_TABLE}",
        "arn:aws:dynamodb:${REGION}:${ACCOUNT_ID}:table/${EMAIL_CAMPAIGNS_TABLE}"
      ]
    }
  ]
}
JSON

aws iam put-role-policy \
  --role-name "${ROLE_NAME}" \
  --policy-name "${POLICY_NAME}" \
  --policy-document "file://${POLICY_DOC}"

APP_POLICY_DOC="$(mktemp)"
TMP_FILES+=("${APP_POLICY_DOC}")
cat >"${APP_POLICY_DOC}" <<JSON
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "SendSmsAnnouncementJobs",
      "Effect": "Allow",
      "Action": [
        "sqs:SendMessage"
      ],
      "Resource": "${QUEUE_ARN}"
    },
    {
      "Sid": "ManageSmsAnnouncementCampaignQueueState",
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:UpdateItem"
      ],
      "Resource": "arn:aws:dynamodb:${REGION}:${ACCOUNT_ID}:table/${EMAIL_CAMPAIGNS_TABLE}"
    },
    {
      "Sid": "ManageSmsAnnouncementRecipients",
      "Effect": "Allow",
      "Action": [
        "dynamodb:Query",
        "dynamodb:UpdateItem"
      ],
      "Resource": "arn:aws:dynamodb:${REGION}:${ACCOUNT_ID}:table/${RECIPIENTS_TABLE}"
    }
  ]
}
JSON

APP_POLICY_ARN="arn:aws:iam::${ACCOUNT_ID}:policy/${APP_POLICY_NAME}"

if aws iam get-policy --policy-arn "${APP_POLICY_ARN}" >/dev/null 2>&1; then
  VERSION_COUNT="$(aws iam list-policy-versions \
    --policy-arn "${APP_POLICY_ARN}" \
    --query 'length(Versions)' \
    --output text)"

  if [[ "${VERSION_COUNT}" -ge 5 ]]; then
    OLD_VERSION="$(aws iam list-policy-versions \
      --policy-arn "${APP_POLICY_ARN}" \
      --query 'Versions[?IsDefaultVersion==`false`] | sort_by(@, &CreateDate)[0].VersionId' \
      --output text)"
    if [[ "${OLD_VERSION}" != "None" && -n "${OLD_VERSION}" ]]; then
      aws iam delete-policy-version \
        --policy-arn "${APP_POLICY_ARN}" \
        --version-id "${OLD_VERSION}"
    fi
  fi

  aws iam create-policy-version \
    --policy-arn "${APP_POLICY_ARN}" \
    --policy-document "file://${APP_POLICY_DOC}" \
    --set-as-default >/dev/null
else
  aws iam create-policy \
    --policy-name "${APP_POLICY_NAME}" \
    --policy-document "file://${APP_POLICY_DOC}" >/dev/null
fi

aws iam attach-user-policy \
  --user-name "${APP_USER}" \
  --policy-arn "${APP_POLICY_ARN}"

sleep 10

WORK_DIR="$(mktemp -d)"
LAMBDA_SOURCE="${WORK_DIR}/lambda_function.py"
if [[ -f "aws/lambdas/sms-announcement-send-worker/lambda_function.py" ]]; then
  cp "aws/lambdas/sms-announcement-send-worker/lambda_function.py" "${LAMBDA_SOURCE}"
else
  curl -fsSL "${RAW_LAMBDA_URL}" -o "${LAMBDA_SOURCE}"
fi
(cd "${WORK_DIR}" && zip -q sms-announcement-send-worker.zip lambda_function.py)
ZIP_FILE="${WORK_DIR}/sms-announcement-send-worker.zip"

ENV_FILE="$(mktemp)"
TMP_FILES+=("${ENV_FILE}")
cat >"${ENV_FILE}" <<JSON
{
  "Variables": {
    "DYNAMODB_EMAIL_CAMPAIGNS_TABLE": "${EMAIL_CAMPAIGNS_TABLE}",
    "DYNAMODB_EMAIL_CAMPAIGN_RECIPIENTS_TABLE": "${RECIPIENTS_TABLE}",
    "DYNAMODB_SMS_SUBSCRIBERS_TABLE": "${SMS_SUBSCRIBERS_TABLE}",
    "TWILIO_ACCOUNT_SID": "${TWILIO_ACCOUNT_SID}",
    "TWILIO_AUTH_TOKEN": "${TWILIO_AUTH_TOKEN}",
    "TWILIO_MESSAGING_SERVICE_SID": "${MESSAGING_SERVICE_SID}",
    "TWILIO_SMS_FROM_NUMBER": "${SMS_FROM_NUMBER}",
    "TWILIO_STATUS_CALLBACK_URL": "${STATUS_CALLBACK_URL}",
    "MAX_SEND_RETRIES": "3",
    "SQS_PARTIAL_BATCH_RESPONSE_ENABLED": "true"
  }
}
JSON

if aws lambda get-function --region "${REGION}" --function-name "${FUNCTION_NAME}" >/dev/null 2>&1; then
  aws lambda update-function-code \
    --region "${REGION}" \
    --function-name "${FUNCTION_NAME}" \
    --zip-file "fileb://${ZIP_FILE}" >/dev/null
  aws lambda wait function-updated \
    --region "${REGION}" \
    --function-name "${FUNCTION_NAME}"
  aws lambda update-function-configuration \
    --region "${REGION}" \
    --function-name "${FUNCTION_NAME}" \
    --role "${ROLE_ARN}" \
    --timeout 30 \
    --memory-size 256 \
    --environment "file://${ENV_FILE}" >/dev/null
  aws lambda wait function-updated \
    --region "${REGION}" \
    --function-name "${FUNCTION_NAME}"
else
  aws lambda create-function \
    --region "${REGION}" \
    --function-name "${FUNCTION_NAME}" \
    --runtime python3.12 \
    --role "${ROLE_ARN}" \
    --handler lambda_function.lambda_handler \
    --timeout 30 \
    --memory-size 256 \
    --zip-file "fileb://${ZIP_FILE}" \
    --environment "file://${ENV_FILE}" >/dev/null
fi

aws lambda wait function-active \
  --region "${REGION}" \
  --function-name "${FUNCTION_NAME}"

if aws lambda put-function-concurrency \
  --region "${REGION}" \
  --function-name "${FUNCTION_NAME}" \
  --reserved-concurrent-executions 2 >/dev/null; then
  echo "Reserved Lambda concurrency set to 2."
else
  echo "Warning: could not set reserved Lambda concurrency. Continuing with batch size 1."
fi

MAPPING_UUID="$(aws lambda list-event-source-mappings \
  --region "${REGION}" \
  --function-name "${FUNCTION_NAME}" \
  --event-source-arn "${QUEUE_ARN}" \
  --query 'EventSourceMappings[0].UUID' \
  --output text)"

if [[ "${MAPPING_UUID}" == "None" || -z "${MAPPING_UUID}" ]]; then
  aws lambda create-event-source-mapping \
    --region "${REGION}" \
    --function-name "${FUNCTION_NAME}" \
    --event-source-arn "${QUEUE_ARN}" \
    --batch-size 1 \
    --function-response-types ReportBatchItemFailures \
    --enabled >/dev/null
else
  aws lambda update-event-source-mapping \
    --region "${REGION}" \
    --uuid "${MAPPING_UUID}" \
    --batch-size 1 \
    --function-response-types ReportBatchItemFailures \
    --enabled >/dev/null
fi

echo
echo "SMS announcement worker is provisioned."
echo "Queue URL for Vercel ADMIN_SMS_CAMPAIGN_QUEUE_URL:"
echo "${QUEUE_URL}"
echo
echo "Set these Vercel Production variables after confirming this output:"
echo "ADMIN_SMS_CAMPAIGN_QUEUE_URL=${QUEUE_URL}"
echo "ADMIN_SMS_ANNOUNCEMENTS_ENABLED=true"
echo "ADMIN_SMS_BULK_SEND_ENABLED=true"
echo "ADMIN_SMS_BULK_SEND_INFRA_READY=true"
echo
echo "No email or SMS was sent."
