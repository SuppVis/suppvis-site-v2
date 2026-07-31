#!/usr/bin/env bash
set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
BETA_TABLE="${DYNAMODB_BETA_APPLICATIONS_TABLE:-suppvis-prod-beta-applications}"
EMAIL_TABLE="${DYNAMODB_EMAIL_SUBSCRIBERS_TABLE:-suppvis-prod-email-subscribers}"
SMS_TABLE="${DYNAMODB_SMS_SUBSCRIBERS_TABLE:-suppvis-prod-sms-subscribers}"

TARGET_EMAIL="${TARGET_EMAIL:-}"
TARGET_PHONE_E164="${TARGET_PHONE_E164:-}"

if [[ -z "${TARGET_EMAIL}" || -z "${TARGET_PHONE_E164}" ]]; then
  echo "TARGET_EMAIL and TARGET_PHONE_E164 are required." >&2
  echo "Example:" >&2
  echo "TARGET_EMAIL=user@example.com TARGET_PHONE_E164=+15555550123 bash aws/scripts/reset-beta-test-subscriber.sh" >&2
  exit 2
fi

normalized_email="$(printf "%s" "${TARGET_EMAIL}" | tr '[:upper:]' '[:lower:]' | xargs)"

stable_id() {
  local prefix="$1"
  local value="$2"
  local hash
  hash="$(printf "%s" "${value}" | sha256sum | awk '{print $1}' | cut -c1-32)"
  printf "%s_%s" "${prefix}" "${hash}"
}

mask_email() {
  local email="$1"
  local local_part="${email%@*}"
  local domain="${email#*@}"
  printf "%s***@%s" "${local_part:0:2}" "${domain}"
}

mask_phone() {
  local digits
  digits="$(printf "%s" "$1" | tr -cd '0-9')"
  printf "(***) ***-%s" "${digits: -4}"
}

BETA_ID="$(stable_id beta "${normalized_email}")"
EMAIL_ID="$(stable_id email "${normalized_email}")"
SMS_ID="$(stable_id sms "${TARGET_PHONE_E164}")"

echo "Region: ${REGION}"
echo "Beta table: ${BETA_TABLE}"
echo "Email table: ${EMAIL_TABLE}"
echo "SMS table: ${SMS_TABLE}"
echo "Target email: $(mask_email "${normalized_email}")"
echo "Target phone: $(mask_phone "${TARGET_PHONE_E164}")"
echo "Beta id: ${BETA_ID}"
echo "Email id: ${EMAIL_ID}"
echo "SMS id: ${SMS_ID}"
echo

echo "Inspecting target records without printing recipient contact data..."
aws dynamodb get-item \
  --region "${REGION}" \
  --table-name "${BETA_TABLE}" \
  --key "{\"id\":{\"S\":\"${BETA_ID}\"}}" \
  --projection-expression "id, first_name, last_name, signup_order_number, priority_beta, created_at, updated_at, #status" \
  --expression-attribute-names '{"#status":"status"}' \
  --query 'Item' \
  --output json

aws dynamodb get-item \
  --region "${REGION}" \
  --table-name "${EMAIL_TABLE}" \
  --key "{\"id\":{\"S\":\"${EMAIL_ID}\"}}" \
  --projection-expression "id, #status, welcome_email_sent_at, resubscribe_email_sent_at, last_email_sent_at, last_email_type" \
  --expression-attribute-names '{"#status":"status"}' \
  --query 'Item' \
  --output json

aws dynamodb get-item \
  --region "${REGION}" \
  --table-name "${SMS_TABLE}" \
  --key "{\"id\":{\"S\":\"${SMS_ID}\"}}" \
  --projection-expression "id, #status, welcome_sms_sent_at, welcome_sms_message_sid, last_sms_status, last_sms_error_code, sms_provider_status, sms_global_opt_out" \
  --expression-attribute-names '{"#status":"status"}' \
  --query 'Item' \
  --output json

shared_phone_count="$(aws dynamodb scan \
  --region "${REGION}" \
  --table-name "${BETA_TABLE}" \
  --filter-expression "#phone = :phone" \
  --expression-attribute-names '{"#phone":"phone_e164"}' \
  --expression-attribute-values "{\":phone\":{\"S\":\"${TARGET_PHONE_E164}\"}}" \
  --select COUNT \
  --query Count \
  --output text)"

echo
echo "Beta applications with this phone: ${shared_phone_count}"
if [[ "${shared_phone_count}" != "0" && "${shared_phone_count}" != "1" ]]; then
  echo "Refusing to delete because more than one beta application has this phone." >&2
  exit 3
fi

if [[ "${APPLY_BETA_TEST_SUBSCRIBER_RESET:-}" != "yes" ]]; then
  echo
  echo "Dry run complete. No records were changed."
  echo "To apply this exact reset, run:"
  echo "APPLY_BETA_TEST_SUBSCRIBER_RESET=yes TARGET_EMAIL='${normalized_email}' TARGET_PHONE_E164='${TARGET_PHONE_E164}' bash aws/scripts/reset-beta-test-subscriber.sh"
  exit 0
fi

echo
echo "Deleting target beta/email/SMS records..."
aws dynamodb delete-item \
  --region "${REGION}" \
  --table-name "${BETA_TABLE}" \
  --key "{\"id\":{\"S\":\"${BETA_ID}\"}}"
aws dynamodb delete-item \
  --region "${REGION}" \
  --table-name "${EMAIL_TABLE}" \
  --key "{\"id\":{\"S\":\"${EMAIL_ID}\"}}"
aws dynamodb delete-item \
  --region "${REGION}" \
  --table-name "${SMS_TABLE}" \
  --key "{\"id\":{\"S\":\"${SMS_ID}\"}}"

echo
echo "Verifying target records are absent..."
aws dynamodb get-item \
  --region "${REGION}" \
  --table-name "${BETA_TABLE}" \
  --key "{\"id\":{\"S\":\"${BETA_ID}\"}}" \
  --query 'Item.id.S' \
  --output text
aws dynamodb get-item \
  --region "${REGION}" \
  --table-name "${EMAIL_TABLE}" \
  --key "{\"id\":{\"S\":\"${EMAIL_ID}\"}}" \
  --query 'Item.id.S' \
  --output text
aws dynamodb get-item \
  --region "${REGION}" \
  --table-name "${SMS_TABLE}" \
  --key "{\"id\":{\"S\":\"${SMS_ID}\"}}" \
  --query 'Item.id.S' \
  --output text

echo
echo "Recalculating chronological signup metadata for remaining beta records..."
APPLY_CHRONOLOGICAL_SIGNUP_ORDER_FIX=yes bash aws/scripts/recalculate-beta-signup-order-chronological.sh

echo
echo "DONE: target beta/email/SMS records removed and signup order recalculated. No email or SMS was sent."
