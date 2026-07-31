#!/usr/bin/env bash
set -euo pipefail

REGION="${REGION:-us-east-1}"
BETA_TABLE="${DYNAMODB_BETA_APPLICATIONS_TABLE:-suppvis-prod-beta-applications}"
AUDIT_TABLE="${DYNAMODB_BROADCAST_AUDIT_LOGS_TABLE:-suppvis-prod-broadcast-audit-logs}"
ADMIN_IDENTIFIER="${ADMIN_IDENTIFIER:-cloudshell:signup-order-correction}"
PRIORITY_LIMIT="${PRIORITY_BETA_LIMIT:-300}"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TMP_DIR}"' EXIT

APPLICATIONS_JSON="${TMP_DIR}/beta-applications.json"
UPDATES_TSV="${TMP_DIR}/signup-order-updates.tsv"
META_TSV="${TMP_DIR}/signup-order-metadata.tsv"

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
CALLER_ARN="$(aws sts get-caller-identity --query Arn --output text)"
NOW="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

echo "AWS account: ${ACCOUNT_ID}"
echo "Caller: ${CALLER_ARN}"
echo "Region: ${REGION}"
echo "Beta table: ${BETA_TABLE}"
echo "Priority limit: ${PRIORITY_LIMIT}"
echo

echo "Inspecting beta application table..."
aws dynamodb describe-table \
  --region "${REGION}" \
  --table-name "${BETA_TABLE}" \
  --query 'Table.{TableName:TableName,TableStatus:TableStatus,KeySchema:KeySchema,ItemCount:ItemCount}' \
  --output json
echo

echo "Loading safe beta application metadata..."
aws dynamodb scan \
  --region "${REGION}" \
  --table-name "${BETA_TABLE}" \
  --consistent-read \
  --projection-expression '#id,#record,#first,#last,#email,#normalized,#status,#created,#updated,#order,#priority,#version' \
  --expression-attribute-names '{"#id":"id","#record":"record_type","#first":"first_name","#last":"last_name","#email":"email","#normalized":"normalized_email","#status":"status","#created":"created_at","#updated":"updated_at","#order":"signup_order_number","#priority":"priority_beta","#version":"subscriber_admin_version"}' \
  --output json > "${APPLICATIONS_JSON}"

python3 - "${APPLICATIONS_JSON}" "${UPDATES_TSV}" "${META_TSV}" "${PRIORITY_LIMIT}" <<'PY'
import json
import sys

input_path, updates_path, meta_path, priority_limit_raw = sys.argv[1:5]
priority_limit = int(priority_limit_raw)

def unwrap(value):
    if not isinstance(value, dict):
        return None
    if "S" in value:
        return value["S"]
    if "N" in value:
        number = value["N"]
        try:
            return int(number)
        except ValueError:
            try:
                return float(number)
            except ValueError:
                return number
    if "BOOL" in value:
        return bool(value["BOOL"])
    if "NULL" in value:
        return None
    return None

def row(item):
    return {key: unwrap(value) for key, value in item.items()}

def full_name(record):
    return f"{record.get('first_name') or ''} {record.get('last_name') or ''}".strip()

def normalize_name(value):
    return " ".join((value or "").strip().lower().split())

def mask_email(value):
    email = (value or "").strip()
    if "@" not in email:
        return "unavailable"
    local, domain = email.split("@", 1)
    if len(local) <= 2:
        masked_local = local[:1] + "***"
    else:
        masked_local = f"{local[:2]}***"
    return f"{masked_local}@{domain}"

def sort_key(record):
    current_order = record.get("signup_order_number")
    order_key = current_order if isinstance(current_order, int) and current_order > 0 else 10**9
    return (
        order_key,
        str(record.get("created_at") or ""),
        str(record.get("normalized_email") or record.get("email") or ""),
        str(record.get("id") or ""),
    )

with open(input_path, "r", encoding="utf-8") as handle:
    payload = json.load(handle)

records = [
    row(item)
    for item in payload.get("Items", [])
]

applications = [
    record
    for record in records
    if record.get("id")
    and not str(record.get("id")).startswith("__")
    and record.get("status") == "new"
    and record.get("first_name")
    and record.get("last_name")
    and record.get("email")
]

tanner_matches = [
    record for record in applications if normalize_name(full_name(record)) == "tanner haslinger"
]
andrew_matches = [
    record for record in applications if normalize_name(full_name(record)) == "andrew grimes"
]

if len(tanner_matches) != 1 or len(andrew_matches) != 1:
    print("Could not identify exactly one Tanner Haslinger and one Andrew Grimes record.")
    print("Matching records found, safely masked:")
    for label, matches in (("Tanner Haslinger", tanner_matches), ("Andrew Grimes", andrew_matches)):
        print(f"{label}: {len(matches)}")
        for match in matches:
            print(
                f"  {full_name(match)} | {mask_email(match.get('email'))} | current #{match.get('signup_order_number') or 'missing'}"
            )
    sys.exit(2)

tanner = tanner_matches[0]
andrew = andrew_matches[0]
reserved_ids = {tanner["id"], andrew["id"]}
sequence = [(tanner, 1), (andrew, 2)]
next_order = 3

for record in sorted((record for record in applications if record["id"] not in reserved_ids), key=sort_key):
    sequence.append((record, next_order))
    next_order += 1

seen_orders = set()
updates = []
for record, desired_order in sequence:
    if desired_order in seen_orders:
        raise SystemExit(f"Duplicate desired signup order generated: {desired_order}")
    seen_orders.add(desired_order)

    current_order = record.get("signup_order_number")
    current_version = record.get("subscriber_admin_version")
    current_version = current_version if isinstance(current_version, int) and current_version > 0 else 1
    if current_order != desired_order:
        updates.append((record, desired_order, current_version + 1))

priority_count = sum(
    1
    for record, order in sequence
    if record.get("priority_beta") is True
    or (record.get("priority_beta") is None and order <= priority_limit)
)
max_order = max((order for _, order in sequence), default=0)

with open(updates_path, "w", encoding="utf-8") as handle:
    for record, desired_order, next_version in updates:
        handle.write(f"{record['id']}\t{desired_order}\t{next_version}\n")

with open(meta_path, "w", encoding="utf-8") as handle:
    handle.write(f"{max_order}\t{priority_count}\t{len(updates)}\n")

print("Planned final signup-order sequence:")
for record, order in sequence:
    print(f"  #{order}: {full_name(record)} ({mask_email(record.get('email'))})")
print()
print(f"Records needing signup-order updates: {len(updates)}")
PY

read -r MAX_SIGNUP_ORDER PRIORITY_COUNT UPDATE_COUNT < "${META_TSV}"

if [[ "${APPLY_SIGNUP_ORDER_FIX:-}" != "yes" ]]; then
  echo
  echo "Dry run complete. No records were changed."
  echo "To apply this exact correction, run:"
  echo "APPLY_SIGNUP_ORDER_FIX=yes bash aws/scripts/fix-beta-signup-order-tanner-andrew.sh"
  exit 0
fi

echo
echo "Applying signup-order correction..."
while IFS=$'\t' read -r SUBSCRIBER_ID SIGNUP_ORDER NEXT_VERSION; do
  [[ -n "${SUBSCRIBER_ID}" ]] || continue
  aws dynamodb update-item \
    --region "${REGION}" \
    --table-name "${BETA_TABLE}" \
    --key "{\"id\":{\"S\":\"${SUBSCRIBER_ID}\"}}" \
    --update-expression 'SET #order = :order, #assigned = if_not_exists(#assigned, :now), #version = :version, #updated = :now' \
    --condition-expression 'attribute_exists(#id)' \
    --expression-attribute-names '{"#id":"id","#order":"signup_order_number","#assigned":"signup_order_assigned_at","#version":"subscriber_admin_version","#updated":"updated_at"}' \
    --expression-attribute-values "{\":order\":{\"N\":\"${SIGNUP_ORDER}\"},\":version\":{\"N\":\"${NEXT_VERSION}\"},\":now\":{\"S\":\"${NOW}\"}}" \
    --return-values NONE >/dev/null
done < "${UPDATES_TSV}"

echo "Updating subscriber metadata summary..."
aws dynamodb update-item \
  --region "${REGION}" \
  --table-name "${BETA_TABLE}" \
  --key '{"id":{"S":"__beta_subscriber_metadata__"}}' \
  --update-expression 'SET #record = :record, #last = :last, #priority = :priority, #updated = :now' \
  --expression-attribute-names '{"#record":"record_type","#last":"last_signup_order_number","#priority":"priority_count","#updated":"updated_at"}' \
  --expression-attribute-values "{\":record\":{\"S\":\"beta_subscriber_metadata\"},\":last\":{\"N\":\"${MAX_SIGNUP_ORDER}\"},\":priority\":{\"N\":\"${PRIORITY_COUNT}\"},\":now\":{\"S\":\"${NOW}\"}}" \
  --return-values NONE >/dev/null

if aws dynamodb describe-table --region "${REGION}" --table-name "${AUDIT_TABLE}" >/dev/null 2>&1; then
  AUDIT_ID="broadcast_audit_$(python3 - <<'PY'
import uuid
print(uuid.uuid4())
PY
)"
  aws dynamodb put-item \
    --region "${REGION}" \
    --table-name "${AUDIT_TABLE}" \
    --item "{\"id\":{\"S\":\"${AUDIT_ID}\"},\"admin_identifier\":{\"S\":\"${ADMIN_IDENTIFIER}\"},\"channel\":{\"S\":\"both\"},\"message_preview\":{\"S\":\"subscriber_signup_order_corrected status=tanner=1 andrew=2 changed=${UPDATE_COUNT}\"},\"intended_audience\":{\"S\":\"admin_subscriber_management\"},\"dry_run\":{\"BOOL\":true},\"status\":{\"S\":\"dry_run_recorded\"},\"created_at\":{\"S\":\"${NOW}\"}}" >/dev/null || \
    echo "Warning: audit write failed; signup-order correction was already applied."
else
  echo "Audit table not found; skipping audit write."
fi

echo
echo "Verifying final sequence..."
aws dynamodb scan \
  --region "${REGION}" \
  --table-name "${BETA_TABLE}" \
  --consistent-read \
  --projection-expression '#id,#first,#last,#email,#status,#order' \
  --expression-attribute-names '{"#id":"id","#first":"first_name","#last":"last_name","#email":"email","#status":"status","#order":"signup_order_number"}' \
  --output json > "${APPLICATIONS_JSON}"

python3 - "${APPLICATIONS_JSON}" <<'PY'
import json
import sys

def unwrap(value):
    if "S" in value:
        return value["S"]
    if "N" in value:
        return int(value["N"])
    return None

def row(item):
    return {key: unwrap(value) for key, value in item.items()}

def full_name(record):
    return f"{record.get('first_name') or ''} {record.get('last_name') or ''}".strip()

def mask_email(value):
    email = (value or "").strip()
    if "@" not in email:
        return "unavailable"
    local, domain = email.split("@", 1)
    return f"{local[:2]}***@{domain}" if len(local) > 2 else f"{local[:1]}***@{domain}"

with open(sys.argv[1], "r", encoding="utf-8") as handle:
    records = [row(item) for item in json.load(handle).get("Items", [])]

applications = [
    record
    for record in records
    if record.get("id")
    and not str(record.get("id")).startswith("__")
    and record.get("status") == "new"
]
applications.sort(key=lambda record: record.get("signup_order_number") or 10**9)

orders = [record.get("signup_order_number") for record in applications]
if len(orders) != len(set(orders)):
    raise SystemExit("Verification failed: duplicate signup-order values remain.")

print("Final verified signup-order sequence:")
for record in applications:
    print(f"  #{record.get('signup_order_number')}: {full_name(record)} ({mask_email(record.get('email'))})")

name_to_order = {full_name(record).lower(): record.get("signup_order_number") for record in applications}
if name_to_order.get("tanner haslinger") != 1 or name_to_order.get("andrew grimes") != 2:
    raise SystemExit("Verification failed: Tanner/Andrew signup-order values are not correct.")
PY

echo
echo "DONE: signup-order metadata corrected. No email or SMS was sent."
