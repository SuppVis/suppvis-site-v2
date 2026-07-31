#!/usr/bin/env bash
set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
BETA_TABLE="${DYNAMODB_BETA_APPLICATIONS_TABLE:-suppvis-prod-beta-applications}"
AUDIT_TABLE="${DYNAMODB_BROADCAST_AUDIT_LOGS_TABLE:-suppvis-prod-broadcast-audit-logs}"
PRIORITY_LIMIT="${PRIORITY_BETA_LIMIT:-300}"
APPLY="${APPLY_CHRONOLOGICAL_SIGNUP_ORDER_FIX:-no}"

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
CALLER_ARN="$(aws sts get-caller-identity --query Arn --output text)"
NOW="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
WORKDIR="$(mktemp -d)"
trap 'rm -rf "${WORKDIR}"' EXIT

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
  --projection-expression '#id,#record,#first,#last,#email,#normalized,#status,#created,#assigned,#order,#priority,#version' \
  --expression-attribute-names '{"#id":"id","#record":"record_type","#first":"first_name","#last":"last_name","#email":"email","#normalized":"normalized_email","#status":"status","#created":"created_at","#assigned":"signup_order_assigned_at","#order":"signup_order_number","#priority":"priority_beta","#version":"subscriber_admin_version"}' \
  --output json >"${WORKDIR}/scan.json"

python3 - "${WORKDIR}/scan.json" "${WORKDIR}/plan.tsv" "${PRIORITY_LIMIT}" <<'PY'
import json
import sys

scan_path, plan_path, raw_limit = sys.argv[1:4]
priority_limit = int(raw_limit)

def attr(item, name):
    value = item.get(name, {})
    if "S" in value:
        return value["S"]
    if "N" in value:
        try:
            return int(value["N"])
        except ValueError:
            return None
    if "BOOL" in value:
        return bool(value["BOOL"])
    return None

def mask_email(value):
    if not value or "@" not in value:
        return "missing-email"
    local, domain = value.split("@", 1)
    prefix = local[:2] if len(local) > 1 else local[:1]
    return f"{prefix}***@{domain}"

def full_name(record):
    return " ".join(part for part in [record["first"], record["last"]] if part).strip() or "Unnamed subscriber"

with open(scan_path, "r", encoding="utf-8") as handle:
    payload = json.load(handle)

records = []
for item in payload.get("Items", []):
    record_id = attr(item, "id")
    if not record_id or record_id.startswith("__"):
        continue
    status = attr(item, "status")
    if status != "new":
        continue
    created_at = attr(item, "created_at")
    assigned_at = attr(item, "signup_order_assigned_at")
    if not created_at and not assigned_at:
        print(f"ERROR: beta application {record_id} has no original signup timestamp", file=sys.stderr)
        sys.exit(1)
    records.append({
        "id": record_id,
        "first": attr(item, "first_name") or "",
        "last": attr(item, "last_name") or "",
        "email": attr(item, "email") or attr(item, "normalized_email") or "",
        "created_at": created_at or "",
        "assigned_at": assigned_at or created_at or "",
        "current_order": attr(item, "signup_order_number"),
        "priority": attr(item, "priority_beta"),
        "version": attr(item, "subscriber_admin_version") or 1,
    })

records.sort(key=lambda record: (record["created_at"] or record["assigned_at"], record["id"]))

print("Planned chronological signup-order sequence:")
updates = []
for index, record in enumerate(records, start=1):
    current = record["current_order"]
    priority = record["priority"]
    if priority is None:
        priority = index <= priority_limit
    print(
        f"  #{index}: {full_name(record)} ({mask_email(record['email'])}) "
        f"| original signup {record['created_at'] or record['assigned_at']} "
        f"| current #{current or 'missing'}"
    )
    updates.append({
        **record,
        "new_order": index,
        "effective_priority": bool(priority),
        "needs_update": current != index,
    })

orders = [record["new_order"] for record in updates]
if orders != list(range(1, len(orders) + 1)):
    print("ERROR: planned signup orders are not unique and contiguous", file=sys.stderr)
    sys.exit(1)

with open(plan_path, "w", encoding="utf-8") as handle:
    for record in updates:
        if record["needs_update"]:
            handle.write(
                "\t".join(
                    [
                        record["id"],
                        str(record["new_order"]),
                        record["assigned_at"] or record["created_at"],
                        str(record["version"] + 1),
                    ]
                )
                + "\n"
            )

print()
print(f"Records needing signup-order updates: {sum(1 for record in updates if record['needs_update'])}")
print(f"Priority users preserved/derived for metadata: {sum(1 for record in updates if record['effective_priority'])}")
PY

UPDATE_COUNT="$(wc -l <"${WORKDIR}/plan.tsv" | tr -d ' ')"

if [[ "${APPLY}" != "yes" ]]; then
  echo
  echo "Dry run complete. No records were changed."
  echo "To apply this exact chronological correction, run:"
  echo "APPLY_CHRONOLOGICAL_SIGNUP_ORDER_FIX=yes bash aws/scripts/recalculate-beta-signup-order-chronological.sh"
  exit 0
fi

echo
echo "Applying chronological signup-order correction..."
while IFS=$'\t' read -r RECORD_ID NEW_ORDER ASSIGNED_AT NEXT_VERSION; do
  [[ -n "${RECORD_ID}" ]] || continue
  aws dynamodb update-item \
    --region "${REGION}" \
    --table-name "${BETA_TABLE}" \
    --key "{\"id\":{\"S\":\"${RECORD_ID}\"}}" \
    --update-expression 'SET #order = :order, #assigned = if_not_exists(#assigned, :assigned), #version = :version, #updated = :now' \
    --condition-expression 'attribute_exists(#id)' \
    --expression-attribute-names '{"#id":"id","#order":"signup_order_number","#assigned":"signup_order_assigned_at","#version":"subscriber_admin_version","#updated":"updated_at"}' \
    --expression-attribute-values "{\":order\":{\"N\":\"${NEW_ORDER}\"},\":assigned\":{\"S\":\"${ASSIGNED_AT}\"},\":version\":{\"N\":\"${NEXT_VERSION}\"},\":now\":{\"S\":\"${NOW}\"}}" \
    >/dev/null
done <"${WORKDIR}/plan.tsv"

LAST_ORDER="$(python3 - "${WORKDIR}/scan.json" <<'PY'
import json, sys
payload = json.load(open(sys.argv[1], encoding="utf-8"))
count = 0
for item in payload.get("Items", []):
    record_id = item.get("id", {}).get("S", "")
    status = item.get("status", {}).get("S")
    if record_id and not record_id.startswith("__") and status == "new":
        count += 1
print(count)
PY
)"
PRIORITY_COUNT="$(python3 - "${WORKDIR}/scan.json" "${PRIORITY_LIMIT}" <<'PY'
import json, sys
payload = json.load(open(sys.argv[1], encoding="utf-8"))
limit = int(sys.argv[2])
records = []
for item in payload.get("Items", []):
    record_id = item.get("id", {}).get("S", "")
    status = item.get("status", {}).get("S")
    if not record_id or record_id.startswith("__") or status != "new":
        continue
    created = item.get("created_at", {}).get("S", "") or item.get("signup_order_assigned_at", {}).get("S", "")
    priority = item.get("priority_beta", {}).get("BOOL")
    records.append((created, record_id, priority))
records.sort()
count = 0
for index, (_, _, priority) in enumerate(records, start=1):
    if priority if priority is not None else index <= limit:
        count += 1
print(count)
PY
)"

echo "Updating subscriber metadata summary..."
aws dynamodb update-item \
  --region "${REGION}" \
  --table-name "${BETA_TABLE}" \
  --key '{"id":{"S":"__beta_subscriber_metadata__"}}' \
  --update-expression 'SET #record = :record, #last = :last, #priority = :priority, #updated = :now' \
  --expression-attribute-names '{"#record":"record_type","#last":"last_signup_order_number","#priority":"priority_count","#updated":"updated_at"}' \
  --expression-attribute-values "{\":record\":{\"S\":\"beta_subscriber_metadata\"},\":last\":{\"N\":\"${LAST_ORDER}\"},\":priority\":{\"N\":\"${PRIORITY_COUNT}\"},\":now\":{\"S\":\"${NOW}\"}}" \
  >/dev/null

AUDIT_ID="audit_chronological_signup_order_${NOW//[:.-]/_}"
aws dynamodb put-item \
  --region "${REGION}" \
  --table-name "${AUDIT_TABLE}" \
  --item "{\"id\":{\"S\":\"${AUDIT_ID}\"},\"admin_identifier\":{\"S\":\"${CALLER_ARN}\"},\"channel\":{\"S\":\"both\"},\"message_preview\":{\"S\":\"subscriber_signup_order_recalculated_chronological changed=${UPDATE_COUNT}\"},\"intended_audience\":{\"S\":\"admin_subscriber_management\"},\"dry_run\":{\"BOOL\":true},\"status\":{\"S\":\"applied\"},\"created_at\":{\"S\":\"${NOW}\"}}" \
  >/dev/null || echo "Audit write skipped or failed; signup-order correction already applied."

echo
echo "Verifying final chronological sequence..."
aws dynamodb scan \
  --region "${REGION}" \
  --table-name "${BETA_TABLE}" \
  --projection-expression '#id,#first,#last,#email,#status,#created,#order' \
  --expression-attribute-names '{"#id":"id","#first":"first_name","#last":"last_name","#email":"email","#status":"status","#created":"created_at","#order":"signup_order_number"}' \
  --output json >"${WORKDIR}/verify.json"

python3 - "${WORKDIR}/verify.json" <<'PY'
import json, sys

def attr(item, name):
    value = item.get(name, {})
    if "S" in value:
        return value["S"]
    if "N" in value:
        return int(value["N"])
    return None

def mask_email(value):
    if not value or "@" not in value:
        return "missing-email"
    local, domain = value.split("@", 1)
    return f"{local[:2]}***@{domain}"

records = []
for item in json.load(open(sys.argv[1], encoding="utf-8")).get("Items", []):
    record_id = attr(item, "id")
    if not record_id or record_id.startswith("__") or attr(item, "status") != "new":
        continue
    records.append({
        "order": attr(item, "signup_order_number"),
        "name": " ".join(part for part in [attr(item, "first_name"), attr(item, "last_name")] if part),
        "email": attr(item, "email"),
        "created": attr(item, "created_at") or "",
    })

records.sort(key=lambda record: record["order"] or 10**9)
orders = [record["order"] for record in records]
expected = list(range(1, len(records) + 1))
if orders != expected:
    print(f"ERROR: final signup orders are not contiguous: {orders}", file=sys.stderr)
    sys.exit(1)

print("Final verified signup-order sequence:")
for record in records:
    print(f"  #{record['order']}: {record['name']} ({mask_email(record['email'])}) | original signup {record['created']}")
PY

echo
echo "DONE: chronological signup-order metadata corrected. No email or SMS was sent."
