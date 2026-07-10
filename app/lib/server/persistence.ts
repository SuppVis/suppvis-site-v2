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

function smsSubscriberStatusAttribute(value: unknown) {
  return value === "pending_verification" ||
    value === "subscribed" ||
    value === "unsubscribed" ||
    value === "failed" ||
    value === "invalid" ||
    value === "opt_out_provider"
    ? value
    : undefined;
}

export type SmsSubscriberStatus =
  | "pending_verification"
  | "subscribed"
  | "unsubscribed"
  | "failed"
  | "invalid"
  | "opt_out_provider";

export type SmsTrackingMessageType = "welcome_beta_sms";

export type SmsSubscriberRecord = {
  id: string;
  phone_number_raw: string;
  phone_number_e164: string;
  status: SmsSubscriberStatus;
  sms_consent_timestamp: string;
  sms_consent_source: string;
  opt_out_timestamp: string | null;
  opt_out_source?: string | null;
  last_opt_out_keyword?: string | null;
  resubscribed_at?: string;
  welcome_sms_sent_at?: string;
  welcome_sms_message_sid?: string;
  last_sms_sent_at?: string;
  last_sms_message_sid?: string;
  last_sms_status?: string;
  last_sms_error_code?: string;
  last_sms_error_message_safe?: string;
  sms_status_updated_at?: string;
  sms_provider_status?: string;
  created_at: string;
  updated_at: string;
};

function smsSubscriberFromAttributes(
  attributes: Record<string, unknown> | undefined,
  fallback: SmsSubscriberRecord,
): SmsSubscriberRecord {
  return {
    id: stringAttribute(attributes?.id) || fallback.id,
    phone_number_raw:
      stringAttribute(attributes?.phone_number_raw) ||
      fallback.phone_number_raw,
    phone_number_e164:
      stringAttribute(attributes?.phone_number_e164) ||
      fallback.phone_number_e164,
    status: smsSubscriberStatusAttribute(attributes?.status) || fallback.status,
    sms_consent_timestamp:
      stringAttribute(attributes?.sms_consent_timestamp) ||
      fallback.sms_consent_timestamp,
    sms_consent_source:
      stringAttribute(attributes?.sms_consent_source) ||
      fallback.sms_consent_source,
    opt_out_timestamp:
      stringAttribute(attributes?.opt_out_timestamp) ||
      fallback.opt_out_timestamp,
    opt_out_source:
      stringAttribute(attributes?.opt_out_source) || fallback.opt_out_source,
    last_opt_out_keyword:
      stringAttribute(attributes?.last_opt_out_keyword) ||
      fallback.last_opt_out_keyword,
    resubscribed_at:
      stringAttribute(attributes?.resubscribed_at) || fallback.resubscribed_at,
    welcome_sms_sent_at:
      stringAttribute(attributes?.welcome_sms_sent_at) ||
      fallback.welcome_sms_sent_at,
    welcome_sms_message_sid:
      stringAttribute(attributes?.welcome_sms_message_sid) ||
      fallback.welcome_sms_message_sid,
    last_sms_sent_at:
      stringAttribute(attributes?.last_sms_sent_at) ||
      fallback.last_sms_sent_at,
    last_sms_message_sid:
      stringAttribute(attributes?.last_sms_message_sid) ||
      fallback.last_sms_message_sid,
    last_sms_status:
      stringAttribute(attributes?.last_sms_status) || fallback.last_sms_status,
    last_sms_error_code:
      stringAttribute(attributes?.last_sms_error_code) ||
      fallback.last_sms_error_code,
    last_sms_error_message_safe:
      stringAttribute(attributes?.last_sms_error_message_safe) ||
      fallback.last_sms_error_message_safe,
    sms_status_updated_at:
      stringAttribute(attributes?.sms_status_updated_at) ||
      fallback.sms_status_updated_at,
    sms_provider_status:
      stringAttribute(attributes?.sms_provider_status) ||
      fallback.sms_provider_status,
    created_at: stringAttribute(attributes?.created_at) || fallback.created_at,
    updated_at: stringAttribute(attributes?.updated_at) || fallback.updated_at,
  };
}

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
  const result = await upsertDynamoItem({
    tableEnvName: DYNAMO_TABLE_ENVS.smsSubscribers,
    key: { id: record.id },
    operation: "save_sms_subscriber",
    returnValues: "ALL_NEW",
    set: {
      phone_number_raw: record.phone_number_raw,
      phone_number_e164: record.phone_number_e164,
      sms_consent_timestamp: record.sms_consent_timestamp,
      sms_consent_source: record.sms_consent_source,
      resubscribed_at: record.resubscribed_at,
      updated_at: record.updated_at,
    },
    setIfNotExists: {
      id: record.id,
      status: record.status,
      created_at: record.created_at,
    },
  });

  return smsSubscriberFromAttributes(result.attributes, record);
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

function smsSubscriberStatusForProviderStatus(input: {
  errorCode?: string;
  providerStatus: string;
}): SmsSubscriberStatus | undefined {
  const normalizedStatus = input.providerStatus.toLowerCase();

  if (input.errorCode === "21610") {
    return "opt_out_provider";
  }

  if (input.errorCode === "21211") {
    return "invalid";
  }

  if (normalizedStatus === "failed" || normalizedStatus === "undelivered") {
    return "failed";
  }

  if (
    normalizedStatus === "accepted" ||
    normalizedStatus === "queued" ||
    normalizedStatus === "sending" ||
    normalizedStatus === "sent" ||
    normalizedStatus === "delivered"
  ) {
    return "subscribed";
  }

  return undefined;
}

export async function recordSmsSendAccepted(input: {
  id: string;
  messageSid: string;
  messageType: SmsTrackingMessageType;
  now: string;
}) {
  return updateDynamoItem({
    tableEnvName: DYNAMO_TABLE_ENVS.smsSubscribers,
    key: { id: input.id },
    operation: "record_sms_send_accepted",
    set: {
      status: "subscribed",
      welcome_sms_sent_at: input.now,
      welcome_sms_message_sid: input.messageSid,
      last_sms_sent_at: input.now,
      last_sms_message_sid: input.messageSid,
      last_sms_status: "accepted",
      sms_provider_status: "accepted",
      sms_status_updated_at: input.now,
      updated_at: input.now,
    },
    conditionExpression: "attribute_exists(#id)",
    conditionAttributeNames: {
      "#id": "id",
    },
  });
}

export async function recordSmsSendFailure(input: {
  id: string;
  errorCode?: string;
  errorMessageSafe?: string;
  now: string;
}) {
  const status =
    input.errorCode === "21610"
      ? "opt_out_provider"
      : input.errorCode === "21211"
        ? "invalid"
        : "failed";

  return updateDynamoItem({
    tableEnvName: DYNAMO_TABLE_ENVS.smsSubscribers,
    key: { id: input.id },
    operation: "record_sms_send_failure",
    set: {
      status,
      last_sms_status: "failed",
      last_sms_error_code: input.errorCode,
      last_sms_error_message_safe: input.errorMessageSafe,
      sms_provider_status: "failed",
      sms_status_updated_at: input.now,
      updated_at: input.now,
    },
    conditionExpression: "attribute_exists(#id)",
    conditionAttributeNames: {
      "#id": "id",
    },
  });
}

export async function recordSmsProviderStatus(input: {
  id: string;
  messageSid: string;
  providerStatus: string;
  errorCode?: string;
  errorMessageSafe?: string;
  now: string;
}) {
  const status = smsSubscriberStatusForProviderStatus({
    errorCode: input.errorCode,
    providerStatus: input.providerStatus,
  });
  const isProviderOptOut = status === "opt_out_provider";

  return updateDynamoItem({
    tableEnvName: DYNAMO_TABLE_ENVS.smsSubscribers,
    key: { id: input.id },
    operation: "record_sms_provider_status",
    set: {
      status,
      opt_out_timestamp: isProviderOptOut ? input.now : undefined,
      opt_out_source: isProviderOptOut ? "twilio_provider" : undefined,
      last_sms_message_sid: input.messageSid,
      last_sms_status: input.providerStatus,
      last_sms_error_code: input.errorCode,
      last_sms_error_message_safe: input.errorMessageSafe,
      sms_provider_status: input.providerStatus,
      sms_status_updated_at: input.now,
      updated_at: input.now,
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
      status: "pending_verification",
      opt_out_timestamp: null,
      opt_out_source: null,
      last_opt_out_keyword: null,
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
