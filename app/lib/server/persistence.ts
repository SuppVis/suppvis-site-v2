import {
  DYNAMO_TABLE_ENVS,
  putDynamoItem,
  updateDynamoItem,
  upsertDynamoItem,
} from "./dynamo";

export type BetaApplicationRecord = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  normalized_email: string;
  phone_raw?: string;
  phone_e164?: string;
  sms_opt_in: boolean;
  status: "new";
  source_page: string;
  created_at: string;
  updated_at: string;
};

export type EmailSubscriberRecord = {
  id: string;
  email: string;
  normalized_email: string;
  status: "subscribed" | "unsubscribed" | "bounced" | "complained";
  consent_timestamp: string;
  consent_source: string;
  created_at: string;
  updated_at: string;
  unsubscribe_token: string;
  resubscribed_at?: string;
  unsubscribed_at?: string;
  unsubscribe_source?: string;
  last_email_sent_at?: string;
  last_email_message_id?: string;
  last_email_type?: EmailTrackingMessageType;
  welcome_email_sent_at?: string;
  welcome_email_message_id?: string;
  welcome_email_type?: EmailTrackingMessageType;
  resubscribe_email_sent_at?: string;
  resubscribe_email_message_id?: string;
  unsubscribe_confirmation_email_sent_at?: string;
  unsubscribe_confirmation_email_message_id?: string;
};

export type EmailTrackingMessageType =
  | "welcome_beta"
  | "beta_resubscribe"
  | "beta_unsubscribe_confirmation";

function stringAttribute(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function emailSubscriberStatusAttribute(value: unknown) {
  return value === "subscribed" ||
    value === "unsubscribed" ||
    value === "bounced" ||
    value === "complained"
    ? value
    : undefined;
}

function emailSubscriberFromAttributes(
  attributes: Record<string, unknown> | undefined,
  fallback: EmailSubscriberRecord,
): EmailSubscriberRecord {
  return {
    id: stringAttribute(attributes?.id) || fallback.id,
    email: stringAttribute(attributes?.email) || fallback.email,
    normalized_email:
      stringAttribute(attributes?.normalized_email) ||
      fallback.normalized_email,
    status:
      emailSubscriberStatusAttribute(attributes?.status) || fallback.status,
    consent_timestamp:
      stringAttribute(attributes?.consent_timestamp) ||
      fallback.consent_timestamp,
    consent_source:
      stringAttribute(attributes?.consent_source) || fallback.consent_source,
    created_at: stringAttribute(attributes?.created_at) || fallback.created_at,
    updated_at: stringAttribute(attributes?.updated_at) || fallback.updated_at,
    unsubscribe_token:
      stringAttribute(attributes?.unsubscribe_token) ||
      fallback.unsubscribe_token,
    resubscribed_at:
      stringAttribute(attributes?.resubscribed_at) ||
      fallback.resubscribed_at,
    unsubscribed_at:
      stringAttribute(attributes?.unsubscribed_at) ||
      fallback.unsubscribed_at,
    unsubscribe_source:
      stringAttribute(attributes?.unsubscribe_source) ||
      fallback.unsubscribe_source,
  };
}

export type SmsSubscriberRecord = {
  id: string;
  phone_number_raw: string;
  phone_number_e164: string;
  status: "pending_verification" | "subscribed" | "unsubscribed";
  sms_consent_timestamp: string;
  sms_consent_source: string;
  opt_out_timestamp: string | null;
  opt_out_source?: string | null;
  last_opt_out_keyword?: string | null;
  resubscribed_at?: string;
  created_at: string;
  updated_at: string;
};

export type BroadcastAuditRecord = {
  id: string;
  admin_identifier: string;
  channel: "email" | "sms" | "both";
  message_preview: string;
  intended_audience: string;
  target_count?: number;
  dry_run: boolean;
  status: "dry_run_recorded";
  created_at: string;
};

export async function saveBetaApplication(record: BetaApplicationRecord) {
  const result = await upsertDynamoItem({
    tableEnvName: DYNAMO_TABLE_ENVS.betaApplications,
    key: { id: record.id },
    operation: "save_beta_application",
    conditionAttributeNotExists: ["id"],
    set: {
      first_name: record.first_name,
      last_name: record.last_name,
      email: record.email,
      normalized_email: record.normalized_email,
      phone_raw: record.phone_raw,
      phone_e164: record.phone_e164,
      sms_opt_in: record.sms_opt_in,
      source_page: record.source_page,
      updated_at: record.updated_at,
    },
    setIfNotExists: {
      id: record.id,
      status: record.status,
      created_at: record.created_at,
    },
  });

  return result.wrote;
}

export async function saveEmailSubscriber(record: EmailSubscriberRecord) {
  const result = await upsertDynamoItem({
    tableEnvName: DYNAMO_TABLE_ENVS.emailSubscribers,
    key: { id: record.id },
    operation: "save_email_subscriber",
    returnValues: "ALL_NEW",
    set: {
      email: record.email,
      normalized_email: record.normalized_email,
      consent_timestamp: record.consent_timestamp,
      consent_source: record.consent_source,
      resubscribed_at: record.resubscribed_at,
      updated_at: record.updated_at,
    },
    setIfNotExists: {
      id: record.id,
      status: record.status,
      created_at: record.created_at,
      unsubscribe_token: record.unsubscribe_token,
    },
  });

  return emailSubscriberFromAttributes(result.attributes, record);
}

export async function saveSmsSubscriber(record: SmsSubscriberRecord) {
  await upsertDynamoItem({
    tableEnvName: DYNAMO_TABLE_ENVS.smsSubscribers,
    key: { id: record.id },
    operation: "save_sms_subscriber",
    set: {
      phone_number_raw: record.phone_number_raw,
      phone_number_e164: record.phone_number_e164,
      status: record.status,
      sms_consent_timestamp: record.sms_consent_timestamp,
      sms_consent_source: record.sms_consent_source,
      opt_out_timestamp: record.opt_out_timestamp,
      opt_out_source: record.opt_out_source,
      last_opt_out_keyword: record.last_opt_out_keyword,
      resubscribed_at: record.resubscribed_at,
      updated_at: record.updated_at,
    },
    setIfNotExists: {
      id: record.id,
      created_at: record.created_at,
    },
  });
}

export async function markEmailResubscribeIfUnsubscribed(input: {
  id: string;
  now: string;
}) {
  return updateDynamoItem({
    tableEnvName: DYNAMO_TABLE_ENVS.emailSubscribers,
    key: { id: input.id },
    operation: "mark_email_resubscribe",
    set: {
      status: "subscribed",
      resubscribed_at: input.now,
      updated_at: input.now,
    },
    conditionExpression: "attribute_exists(#id) AND #status = :unsubscribed",
    conditionAttributeNames: {
      "#id": "id",
      "#status": "status",
    },
    conditionAttributeValues: {
      ":unsubscribed": "unsubscribed",
    },
  });
}

export async function unsubscribeEmailSubscriber(input: {
  id: string;
  token: string;
  now: string;
}) {
  const fallback: EmailSubscriberRecord = {
    id: input.id,
    email: "",
    normalized_email: "",
    status: "unsubscribed",
    consent_timestamp: "",
    consent_source: "",
    created_at: input.now,
    updated_at: input.now,
    unsubscribe_token: input.token,
    unsubscribed_at: input.now,
    unsubscribe_source: "email_link",
  };
  const result = await updateDynamoItem({
    tableEnvName: DYNAMO_TABLE_ENVS.emailSubscribers,
    key: { id: input.id },
    operation: "unsubscribe_email_subscriber",
    set: {
      status: "unsubscribed",
      unsubscribed_at: input.now,
      unsubscribe_source: "email_link",
      updated_at: input.now,
    },
    conditionAttributeNames: {
      "#id": "id",
      "#token": "unsubscribe_token",
      "#status": "status",
    },
    conditionAttributeValues: {
      ":token": input.token,
      ":unsubscribed": "unsubscribed",
    },
    conditionExpression:
      "attribute_exists(#id) AND #token = :token AND (attribute_not_exists(#status) OR #status <> :unsubscribed)",
    returnValues: "ALL_NEW",
  });

  if (result.wrote) {
    return {
      status: "unsubscribed" as const,
      subscriber: emailSubscriberFromAttributes(result.attributes, fallback),
    };
  }

  const alreadyUnsubscribedResult = await updateDynamoItem({
    tableEnvName: DYNAMO_TABLE_ENVS.emailSubscribers,
    key: { id: input.id },
    operation: "unsubscribe_email_subscriber_already_unsubscribed",
    set: {
      updated_at: input.now,
    },
    conditionExpression:
      "attribute_exists(#id) AND #token = :token AND #status = :unsubscribed",
    conditionAttributeNames: {
      "#id": "id",
      "#token": "unsubscribe_token",
      "#status": "status",
    },
    conditionAttributeValues: {
      ":token": input.token,
      ":unsubscribed": "unsubscribed",
    },
    returnValues: "ALL_NEW",
  });

  if (alreadyUnsubscribedResult.wrote) {
    return {
      status: "already_unsubscribed" as const,
      subscriber: emailSubscriberFromAttributes(
        alreadyUnsubscribedResult.attributes,
        fallback,
      ),
    };
  }

  return {
    status: "invalid" as const,
    subscriber: null,
  };
}

export async function recordEmailSendAccepted(input: {
  id: string;
  messageId: string;
  messageType: EmailTrackingMessageType;
  now: string;
}) {
  const variantFields =
    input.messageType === "welcome_beta"
      ? {
          welcome_email_sent_at: input.now,
          welcome_email_message_id: input.messageId,
          welcome_email_type: input.messageType,
        }
      : input.messageType === "beta_resubscribe"
        ? {
            resubscribe_email_sent_at: input.now,
            resubscribe_email_message_id: input.messageId,
          }
        : {
            unsubscribe_confirmation_email_sent_at: input.now,
            unsubscribe_confirmation_email_message_id: input.messageId,
          };

  return updateDynamoItem({
    tableEnvName: DYNAMO_TABLE_ENVS.emailSubscribers,
    key: { id: input.id },
    operation: "record_email_send_accepted",
    set: {
      last_email_sent_at: input.now,
      last_email_message_id: input.messageId,
      last_email_type: input.messageType,
      ...variantFields,
    },
    conditionExpression: "attribute_exists(#id)",
    conditionAttributeNames: {
      "#id": "id",
    },
  });
}

export async function markSmsResubscribeIfUnsubscribed(input: {
  id: string;
  now: string;
}) {
  return updateDynamoItem({
    tableEnvName: DYNAMO_TABLE_ENVS.smsSubscribers,
    key: { id: input.id },
    operation: "mark_sms_resubscribe",
    set: {
      resubscribed_at: input.now,
      updated_at: input.now,
    },
    conditionExpression: "attribute_exists(#id) AND #status = :unsubscribed",
    conditionAttributeNames: {
      "#id": "id",
      "#status": "status",
    },
    conditionAttributeValues: {
      ":unsubscribed": "unsubscribed",
    },
  });
}

export async function optOutSmsSubscriber(input: {
  id: string;
  phone_number_e164: string;
  keyword: string;
  now: string;
}) {
  await upsertDynamoItem({
    tableEnvName: DYNAMO_TABLE_ENVS.smsSubscribers,
    key: { id: input.id },
    operation: "sms_stop_opt_out",
    set: {
      phone_number_raw: input.phone_number_e164,
      phone_number_e164: input.phone_number_e164,
      status: "unsubscribed",
      opt_out_timestamp: input.now,
      opt_out_source: "sms_stop",
      last_opt_out_keyword: input.keyword,
      updated_at: input.now,
    },
    setIfNotExists: {
      id: input.id,
      created_at: input.now,
    },
  });
}

export async function resubscribeSmsSubscriberFromKeyword(input: {
  id: string;
  phone_number_e164: string;
  keyword: string;
  now: string;
}) {
  await upsertDynamoItem({
    tableEnvName: DYNAMO_TABLE_ENVS.smsSubscribers,
    key: { id: input.id },
    operation: "sms_start_resubscribe",
    set: {
      phone_number_raw: input.phone_number_e164,
      phone_number_e164: input.phone_number_e164,
      status: "pending_verification",
      sms_consent_timestamp: input.now,
      sms_consent_source: "sms_start",
      opt_out_timestamp: null,
      opt_out_source: null,
      last_opt_out_keyword: input.keyword,
      resubscribed_at: input.now,
      updated_at: input.now,
    },
    setIfNotExists: {
      id: input.id,
      created_at: input.now,
    },
  });
}

export function canSendEmailToSubscriber(record: { status?: string }) {
  return record.status === "subscribed";
}

export function canSendSmsToSubscriber(record: { status?: string }) {
  return (
    record.status === "subscribed" ||
    record.status === "pending_verification"
  );
}

export async function saveBroadcastAudit(record: BroadcastAuditRecord) {
  await putDynamoItem(
    DYNAMO_TABLE_ENVS.broadcastAuditLogs,
    record,
    "save_broadcast_audit",
  );
}
