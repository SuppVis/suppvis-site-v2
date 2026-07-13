import {
  DYNAMO_TABLE_ENVS,
  getDynamoItem,
  putDynamoItem,
  queryDynamoItems,
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
  legacy_sms_consent?: boolean;
  sms_informational_consent: boolean;
  sms_marketing_consent: boolean;
  sms_consent_version: string;
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

function booleanAttribute(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
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

export type SmsTrackingMessageType =
  | "sms_informational_confirmation"
  | "sms_marketing_confirmation"
  | "sms_mixed_confirmation";

export type SmsSubscriberRecord = {
  id: string;
  phone_number_raw: string;
  phone_number_e164: string;
  status: SmsSubscriberStatus;
  sms_informational_consent: boolean;
  sms_informational_consent_at: string | null;
  sms_marketing_consent: boolean;
  sms_marketing_consent_at: string | null;
  sms_consent_timestamp: string;
  sms_consent_source: string;
  sms_consent_version: string;
  sms_global_opt_out: boolean;
  sms_global_opt_out_at: string | null;
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
    sms_informational_consent:
      booleanAttribute(attributes?.sms_informational_consent) ??
      fallback.sms_informational_consent,
    sms_informational_consent_at:
      stringAttribute(attributes?.sms_informational_consent_at) ||
      fallback.sms_informational_consent_at,
    sms_marketing_consent:
      booleanAttribute(attributes?.sms_marketing_consent) ??
      fallback.sms_marketing_consent,
    sms_marketing_consent_at:
      stringAttribute(attributes?.sms_marketing_consent_at) ||
      fallback.sms_marketing_consent_at,
    sms_consent_timestamp:
      stringAttribute(attributes?.sms_consent_timestamp) ||
      fallback.sms_consent_timestamp,
    sms_consent_source:
      stringAttribute(attributes?.sms_consent_source) ||
      fallback.sms_consent_source,
    sms_consent_version:
      stringAttribute(attributes?.sms_consent_version) ||
      fallback.sms_consent_version,
    sms_global_opt_out:
      booleanAttribute(attributes?.sms_global_opt_out) ??
      fallback.sms_global_opt_out,
    sms_global_opt_out_at:
      stringAttribute(attributes?.sms_global_opt_out_at) ||
      fallback.sms_global_opt_out_at,
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

export type EmailCampaignStatus =
  | "draft"
  | "test_ready"
  | "tested"
  | "approved"
  | "sending"
  | "completed"
  | "canceled";

export type EmailCampaignMessageType =
  | "beta_update"
  | "testflight_update"
  | "feedback_request";

export type EmailCampaignRecord = {
  id: string;
  record_type: "email_campaign";
  message_type: EmailCampaignMessageType;
  subject: string;
  heading: string;
  body: string;
  cta_label: string;
  cta_url: string;
  status: EmailCampaignStatus;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
  version: number;
  tested_at: string | null;
  approved_at: string | null;
  sent_at: string | null;
  test_recipient: string | null;
  test_message_id?: string | null;
  last_test_send_failed_at?: string | null;
  last_test_send_error_code?: string | null;
};

export type EmailCampaignSummary = Pick<
  EmailCampaignRecord,
  | "id"
  | "message_type"
  | "subject"
  | "heading"
  | "status"
  | "created_by"
  | "updated_by"
  | "created_at"
  | "updated_at"
  | "version"
  | "tested_at"
  | "test_recipient"
>;

function numberAttribute(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function emailCampaignStatusAttribute(value: unknown) {
  return value === "draft" ||
    value === "test_ready" ||
    value === "tested" ||
    value === "approved" ||
    value === "sending" ||
    value === "completed" ||
    value === "canceled"
    ? value
    : undefined;
}

function emailCampaignMessageTypeAttribute(value: unknown) {
  return value === "beta_update" ||
    value === "testflight_update" ||
    value === "feedback_request"
    ? value
    : undefined;
}

function nullableStringAttribute(value: unknown) {
  return value === null ? null : stringAttribute(value);
}

function emailCampaignFromAttributes(
  attributes: Record<string, unknown> | undefined,
): EmailCampaignRecord | null {
  const id = stringAttribute(attributes?.id);
  const messageType = emailCampaignMessageTypeAttribute(attributes?.message_type);
  const subject = stringAttribute(attributes?.subject);
  const heading = stringAttribute(attributes?.heading);
  const body = stringAttribute(attributes?.body);
  const status = emailCampaignStatusAttribute(attributes?.status);
  const createdBy = stringAttribute(attributes?.created_by);
  const updatedBy = stringAttribute(attributes?.updated_by);
  const createdAt = stringAttribute(attributes?.created_at);
  const updatedAt = stringAttribute(attributes?.updated_at);
  const version = numberAttribute(attributes?.version);

  if (
    !id ||
    !messageType ||
    !subject ||
    !heading ||
    body === undefined ||
    !status ||
    !createdBy ||
    !updatedBy ||
    !createdAt ||
    !updatedAt ||
    !version
  ) {
    return null;
  }

  return {
    id,
    record_type: "email_campaign",
    message_type: messageType,
    subject,
    heading,
    body,
    cta_label: stringAttribute(attributes?.cta_label) || "",
    cta_url: stringAttribute(attributes?.cta_url) || "",
    status,
    created_by: createdBy,
    updated_by: updatedBy,
    created_at: createdAt,
    updated_at: updatedAt,
    version,
    tested_at: nullableStringAttribute(attributes?.tested_at) || null,
    approved_at: nullableStringAttribute(attributes?.approved_at) || null,
    sent_at: nullableStringAttribute(attributes?.sent_at) || null,
    test_recipient: nullableStringAttribute(attributes?.test_recipient) || null,
    test_message_id: nullableStringAttribute(attributes?.test_message_id) || null,
    last_test_send_failed_at:
      nullableStringAttribute(attributes?.last_test_send_failed_at) || null,
    last_test_send_error_code:
      nullableStringAttribute(attributes?.last_test_send_error_code) || null,
  };
}

function emailCampaignSummary(record: EmailCampaignRecord): EmailCampaignSummary {
  return {
    id: record.id,
    message_type: record.message_type,
    subject: record.subject,
    heading: record.heading,
    status: record.status,
    created_by: record.created_by,
    updated_by: record.updated_by,
    created_at: record.created_at,
    updated_at: record.updated_at,
    version: record.version,
    tested_at: record.tested_at,
    test_recipient: record.test_recipient,
  };
}

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
      legacy_sms_consent: record.legacy_sms_consent,
      sms_informational_consent: record.sms_informational_consent,
      sms_marketing_consent: record.sms_marketing_consent,
      sms_consent_version: record.sms_consent_version,
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
      sms_informational_consent: record.sms_informational_consent,
      sms_informational_consent_at: record.sms_informational_consent_at,
      sms_marketing_consent: record.sms_marketing_consent,
      sms_marketing_consent_at: record.sms_marketing_consent_at,
      sms_consent_timestamp: record.sms_consent_timestamp,
      sms_consent_source: record.sms_consent_source,
      sms_consent_version: record.sms_consent_version,
      sms_global_opt_out: record.sms_global_opt_out,
      sms_global_opt_out_at: record.sms_global_opt_out_at,
      opt_out_timestamp: record.opt_out_timestamp,
      opt_out_source: record.opt_out_source,
      last_opt_out_keyword: record.last_opt_out_keyword,
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
      sms_global_opt_out: status === "opt_out_provider" ? true : undefined,
      sms_global_opt_out_at:
        status === "opt_out_provider" ? input.now : undefined,
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
      sms_global_opt_out: isProviderOptOut ? true : undefined,
      sms_global_opt_out_at: isProviderOptOut ? input.now : undefined,
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
      sms_global_opt_out: false,
      sms_global_opt_out_at: null,
      opt_out_timestamp: null,
      opt_out_source: null,
      last_opt_out_keyword: null,
      resubscribed_at: input.now,
      updated_at: input.now,
    },
    conditionExpression:
      "attribute_exists(#id) AND (#status = :unsubscribed OR #status = :providerOptOut OR #globalOptOut = :true)",
    conditionAttributeNames: {
      "#id": "id",
      "#status": "status",
      "#globalOptOut": "sms_global_opt_out",
    },
    conditionAttributeValues: {
      ":unsubscribed": "unsubscribed",
      ":providerOptOut": "opt_out_provider",
      ":true": true,
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
      sms_global_opt_out: true,
      sms_global_opt_out_at: input.now,
      opt_out_timestamp: input.now,
      opt_out_source: "sms_stop",
      last_opt_out_keyword: input.keyword,
      updated_at: input.now,
    },
    setIfNotExists: {
      id: input.id,
      sms_informational_consent: false,
      sms_marketing_consent: false,
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
      sms_global_opt_out: false,
      sms_global_opt_out_at: null,
      opt_out_timestamp: null,
      opt_out_source: null,
      last_opt_out_keyword: input.keyword,
      resubscribed_at: input.now,
      updated_at: input.now,
    },
    setIfNotExists: {
      id: input.id,
      sms_informational_consent: false,
      sms_marketing_consent: false,
      created_at: input.now,
    },
  });
}

export function canSendEmailToSubscriber(record: { status?: string }) {
  return record.status === "subscribed";
}

export function canSendSmsToSubscriber(
  record: {
    sms_global_opt_out?: boolean;
    sms_informational_consent?: boolean;
    sms_marketing_consent?: boolean;
    status?: string;
  },
  category: "informational" | "marketing" | "both",
) {
  if (record.sms_global_opt_out) {
    return false;
  }

  if (category === "informational" && !record.sms_informational_consent) {
    return false;
  }

  if (category === "marketing" && !record.sms_marketing_consent) {
    return false;
  }

  if (
    category === "both" &&
    (!record.sms_informational_consent || !record.sms_marketing_consent)
  ) {
    return false;
  }

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

export async function createEmailCampaignDraft(record: EmailCampaignRecord) {
  const result = await upsertDynamoItem({
    tableEnvName: DYNAMO_TABLE_ENVS.emailCampaigns,
    key: { id: record.id },
    operation: "create_email_campaign_draft",
    conditionAttributeNotExists: ["id"],
    returnValues: "ALL_NEW",
    set: {
      record_type: record.record_type,
      message_type: record.message_type,
      subject: record.subject,
      heading: record.heading,
      body: record.body,
      cta_label: record.cta_label,
      cta_url: record.cta_url,
      status: record.status,
      created_by: record.created_by,
      updated_by: record.updated_by,
      created_at: record.created_at,
      updated_at: record.updated_at,
      version: record.version,
      tested_at: record.tested_at,
      approved_at: record.approved_at,
      sent_at: record.sent_at,
      test_recipient: record.test_recipient,
    },
  });

  return result.wrote;
}

export async function getEmailCampaign(id: string) {
  const item = await getDynamoItem({
    tableEnvName: DYNAMO_TABLE_ENVS.emailCampaigns,
    key: { id },
    operation: "get_email_campaign",
  });

  return emailCampaignFromAttributes(item);
}

export async function listRecentEmailCampaignDrafts(limit = 20) {
  const items = await queryDynamoItems({
    tableEnvName: DYNAMO_TABLE_ENVS.emailCampaigns,
    indexName: "record_type-updated_at-index",
    keyConditionExpression: "#recordType = :recordType",
    expressionAttributeNames: {
      "#recordType": "record_type",
    },
    expressionAttributeValues: {
      ":recordType": "email_campaign",
    },
    limit,
    scanIndexForward: false,
    operation: "list_recent_email_campaigns",
  });

  return items
    .map((item) => emailCampaignFromAttributes(item))
    .filter((record): record is EmailCampaignRecord => Boolean(record))
    .map(emailCampaignSummary);
}

export async function updateEmailCampaignDraft(input: {
  body: string;
  cta_label: string;
  cta_url: string;
  expectedVersion: number;
  heading: string;
  id: string;
  message_type: EmailCampaignMessageType;
  now: string;
  subject: string;
  updated_by: string;
}) {
  const nextVersion = input.expectedVersion + 1;
  const result = await updateDynamoItem({
    tableEnvName: DYNAMO_TABLE_ENVS.emailCampaigns,
    key: { id: input.id },
    operation: "update_email_campaign_draft",
    returnValues: "ALL_NEW",
    set: {
      message_type: input.message_type,
      subject: input.subject,
      heading: input.heading,
      body: input.body,
      cta_label: input.cta_label,
      cta_url: input.cta_url,
      status: "draft",
      updated_by: input.updated_by,
      updated_at: input.now,
      version: nextVersion,
    },
    conditionExpression:
      "attribute_exists(#id) AND #version = :expectedVersion AND (#status = :draft OR #status = :testReady OR #status = :tested)",
    conditionAttributeNames: {
      "#id": "id",
      "#version": "version",
      "#status": "status",
    },
    conditionAttributeValues: {
      ":expectedVersion": input.expectedVersion,
      ":draft": "draft",
      ":testReady": "test_ready",
      ":tested": "tested",
    },
  });

  return result.wrote
    ? emailCampaignFromAttributes(result.attributes)
    : null;
}

export async function markEmailCampaignTestReady(input: {
  expectedVersion: number;
  id: string;
  now: string;
  test_recipient: string;
  updated_by: string;
}) {
  const nextVersion = input.expectedVersion + 1;
  const result = await updateDynamoItem({
    tableEnvName: DYNAMO_TABLE_ENVS.emailCampaigns,
    key: { id: input.id },
    operation: "mark_email_campaign_test_ready",
    returnValues: "ALL_NEW",
    set: {
      status: "test_ready",
      test_recipient: input.test_recipient,
      updated_by: input.updated_by,
      updated_at: input.now,
      version: nextVersion,
    },
    conditionExpression:
      "attribute_exists(#id) AND #version = :expectedVersion AND (#status = :draft OR #status = :testReady OR #status = :tested)",
    conditionAttributeNames: {
      "#id": "id",
      "#version": "version",
      "#status": "status",
    },
    conditionAttributeValues: {
      ":expectedVersion": input.expectedVersion,
      ":draft": "draft",
      ":testReady": "test_ready",
      ":tested": "tested",
    },
  });

  return result.wrote
    ? emailCampaignFromAttributes(result.attributes)
    : null;
}

export async function markEmailCampaignTestSent(input: {
  expectedVersion: number;
  id: string;
  messageId?: string;
  now: string;
  test_recipient: string;
  updated_by: string;
}) {
  const nextVersion = input.expectedVersion + 1;
  const result = await updateDynamoItem({
    tableEnvName: DYNAMO_TABLE_ENVS.emailCampaigns,
    key: { id: input.id },
    operation: "mark_email_campaign_test_sent",
    returnValues: "ALL_NEW",
    set: {
      status: "tested",
      tested_at: input.now,
      test_recipient: input.test_recipient,
      test_message_id: input.messageId,
      updated_by: input.updated_by,
      updated_at: input.now,
      version: nextVersion,
    },
    conditionExpression:
      "attribute_exists(#id) AND #version = :expectedVersion AND (#status = :draft OR #status = :testReady OR #status = :tested)",
    conditionAttributeNames: {
      "#id": "id",
      "#version": "version",
      "#status": "status",
    },
    conditionAttributeValues: {
      ":expectedVersion": input.expectedVersion,
      ":draft": "draft",
      ":testReady": "test_ready",
      ":tested": "tested",
    },
  });

  return result.wrote
    ? emailCampaignFromAttributes(result.attributes)
    : null;
}

export async function markEmailCampaignTestFailed(input: {
  errorCode: string;
  expectedVersion: number;
  id: string;
  now: string;
  updated_by: string;
}) {
  const nextVersion = input.expectedVersion + 1;
  const result = await updateDynamoItem({
    tableEnvName: DYNAMO_TABLE_ENVS.emailCampaigns,
    key: { id: input.id },
    operation: "mark_email_campaign_test_failed",
    returnValues: "ALL_NEW",
    set: {
      status: "test_ready",
      last_test_send_failed_at: input.now,
      last_test_send_error_code: input.errorCode,
      updated_by: input.updated_by,
      updated_at: input.now,
      version: nextVersion,
    },
    conditionExpression:
      "attribute_exists(#id) AND #version = :expectedVersion AND #status = :testReady",
    conditionAttributeNames: {
      "#id": "id",
      "#version": "version",
      "#status": "status",
    },
    conditionAttributeValues: {
      ":expectedVersion": input.expectedVersion,
      ":testReady": "test_ready",
    },
  });

  return result.wrote
    ? emailCampaignFromAttributes(result.attributes)
    : null;
}
