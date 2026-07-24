import {
  DYNAMO_TABLE_ENVS,
  getDynamoItem,
  putDynamoItem,
  queryDynamoItems,
  queryDynamoItemsPage,
  scanDynamoItemsPage,
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
  | "queueing"
  | "queued"
  | "sending"
  | "completed"
  | "completed_with_failures"
  | "canceled"
  | "failed";

export type EmailCampaignMessageType =
  | "beta_update"
  | "testflight_update"
  | "product_update"
  | "important_notice"
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
  email_draft_version?: number;
  email_preview_generated_at?: string | null;
  email_preview_version?: number;
  tested_at: string | null;
  email_test_version?: number;
  approved_at: string | null;
  approved_by?: string | null;
  queueing_started_at?: string | null;
  queued_at?: string | null;
  queued_by?: string | null;
  sent_at: string | null;
  completed_at?: string | null;
  canceled_at?: string | null;
  failed_at?: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
  recipient_count?: number;
  eligible_count?: number;
  excluded_count?: number;
  queued_count?: number;
  sent_count?: number;
  delivered_count?: number;
  delivery_delay_count?: number;
  bounced_count?: number;
  complained_count?: number;
  rejected_count?: number;
  failed_count?: number;
  skipped_count?: number;
  test_recipient: string | null;
  test_message_id?: string | null;
  last_test_send_failed_at?: string | null;
  last_test_send_error_code?: string | null;
  sms_enabled?: boolean;
  sms_body?: string;
  sms_rendered_body?: string;
  sms_draft_version?: number;
  sms_preview_generated_at?: string | null;
  sms_preview_version?: number;
  sms_saved_at?: string | null;
  sms_tested_at?: string | null;
  sms_test_version?: number;
  sms_test_recipient_id?: string | null;
  sms_test_recipient_masked?: string | null;
  sms_test_message_sid?: string | null;
  sms_test_provider_status?: string | null;
  sms_test_status?: string | null;
  sms_test_attempt_id?: string | null;
  sms_test_send_reserved_at?: string | null;
  sms_test_send_reserved_by?: string | null;
  last_sms_test_send_failed_at?: string | null;
  last_sms_test_send_error_code?: string | null;
  sms_character_count?: number;
  sms_segment_count?: number;
  sms_encoding?: "GSM-7" | "Unicode";
  sms_updated_by?: string | null;
  sms_updated_at?: string | null;
  sms_eligible_count?: number;
  sms_excluded_count?: number;
  sms_duplicate_count?: number;
  is_pinned?: boolean;
  pinned_at?: string | null;
  pinned_by?: string | null;
};

export type EmailCampaignRecipientStatus =
  | "queueing"
  | "queued"
  | "sending"
  | "sent"
  | "delivered"
  | "delivery_delayed"
  | "bounced"
  | "complained"
  | "rejected"
  | "skipped"
  | "failed";

export type EmailCampaignRecipientRecord = {
  campaign_id: string;
  subscriber_id: string;
  record_type: "email_campaign_recipient";
  status: EmailCampaignRecipientStatus;
  eligibility_decision: "eligible" | "excluded";
  skip_reason?: string;
  ses_message_id?: string;
  queued_at?: string;
  send_attempted_at?: string;
  sent_at?: string;
  delivered_at?: string;
  delivery_delay_at?: string;
  bounced_at?: string;
  complained_at?: string;
  rejected_at?: string;
  failed_at?: string;
  retry_count: number;
  safe_failure_code?: string;
  created_at: string;
  updated_at: string;
};

export type CampaignAudienceCount = {
  eligibleCount: number;
  excludedCount: number;
  duplicateCount: number;
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
  | "email_draft_version"
  | "email_preview_generated_at"
  | "email_preview_version"
  | "tested_at"
  | "email_test_version"
  | "approved_at"
  | "queueing_started_at"
  | "queued_at"
  | "sent_at"
  | "completed_at"
  | "canceled_at"
  | "failed_at"
  | "test_recipient"
  | "recipient_count"
  | "queued_count"
  | "sent_count"
  | "delivered_count"
  | "failed_count"
  | "skipped_count"
  | "sms_enabled"
  | "sms_saved_at"
  | "sms_draft_version"
  | "sms_preview_generated_at"
  | "sms_preview_version"
  | "sms_tested_at"
  | "sms_test_version"
  | "sms_test_recipient_id"
  | "sms_test_recipient_masked"
  | "sms_test_message_sid"
  | "sms_test_provider_status"
  | "sms_test_status"
  | "sms_test_attempt_id"
  | "sms_character_count"
  | "sms_segment_count"
  | "sms_encoding"
  | "sms_eligible_count"
  | "sms_excluded_count"
  | "sms_duplicate_count"
  | "is_pinned"
  | "pinned_at"
  | "pinned_by"
>;

function numberAttribute(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function emailCampaignStatusAttribute(value: unknown) {
  return value === "draft" ||
    value === "test_ready" ||
    value === "tested" ||
    value === "approved" ||
    value === "queueing" ||
    value === "queued" ||
    value === "sending" ||
    value === "completed" ||
    value === "completed_with_failures" ||
    value === "canceled" ||
    value === "failed"
    ? value
    : undefined;
}

function emailCampaignRecipientStatusAttribute(value: unknown) {
  return value === "queueing" ||
    value === "queued" ||
    value === "sending" ||
    value === "sent" ||
    value === "delivered" ||
    value === "delivery_delayed" ||
    value === "bounced" ||
    value === "complained" ||
    value === "rejected" ||
    value === "skipped" ||
    value === "failed"
    ? value
    : undefined;
}

function recipientEligibilityAttribute(value: unknown) {
  return value === "eligible" || value === "excluded" ? value : undefined;
}

function emailCampaignMessageTypeAttribute(value: unknown) {
  return value === "beta_update" ||
    value === "testflight_update" ||
    value === "product_update" ||
    value === "important_notice" ||
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
    email_draft_version: numberAttribute(attributes?.email_draft_version) || version,
    email_preview_generated_at:
      nullableStringAttribute(attributes?.email_preview_generated_at) || null,
    email_preview_version: numberAttribute(attributes?.email_preview_version) || 0,
    tested_at: nullableStringAttribute(attributes?.tested_at) || null,
    email_test_version: numberAttribute(attributes?.email_test_version) || 0,
    approved_at: nullableStringAttribute(attributes?.approved_at) || null,
    approved_by: nullableStringAttribute(attributes?.approved_by) || null,
    queueing_started_at:
      nullableStringAttribute(attributes?.queueing_started_at) || null,
    queued_at: nullableStringAttribute(attributes?.queued_at) || null,
    queued_by: nullableStringAttribute(attributes?.queued_by) || null,
    sent_at: nullableStringAttribute(attributes?.sent_at) || null,
    completed_at: nullableStringAttribute(attributes?.completed_at) || null,
    canceled_at: nullableStringAttribute(attributes?.canceled_at) || null,
    failed_at: nullableStringAttribute(attributes?.failed_at) || null,
    deleted_at: nullableStringAttribute(attributes?.deleted_at) || null,
    deleted_by: nullableStringAttribute(attributes?.deleted_by) || null,
    recipient_count: numberAttribute(attributes?.recipient_count),
    eligible_count: numberAttribute(attributes?.eligible_count),
    excluded_count: numberAttribute(attributes?.excluded_count),
    queued_count: numberAttribute(attributes?.queued_count),
    sent_count: numberAttribute(attributes?.sent_count),
    delivered_count: numberAttribute(attributes?.delivered_count),
    delivery_delay_count: numberAttribute(attributes?.delivery_delay_count),
    bounced_count: numberAttribute(attributes?.bounced_count),
    complained_count: numberAttribute(attributes?.complained_count),
    rejected_count: numberAttribute(attributes?.rejected_count),
    failed_count: numberAttribute(attributes?.failed_count),
    skipped_count: numberAttribute(attributes?.skipped_count),
    test_recipient: nullableStringAttribute(attributes?.test_recipient) || null,
    test_message_id: nullableStringAttribute(attributes?.test_message_id) || null,
    last_test_send_failed_at:
      nullableStringAttribute(attributes?.last_test_send_failed_at) || null,
    last_test_send_error_code:
      nullableStringAttribute(attributes?.last_test_send_error_code) || null,
    sms_enabled: booleanAttribute(attributes?.sms_enabled) || false,
    sms_body: stringAttribute(attributes?.sms_body) || "",
    sms_rendered_body: stringAttribute(attributes?.sms_rendered_body) || "",
    sms_draft_version: numberAttribute(attributes?.sms_draft_version) || 0,
    sms_preview_generated_at:
      nullableStringAttribute(attributes?.sms_preview_generated_at) || null,
    sms_preview_version: numberAttribute(attributes?.sms_preview_version) || 0,
    sms_saved_at: nullableStringAttribute(attributes?.sms_saved_at) || null,
    sms_tested_at: nullableStringAttribute(attributes?.sms_tested_at) || null,
    sms_test_version: numberAttribute(attributes?.sms_test_version) || 0,
    sms_test_recipient_id:
      nullableStringAttribute(attributes?.sms_test_recipient_id) || null,
    sms_test_recipient_masked:
      nullableStringAttribute(attributes?.sms_test_recipient_masked) || null,
    sms_test_message_sid:
      nullableStringAttribute(attributes?.sms_test_message_sid) || null,
    sms_test_provider_status:
      nullableStringAttribute(attributes?.sms_test_provider_status) || null,
    sms_test_status:
      nullableStringAttribute(attributes?.sms_test_status) || null,
    sms_test_attempt_id:
      nullableStringAttribute(attributes?.sms_test_attempt_id) || null,
    sms_test_send_reserved_at:
      nullableStringAttribute(attributes?.sms_test_send_reserved_at) || null,
    sms_test_send_reserved_by:
      nullableStringAttribute(attributes?.sms_test_send_reserved_by) || null,
    last_sms_test_send_failed_at:
      nullableStringAttribute(attributes?.last_sms_test_send_failed_at) || null,
    last_sms_test_send_error_code:
      nullableStringAttribute(attributes?.last_sms_test_send_error_code) || null,
    sms_character_count: numberAttribute(attributes?.sms_character_count) || 0,
    sms_segment_count: numberAttribute(attributes?.sms_segment_count) || 0,
    sms_encoding:
      attributes?.sms_encoding === "Unicode" ? "Unicode" : "GSM-7",
    sms_updated_by: nullableStringAttribute(attributes?.sms_updated_by) || null,
    sms_updated_at: nullableStringAttribute(attributes?.sms_updated_at) || null,
    sms_eligible_count: numberAttribute(attributes?.sms_eligible_count),
    sms_excluded_count: numberAttribute(attributes?.sms_excluded_count),
    sms_duplicate_count: numberAttribute(attributes?.sms_duplicate_count),
    is_pinned: booleanAttribute(attributes?.is_pinned) || false,
    pinned_at: nullableStringAttribute(attributes?.pinned_at) || null,
    pinned_by: nullableStringAttribute(attributes?.pinned_by) || null,
  };
}

function emailCampaignRecipientFromAttributes(
  attributes: Record<string, unknown> | undefined,
): EmailCampaignRecipientRecord | null {
  const campaignId = stringAttribute(attributes?.campaign_id);
  const subscriberId = stringAttribute(attributes?.subscriber_id);
  const status = emailCampaignRecipientStatusAttribute(attributes?.status);
  const eligibilityDecision = recipientEligibilityAttribute(
    attributes?.eligibility_decision,
  );
  const createdAt = stringAttribute(attributes?.created_at);
  const updatedAt = stringAttribute(attributes?.updated_at);

  if (
    !campaignId ||
    !subscriberId ||
    !status ||
    !eligibilityDecision ||
    !createdAt ||
    !updatedAt
  ) {
    return null;
  }

  return {
    campaign_id: campaignId,
    subscriber_id: subscriberId,
    record_type: "email_campaign_recipient",
    status,
    eligibility_decision: eligibilityDecision,
    skip_reason: stringAttribute(attributes?.skip_reason),
    ses_message_id: stringAttribute(attributes?.ses_message_id),
    queued_at: stringAttribute(attributes?.queued_at),
    send_attempted_at: stringAttribute(attributes?.send_attempted_at),
    sent_at: stringAttribute(attributes?.sent_at),
    delivered_at: stringAttribute(attributes?.delivered_at),
    delivery_delay_at: stringAttribute(attributes?.delivery_delay_at),
    bounced_at: stringAttribute(attributes?.bounced_at),
    complained_at: stringAttribute(attributes?.complained_at),
    rejected_at: stringAttribute(attributes?.rejected_at),
    failed_at: stringAttribute(attributes?.failed_at),
    retry_count: numberAttribute(attributes?.retry_count) || 0,
    safe_failure_code: stringAttribute(attributes?.safe_failure_code),
    created_at: createdAt,
    updated_at: updatedAt,
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
    email_draft_version: record.email_draft_version || record.version,
    email_preview_generated_at: record.email_preview_generated_at || null,
    email_preview_version: record.email_preview_version || 0,
    tested_at: record.tested_at,
    email_test_version: record.email_test_version || 0,
    approved_at: record.approved_at,
    queueing_started_at: record.queueing_started_at,
    queued_at: record.queued_at,
    sent_at: record.sent_at,
    completed_at: record.completed_at,
    canceled_at: record.canceled_at,
    failed_at: record.failed_at,
    test_recipient: record.test_recipient,
    recipient_count: record.recipient_count,
    queued_count: record.queued_count,
    sent_count: record.sent_count,
    delivered_count: record.delivered_count,
    failed_count: record.failed_count,
    skipped_count: record.skipped_count,
    sms_enabled: record.sms_enabled,
    sms_saved_at: record.sms_saved_at,
    sms_draft_version: record.sms_draft_version || 0,
    sms_preview_generated_at: record.sms_preview_generated_at || null,
    sms_preview_version: record.sms_preview_version || 0,
    sms_tested_at: record.sms_tested_at,
    sms_test_version: record.sms_test_version || 0,
    sms_test_recipient_id: record.sms_test_recipient_id,
    sms_test_recipient_masked: record.sms_test_recipient_masked,
    sms_test_message_sid: record.sms_test_message_sid,
    sms_test_provider_status: record.sms_test_provider_status,
    sms_test_status: record.sms_test_status,
    sms_test_attempt_id: record.sms_test_attempt_id,
    sms_character_count: record.sms_character_count,
    sms_segment_count: record.sms_segment_count,
    sms_encoding: record.sms_encoding,
    sms_eligible_count: record.sms_eligible_count,
    sms_excluded_count: record.sms_excluded_count,
    sms_duplicate_count: record.sms_duplicate_count,
    is_pinned: record.is_pinned,
    pinned_at: record.pinned_at,
    pinned_by: record.pinned_by,
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

export async function updateBetaApplicationSmsContact(input: {
  id: string;
  phone_raw: string;
  phone_e164: string;
  sms_opt_in: boolean;
  legacy_sms_consent?: boolean;
  sms_informational_consent: boolean;
  sms_marketing_consent: boolean;
  sms_consent_version: string;
  source_page: string;
  updated_at: string;
}) {
  return updateDynamoItem({
    tableEnvName: DYNAMO_TABLE_ENVS.betaApplications,
    key: { id: input.id },
    operation: "update_beta_application_sms_contact",
    set: {
      phone_raw: input.phone_raw,
      phone_e164: input.phone_e164,
      sms_opt_in: input.sms_opt_in,
      legacy_sms_consent: input.legacy_sms_consent,
      sms_informational_consent: input.sms_informational_consent,
      sms_marketing_consent: input.sms_marketing_consent,
      sms_consent_version: input.sms_consent_version,
      source_page: input.source_page,
      updated_at: input.updated_at,
    },
    conditionExpression: "attribute_exists(#id)",
    conditionAttributeNames: {
      "#id": "id",
    },
  });
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

export async function listSmsSubscribersForAnnouncement(limit = 5000) {
  const subscribers: SmsSubscriberRecord[] = [];
  let lastEvaluatedKey: Record<string, unknown> | undefined;

  do {
    const page = await scanDynamoItemsPage({
      tableEnvName: DYNAMO_TABLE_ENVS.smsSubscribers,
      projectionExpression:
        "#id, phone_number_raw, phone_number_e164, #status, sms_informational_consent, sms_marketing_consent, sms_consent_timestamp, sms_consent_source, sms_consent_version, sms_global_opt_out, sms_global_opt_out_at, opt_out_timestamp, opt_out_source, last_opt_out_keyword, resubscribed_at, created_at, updated_at",
      expressionAttributeNames: {
        "#id": "id",
        "#status": "status",
      },
      exclusiveStartKey: lastEvaluatedKey,
      limit: 250,
      operation: "list_sms_subscribers_for_announcement",
    });

    for (const item of page.items) {
      const id = stringAttribute(item.id);
      const phone = stringAttribute(item.phone_number_e164);
      const status = smsSubscriberStatusAttribute(item.status);
      const createdAt = stringAttribute(item.created_at);
      const updatedAt = stringAttribute(item.updated_at);

      if (!id || !phone || !status || !createdAt || !updatedAt) {
        continue;
      }

      subscribers.push(
        smsSubscriberFromAttributes(item, {
          id,
          phone_number_raw: stringAttribute(item.phone_number_raw) || phone,
          phone_number_e164: phone,
          status,
          sms_informational_consent:
            booleanAttribute(item.sms_informational_consent) || false,
          sms_informational_consent_at: null,
          sms_marketing_consent:
            booleanAttribute(item.sms_marketing_consent) || false,
          sms_marketing_consent_at: null,
          sms_consent_timestamp:
            stringAttribute(item.sms_consent_timestamp) || createdAt,
          sms_consent_source:
            stringAttribute(item.sms_consent_source) || "unknown",
          sms_consent_version:
            stringAttribute(item.sms_consent_version) || "unknown",
          sms_global_opt_out:
            booleanAttribute(item.sms_global_opt_out) || false,
          sms_global_opt_out_at:
            nullableStringAttribute(item.sms_global_opt_out_at) || null,
          opt_out_timestamp:
            nullableStringAttribute(item.opt_out_timestamp) || null,
          created_at: createdAt,
          updated_at: updatedAt,
        }),
      );

      if (subscribers.length >= limit) {
        return subscribers;
      }
    }

    lastEvaluatedKey = page.lastEvaluatedKey;
  } while (lastEvaluatedKey);

  return subscribers;
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
      email_draft_version: record.email_draft_version || record.version,
      email_preview_generated_at: record.email_preview_generated_at || null,
      email_preview_version: record.email_preview_version || 0,
      tested_at: record.tested_at,
      email_test_version: record.email_test_version || 0,
      approved_at: record.approved_at,
      sent_at: record.sent_at,
      test_recipient: record.test_recipient,
      sms_enabled: record.sms_enabled || false,
      sms_body: record.sms_body || "",
      sms_rendered_body: record.sms_rendered_body || "",
      sms_draft_version: record.sms_draft_version || 0,
      sms_preview_generated_at: record.sms_preview_generated_at || null,
      sms_preview_version: record.sms_preview_version || 0,
      sms_saved_at: record.sms_saved_at || null,
      sms_tested_at: record.sms_tested_at || null,
      sms_test_version: record.sms_test_version || 0,
      sms_test_recipient_id: record.sms_test_recipient_id || null,
      sms_test_recipient_masked: record.sms_test_recipient_masked || null,
      sms_test_message_sid: record.sms_test_message_sid || null,
      sms_test_provider_status: record.sms_test_provider_status || null,
      sms_test_status: record.sms_test_status || null,
      sms_test_attempt_id: record.sms_test_attempt_id || null,
      sms_test_send_reserved_at: record.sms_test_send_reserved_at || null,
      sms_test_send_reserved_by: record.sms_test_send_reserved_by || null,
      last_sms_test_send_failed_at: record.last_sms_test_send_failed_at || null,
      last_sms_test_send_error_code: record.last_sms_test_send_error_code || null,
      sms_character_count: record.sms_character_count || 0,
      sms_segment_count: record.sms_segment_count || 0,
      sms_encoding: record.sms_encoding || "GSM-7",
      sms_updated_by: record.sms_updated_by || null,
      sms_updated_at: record.sms_updated_at || null,
      is_pinned: record.is_pinned || false,
      pinned_at: record.pinned_at || null,
      pinned_by: record.pinned_by || null,
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

async function listEmailCampaignRecordsForRecentSelection(maxRecords = 500) {
  const records: EmailCampaignRecord[] = [];
  let lastEvaluatedKey: Record<string, unknown> | undefined;

  do {
    const page = await queryDynamoItemsPage({
      tableEnvName: DYNAMO_TABLE_ENVS.emailCampaigns,
      indexName: "record_type-updated_at-index",
      keyConditionExpression: "#recordType = :recordType",
      expressionAttributeNames: {
        "#recordType": "record_type",
      },
      expressionAttributeValues: {
        ":recordType": "email_campaign",
      },
      exclusiveStartKey: lastEvaluatedKey,
      limit: 100,
      scanIndexForward: false,
      operation: "list_recent_email_campaigns",
    });

    for (const item of page.items) {
      const record = emailCampaignFromAttributes(item);
      if (record && !record.deleted_at) {
        records.push(record);
      }

      if (records.length >= maxRecords) {
        return records;
      }
    }

    lastEvaluatedKey = page.lastEvaluatedKey;
  } while (lastEvaluatedKey);

  return records;
}

function isActiveEmailCampaignRecord(record: EmailCampaignRecord) {
  return (
    record.status === "draft" ||
    record.status === "test_ready" ||
    record.status === "tested" ||
    (record.status === "approved" &&
      !record.queueing_started_at &&
      !record.queued_at &&
      !record.sent_at)
  );
}

function isSentEmailCampaignRecord(record: EmailCampaignRecord) {
  return (
    record.status === "queueing" ||
    record.status === "queued" ||
    record.status === "sending" ||
    record.status === "completed" ||
    record.status === "completed_with_failures" ||
    record.status === "failed" ||
    Boolean(record.queueing_started_at || record.queued_at || record.sent_at)
  );
}

export async function listRecentEmailCampaignDrafts(limit = 5) {
  const records = (await listEmailCampaignRecordsForRecentSelection()).filter(
    isActiveEmailCampaignRecord,
  );
  const visibleLimit = Math.max(0, Math.min(limit, 5));
  const byUpdatedAtDesc = (a: EmailCampaignRecord, b: EmailCampaignRecord) =>
    b.updated_at.localeCompare(a.updated_at);
  const byPinnedAtDesc = (a: EmailCampaignRecord, b: EmailCampaignRecord) =>
    (b.pinned_at || b.updated_at).localeCompare(a.pinned_at || a.updated_at);
  const pinned = records
    .filter((record) => record.is_pinned)
    .sort(byPinnedAtDesc)
    .slice(0, visibleLimit);
  const unpinned = records
    .filter((record) => !record.is_pinned)
    .sort(byUpdatedAtDesc)
    .slice(0, Math.max(0, visibleLimit - pinned.length));

  return [...pinned, ...unpinned].map(emailCampaignSummary);
}

export async function listSentEmailCampaignSummaries(limit = 50) {
  const records = (await listEmailCampaignRecordsForRecentSelection()).filter(
    isSentEmailCampaignRecord,
  );

  return records
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, Math.max(1, Math.min(limit, 100)))
    .map(emailCampaignSummary);
}

export async function countPinnedEmailCampaigns(exceptId?: string) {
  const records = (await listEmailCampaignRecordsForRecentSelection()).filter(
    isActiveEmailCampaignRecord,
  );
  return records.filter(
    (record) => record.is_pinned && (!exceptId || record.id !== exceptId),
  ).length;
}

export async function setEmailCampaignPinned(input: {
  expectedVersion: number;
  id: string;
  now: string;
  pinned: boolean;
  updated_by: string;
}) {
  if (input.pinned) {
    const pinnedCount = await countPinnedEmailCampaigns(input.id);

    if (pinnedCount >= 5) {
      return { status: "pin_limit" as const, record: null };
    }
  }

  const nextVersion = input.expectedVersion + 1;
  const result = await updateDynamoItem({
    tableEnvName: DYNAMO_TABLE_ENVS.emailCampaigns,
    key: { id: input.id },
    operation: "set_email_campaign_pinned",
    returnValues: "ALL_NEW",
    set: {
      is_pinned: input.pinned,
      pinned_at: input.pinned ? input.now : null,
      pinned_by: input.pinned ? input.updated_by : null,
      updated_by: input.updated_by,
      updated_at: input.now,
      version: nextVersion,
    },
    conditionExpression:
      "attribute_exists(#id) AND #version = :expectedVersion AND (attribute_not_exists(#deletedAt) OR #deletedAt = :deletedAtNull) AND (#status = :draft OR #status = :testReady OR #status = :tested OR (#status = :approved AND (attribute_not_exists(#queueingStartedAt) OR #queueingStartedAt = :deletedAtNull) AND (attribute_not_exists(#queuedAt) OR #queuedAt = :deletedAtNull) AND (attribute_not_exists(#sentAt) OR #sentAt = :deletedAtNull)))",
    conditionAttributeNames: {
      "#id": "id",
      "#version": "version",
      "#deletedAt": "deleted_at",
      "#status": "status",
      "#queueingStartedAt": "queueing_started_at",
      "#queuedAt": "queued_at",
      "#sentAt": "sent_at",
    },
    conditionAttributeValues: {
      ":expectedVersion": input.expectedVersion,
      ":deletedAtNull": null,
      ":draft": "draft",
      ":testReady": "test_ready",
      ":tested": "tested",
      ":approved": "approved",
    },
  });

  if (!result.wrote) {
    return { status: "conflict" as const, record: null };
  }

  return {
    status: "updated" as const,
    record: emailCampaignFromAttributes(result.attributes),
  };
}

export async function updateEmailCampaignEmailDraft(input: {
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
    operation: "update_email_campaign_email_draft",
    returnValues: "ALL_NEW",
    set: {
      message_type: input.message_type,
      subject: input.subject,
      heading: input.heading,
      body: input.body,
      cta_label: input.cta_label,
      cta_url: input.cta_url,
      email_draft_version: nextVersion,
      email_preview_generated_at: null,
      email_preview_version: 0,
      tested_at: null,
      test_recipient: null,
      test_message_id: null,
      email_test_version: 0,
      last_test_send_failed_at: null,
      last_test_send_error_code: null,
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

export async function updateEmailCampaignSmsDraft(input: {
  expectedVersion: number;
  id: string;
  now: string;
  updated_by: string;
  sms_body: string;
  sms_rendered_body: string;
  sms_character_count: number;
  sms_segment_count: number;
  sms_encoding: "GSM-7" | "Unicode";
}) {
  const nextVersion = input.expectedVersion + 1;
  const result = await updateDynamoItem({
    tableEnvName: DYNAMO_TABLE_ENVS.emailCampaigns,
    key: { id: input.id },
    operation: "update_email_campaign_sms_draft",
    returnValues: "ALL_NEW",
    set: {
      sms_enabled: true,
      sms_body: input.sms_body,
      sms_rendered_body: input.sms_rendered_body,
      sms_draft_version: nextVersion,
      sms_preview_generated_at: null,
      sms_preview_version: 0,
      sms_saved_at: input.now,
      sms_tested_at: null,
      sms_test_version: 0,
      sms_test_recipient_id: null,
      sms_test_recipient_masked: null,
      sms_test_message_sid: null,
      sms_test_provider_status: null,
      sms_test_status: null,
      sms_test_attempt_id: null,
      sms_test_send_reserved_at: null,
      sms_test_send_reserved_by: null,
      sms_character_count: input.sms_character_count,
      sms_segment_count: input.sms_segment_count,
      sms_encoding: input.sms_encoding,
      sms_updated_by: input.updated_by,
      sms_updated_at: input.now,
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
  sms_enabled?: boolean;
  sms_body?: string;
  sms_rendered_body?: string;
  sms_character_count?: number;
  sms_segment_count?: number;
  sms_encoding?: "GSM-7" | "Unicode";
}) {
  const nextVersion = input.expectedVersion + 1;
  const smsDraftVersion = input.sms_enabled ? nextVersion : 0;
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
      email_draft_version: nextVersion,
      email_preview_generated_at: null,
      email_preview_version: 0,
      tested_at: null,
      test_recipient: null,
      test_message_id: null,
      email_test_version: 0,
      sms_enabled: Boolean(input.sms_enabled),
      sms_body: input.sms_enabled ? input.sms_body || "" : "",
      sms_rendered_body: input.sms_enabled ? input.sms_rendered_body || "" : "",
      sms_draft_version: smsDraftVersion,
      sms_preview_generated_at: null,
      sms_preview_version: 0,
      sms_saved_at: input.sms_enabled ? input.now : null,
      sms_tested_at: null,
      sms_test_version: 0,
      sms_test_recipient_id: null,
      sms_test_recipient_masked: null,
      sms_test_message_sid: null,
      sms_test_provider_status: null,
      sms_test_status: null,
      sms_test_attempt_id: null,
      sms_test_send_reserved_at: null,
      sms_test_send_reserved_by: null,
      sms_character_count: input.sms_enabled ? input.sms_character_count || 0 : 0,
      sms_segment_count: input.sms_enabled ? input.sms_segment_count || 0 : 0,
      sms_encoding: input.sms_enabled ? input.sms_encoding || "GSM-7" : "GSM-7",
      sms_updated_by: input.sms_enabled ? input.updated_by : null,
      sms_updated_at: input.sms_enabled ? input.now : null,
      sms_eligible_count: input.sms_enabled ? undefined : 0,
      sms_excluded_count: input.sms_enabled ? undefined : 0,
      sms_duplicate_count: input.sms_enabled ? undefined : 0,
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

export async function markEmailCampaignEmailPreviewGenerated(input: {
  draftVersion: number;
  expectedVersion: number;
  id: string;
  now: string;
  updated_by: string;
}) {
  const result = await updateDynamoItem({
    tableEnvName: DYNAMO_TABLE_ENVS.emailCampaigns,
    key: { id: input.id },
    operation: "mark_email_campaign_email_preview_generated",
    returnValues: "ALL_NEW",
    set: {
      email_preview_generated_at: input.now,
      email_preview_version: input.draftVersion,
      updated_by: input.updated_by,
      updated_at: input.now,
    },
    conditionExpression:
      "attribute_exists(#id) AND #version = :expectedVersion AND (attribute_not_exists(#emailDraftVersion) OR #emailDraftVersion = :draftVersion) AND (attribute_not_exists(#deletedAt) OR #deletedAt = :deletedAtNull) AND (#status = :draft OR #status = :testReady OR #status = :tested)",
    conditionAttributeNames: {
      "#id": "id",
      "#version": "version",
      "#emailDraftVersion": "email_draft_version",
      "#deletedAt": "deleted_at",
      "#status": "status",
    },
    conditionAttributeValues: {
      ":expectedVersion": input.expectedVersion,
      ":draftVersion": input.draftVersion,
      ":deletedAtNull": null,
      ":draft": "draft",
      ":testReady": "test_ready",
      ":tested": "tested",
    },
  });

  return result.wrote
    ? emailCampaignFromAttributes(result.attributes)
    : null;
}

export async function markEmailCampaignSmsPreviewGenerated(input: {
  expectedVersion: number;
  id: string;
  now: string;
  smsDraftVersion: number;
  updated_by: string;
}) {
  const result = await updateDynamoItem({
    tableEnvName: DYNAMO_TABLE_ENVS.emailCampaigns,
    key: { id: input.id },
    operation: "mark_email_campaign_sms_preview_generated",
    returnValues: "ALL_NEW",
    set: {
      sms_preview_generated_at: input.now,
      sms_preview_version: input.smsDraftVersion,
      updated_by: input.updated_by,
      updated_at: input.now,
    },
    conditionExpression:
      "attribute_exists(#id) AND #version = :expectedVersion AND (attribute_not_exists(#smsDraftVersion) OR #smsDraftVersion = :smsDraftVersion) AND (attribute_not_exists(#deletedAt) OR #deletedAt = :deletedAtNull) AND (#status = :draft OR #status = :testReady OR #status = :tested)",
    conditionAttributeNames: {
      "#id": "id",
      "#version": "version",
      "#smsDraftVersion": "sms_draft_version",
      "#deletedAt": "deleted_at",
      "#status": "status",
    },
    conditionAttributeValues: {
      ":expectedVersion": input.expectedVersion,
      ":smsDraftVersion": input.smsDraftVersion,
      ":deletedAtNull": null,
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
      tested_at: null,
      email_test_version: 0,
      test_recipient: input.test_recipient,
      test_message_id: null,
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
  draftVersion: number;
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
      email_test_version: input.draftVersion,
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
      tested_at: null,
      email_test_version: 0,
      test_message_id: null,
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

export async function reserveEmailCampaignSmsTest(input: {
  expectedVersion: number;
  id: string;
  now: string;
  test_attempt_id: string;
  test_recipient_id: string;
  test_recipient_masked: string;
  updated_by: string;
}) {
  const nextVersion = input.expectedVersion + 1;
  const result = await updateDynamoItem({
    tableEnvName: DYNAMO_TABLE_ENVS.emailCampaigns,
    key: { id: input.id },
    operation: "reserve_email_campaign_sms_test",
    returnValues: "ALL_NEW",
    set: {
      sms_test_send_reserved_at: input.now,
      sms_test_send_reserved_by: input.updated_by,
      sms_test_recipient_id: input.test_recipient_id,
      sms_test_recipient_masked: input.test_recipient_masked,
      sms_test_status: "sending",
      sms_tested_at: null,
      sms_test_version: 0,
      sms_test_message_sid: null,
      sms_test_provider_status: null,
      sms_test_attempt_id: input.test_attempt_id,
      updated_by: input.updated_by,
      updated_at: input.now,
      version: nextVersion,
    },
    conditionExpression:
      "attribute_exists(#id) AND #version = :expectedVersion AND (attribute_not_exists(#deletedAt) OR #deletedAt = :deletedAtNull) AND (#status = :draft OR #status = :testReady OR #status = :tested)",
    conditionAttributeNames: {
      "#id": "id",
      "#version": "version",
      "#deletedAt": "deleted_at",
      "#status": "status",
    },
    conditionAttributeValues: {
      ":expectedVersion": input.expectedVersion,
      ":deletedAtNull": null,
      ":draft": "draft",
      ":testReady": "test_ready",
      ":tested": "tested",
    },
  });

  return result.wrote
    ? emailCampaignFromAttributes(result.attributes)
    : null;
}

export async function markEmailCampaignSmsTestSent(input: {
  expectedVersion: number;
  id: string;
  messageSid?: string;
  now: string;
  providerStatus?: string;
  smsDraftVersion: number;
  test_attempt_id: string;
  test_recipient_id: string;
  test_recipient_masked: string;
  updated_by: string;
}) {
  const nextVersion = input.expectedVersion + 1;
  const result = await updateDynamoItem({
    tableEnvName: DYNAMO_TABLE_ENVS.emailCampaigns,
    key: { id: input.id },
    operation: "mark_email_campaign_sms_test_sent",
    returnValues: "ALL_NEW",
    set: {
      status: "tested",
      sms_tested_at: input.now,
      sms_test_version: input.smsDraftVersion,
      sms_test_recipient_id: input.test_recipient_id,
      sms_test_recipient_masked: input.test_recipient_masked,
      sms_test_message_sid: input.messageSid,
      sms_test_provider_status: input.providerStatus || null,
      sms_test_status: "accepted",
      sms_test_attempt_id: input.test_attempt_id,
      sms_test_send_reserved_at: null,
      sms_test_send_reserved_by: null,
      updated_by: input.updated_by,
      updated_at: input.now,
      version: nextVersion,
    },
    conditionExpression:
      "attribute_exists(#id) AND #version = :expectedVersion AND (attribute_not_exists(#deletedAt) OR #deletedAt = :deletedAtNull) AND (#status = :draft OR #status = :testReady OR #status = :tested)",
    conditionAttributeNames: {
      "#id": "id",
      "#version": "version",
      "#deletedAt": "deleted_at",
      "#status": "status",
    },
    conditionAttributeValues: {
      ":expectedVersion": input.expectedVersion,
      ":deletedAtNull": null,
      ":draft": "draft",
      ":testReady": "test_ready",
      ":tested": "tested",
    },
  });

  return result.wrote
    ? emailCampaignFromAttributes(result.attributes)
    : null;
}

export async function markEmailCampaignSmsTestFailed(input: {
  errorCode: string;
  expectedVersion: number;
  id: string;
  now: string;
  test_attempt_id?: string;
  updated_by: string;
}) {
  const nextVersion = input.expectedVersion + 1;
  const result = await updateDynamoItem({
    tableEnvName: DYNAMO_TABLE_ENVS.emailCampaigns,
    key: { id: input.id },
    operation: "mark_email_campaign_sms_test_failed",
    returnValues: "ALL_NEW",
    set: {
      last_sms_test_send_failed_at: input.now,
      last_sms_test_send_error_code: input.errorCode,
      sms_tested_at: null,
      sms_test_version: 0,
      sms_test_message_sid: null,
      sms_test_status: "failed",
      sms_test_attempt_id: input.test_attempt_id || null,
      sms_test_send_reserved_at: null,
      sms_test_send_reserved_by: null,
      updated_by: input.updated_by,
      updated_at: input.now,
      version: nextVersion,
    },
    conditionExpression:
      "attribute_exists(#id) AND #version = :expectedVersion AND (attribute_not_exists(#deletedAt) OR #deletedAt = :deletedAtNull)",
    conditionAttributeNames: {
      "#id": "id",
      "#version": "version",
      "#deletedAt": "deleted_at",
    },
    conditionAttributeValues: {
      ":expectedVersion": input.expectedVersion,
      ":deletedAtNull": null,
    },
  });

  return result.wrote
    ? emailCampaignFromAttributes(result.attributes)
    : null;
}

export async function recordEmailCampaignSmsTestProviderStatus(input: {
  id: string;
  messageSid: string;
  now: string;
  providerStatus: string;
}) {
  const testStatus =
    input.providerStatus === "failed" || input.providerStatus === "undelivered"
      ? "failed"
      : input.providerStatus === "delivered"
        ? "delivered"
        : "accepted";
  const result = await updateDynamoItem({
    tableEnvName: DYNAMO_TABLE_ENVS.emailCampaigns,
    key: { id: input.id },
    operation: "record_email_campaign_sms_test_provider_status",
    returnValues: "ALL_NEW",
    set: {
      sms_test_provider_status: input.providerStatus,
      sms_test_status: testStatus,
      updated_at: input.now,
    },
    conditionExpression:
      "attribute_exists(#id) AND #messageSid = :messageSid AND (attribute_not_exists(#deletedAt) OR #deletedAt = :deletedAtNull)",
    conditionAttributeNames: {
      "#id": "id",
      "#messageSid": "sms_test_message_sid",
      "#deletedAt": "deleted_at",
    },
    conditionAttributeValues: {
      ":messageSid": input.messageSid,
      ":deletedAtNull": null,
    },
  });

  return result.wrote
    ? emailCampaignFromAttributes(result.attributes)
    : null;
}

export async function archiveEmailCampaignDraft(input: {
  expectedVersion: number;
  id: string;
  now: string;
  deleted_by: string;
}) {
  const nextVersion = input.expectedVersion + 1;
  const result = await updateDynamoItem({
    tableEnvName: DYNAMO_TABLE_ENVS.emailCampaigns,
    key: { id: input.id },
    operation: "archive_email_campaign_draft",
    returnValues: "ALL_NEW",
    set: {
      deleted_at: input.now,
      deleted_by: input.deleted_by,
      is_pinned: false,
      pinned_at: null,
      pinned_by: null,
      updated_by: input.deleted_by,
      updated_at: input.now,
      version: nextVersion,
    },
    conditionExpression:
      "attribute_exists(#id) AND #version = :expectedVersion AND (attribute_not_exists(#deletedAt) OR #deletedAt = :deletedAtNull) AND (#status = :draft OR #status = :testReady OR #status = :tested OR (#status = :approved AND (attribute_not_exists(#queueingStartedAt) OR #queueingStartedAt = :deletedAtNull) AND (attribute_not_exists(#queuedAt) OR #queuedAt = :deletedAtNull) AND (attribute_not_exists(#sentAt) OR #sentAt = :deletedAtNull) AND (attribute_not_exists(#recipientCount) OR #recipientCount = :zero)))",
    conditionAttributeNames: {
      "#id": "id",
      "#version": "version",
      "#deletedAt": "deleted_at",
      "#status": "status",
      "#queueingStartedAt": "queueing_started_at",
      "#queuedAt": "queued_at",
      "#sentAt": "sent_at",
      "#recipientCount": "recipient_count",
    },
    conditionAttributeValues: {
      ":expectedVersion": input.expectedVersion,
      ":deletedAtNull": null,
      ":draft": "draft",
      ":testReady": "test_ready",
      ":tested": "tested",
      ":approved": "approved",
      ":zero": 0,
    },
  });

  return result.wrote
    ? emailCampaignFromAttributes(result.attributes)
    : null;
}

export async function approveEmailCampaign(input: {
  expectedVersion: number;
  id: string;
  now: string;
  approved_by: string;
}) {
  const nextVersion = input.expectedVersion + 1;
  const result = await updateDynamoItem({
    tableEnvName: DYNAMO_TABLE_ENVS.emailCampaigns,
    key: { id: input.id },
    operation: "approve_email_campaign",
    returnValues: "ALL_NEW",
    set: {
      status: "approved",
      approved_at: input.now,
      approved_by: input.approved_by,
      updated_by: input.approved_by,
      updated_at: input.now,
      version: nextVersion,
    },
    conditionExpression:
      "attribute_exists(#id) AND #version = :expectedVersion AND (attribute_not_exists(#deletedAt) OR #deletedAt = :deletedAtNull) AND #status = :tested",
    conditionAttributeNames: {
      "#id": "id",
      "#version": "version",
      "#deletedAt": "deleted_at",
      "#status": "status",
    },
    conditionAttributeValues: {
      ":expectedVersion": input.expectedVersion,
      ":deletedAtNull": null,
      ":tested": "tested",
    },
  });

  return result.wrote
    ? emailCampaignFromAttributes(result.attributes)
    : null;
}

export async function markEmailCampaignQueueing(input: {
  expectedVersion: number;
  id: string;
  now: string;
  queued_by: string;
}) {
  const nextVersion = input.expectedVersion + 1;
  const result = await updateDynamoItem({
    tableEnvName: DYNAMO_TABLE_ENVS.emailCampaigns,
    key: { id: input.id },
    operation: "mark_email_campaign_queueing",
    returnValues: "ALL_NEW",
    set: {
      status: "queueing",
      queueing_started_at: input.now,
      queued_by: input.queued_by,
      updated_by: input.queued_by,
      updated_at: input.now,
      version: nextVersion,
      recipient_count: 0,
      eligible_count: 0,
      excluded_count: 0,
      queued_count: 0,
      sent_count: 0,
      delivered_count: 0,
      delivery_delay_count: 0,
      bounced_count: 0,
      complained_count: 0,
      rejected_count: 0,
      failed_count: 0,
      skipped_count: 0,
    },
    conditionExpression:
      "attribute_exists(#id) AND #version = :expectedVersion AND (attribute_not_exists(#deletedAt) OR #deletedAt = :deletedAtNull) AND #status = :approved",
    conditionAttributeNames: {
      "#id": "id",
      "#version": "version",
      "#deletedAt": "deleted_at",
      "#status": "status",
    },
    conditionAttributeValues: {
      ":expectedVersion": input.expectedVersion,
      ":deletedAtNull": null,
      ":approved": "approved",
    },
  });

  return result.wrote
    ? emailCampaignFromAttributes(result.attributes)
    : null;
}

export async function markEmailCampaignQueued(input: {
  id: string;
  now: string;
  updated_by: string;
  eligibleCount: number;
  excludedCount: number;
  queuedCount: number;
}) {
  const result = await updateDynamoItem({
    tableEnvName: DYNAMO_TABLE_ENVS.emailCampaigns,
    key: { id: input.id },
    operation: "mark_email_campaign_queued",
    returnValues: "ALL_NEW",
    set: {
      status: "queued",
      queued_at: input.now,
      updated_by: input.updated_by,
      updated_at: input.now,
      recipient_count: input.eligibleCount + input.excludedCount,
      eligible_count: input.eligibleCount,
      excluded_count: input.excludedCount,
      queued_count: input.queuedCount,
      skipped_count: input.excludedCount,
    },
    conditionExpression: "attribute_exists(#id) AND #status = :queueing",
    conditionAttributeNames: {
      "#id": "id",
      "#status": "status",
    },
    conditionAttributeValues: {
      ":queueing": "queueing",
    },
  });

  return result.wrote
    ? emailCampaignFromAttributes(result.attributes)
    : null;
}

export async function markEmailCampaignQueueFailed(input: {
  id: string;
  now: string;
  updated_by: string;
  failureCode: string;
}) {
  const result = await updateDynamoItem({
    tableEnvName: DYNAMO_TABLE_ENVS.emailCampaigns,
    key: { id: input.id },
    operation: "mark_email_campaign_queue_failed",
    returnValues: "ALL_NEW",
    set: {
      status: "failed",
      failed_at: input.now,
      last_queue_failure_code: input.failureCode,
      updated_by: input.updated_by,
      updated_at: input.now,
    },
    conditionExpression: "attribute_exists(#id) AND #status = :queueing",
    conditionAttributeNames: {
      "#id": "id",
      "#status": "status",
    },
    conditionAttributeValues: {
      ":queueing": "queueing",
    },
  });

  return result.wrote
    ? emailCampaignFromAttributes(result.attributes)
    : null;
}

export async function createEmailCampaignRecipient(input: {
  campaignId: string;
  subscriberId: string;
  now: string;
  status: EmailCampaignRecipientStatus;
  eligibilityDecision: "eligible" | "excluded";
  skipReason?: string;
}) {
  const result = await updateDynamoItem({
    tableEnvName: DYNAMO_TABLE_ENVS.emailCampaignRecipients,
    key: {
      campaign_id: input.campaignId,
      subscriber_id: input.subscriberId,
    },
    operation: "create_email_campaign_recipient",
    returnValues: "ALL_NEW",
    set: {
      record_type: "email_campaign_recipient",
      status: input.status,
      eligibility_decision: input.eligibilityDecision,
      skip_reason: input.skipReason,
      retry_count: 0,
      created_at: input.now,
      updated_at: input.now,
    },
    conditionExpression:
      "attribute_not_exists(#campaignId) AND attribute_not_exists(#subscriberId)",
    conditionAttributeNames: {
      "#campaignId": "campaign_id",
      "#subscriberId": "subscriber_id",
    },
  });

  return result.wrote
    ? emailCampaignRecipientFromAttributes(result.attributes)
    : null;
}

export async function markEmailCampaignRecipientQueued(input: {
  campaignId: string;
  subscriberId: string;
  now: string;
  sqsMessageId?: string;
}) {
  const result = await updateDynamoItem({
    tableEnvName: DYNAMO_TABLE_ENVS.emailCampaignRecipients,
    key: {
      campaign_id: input.campaignId,
      subscriber_id: input.subscriberId,
    },
    operation: "mark_email_campaign_recipient_queued",
    returnValues: "ALL_NEW",
    set: {
      status: "queued",
      queued_at: input.now,
      sqs_message_id: input.sqsMessageId,
      updated_at: input.now,
    },
    conditionExpression:
      "attribute_exists(#campaignId) AND attribute_exists(#subscriberId) AND #status = :queueing",
    conditionAttributeNames: {
      "#campaignId": "campaign_id",
      "#subscriberId": "subscriber_id",
      "#status": "status",
    },
    conditionAttributeValues: {
      ":queueing": "queueing",
    },
  });

  return result.wrote
    ? emailCampaignRecipientFromAttributes(result.attributes)
    : null;
}

export async function listEmailCampaignRecipients(campaignId: string) {
  let exclusiveStartKey: Record<string, unknown> | undefined;
  const recipients: EmailCampaignRecipientRecord[] = [];

  do {
    const page = await queryDynamoItemsPage({
      tableEnvName: DYNAMO_TABLE_ENVS.emailCampaignRecipients,
      keyConditionExpression: "#campaignId = :campaignId",
      expressionAttributeNames: {
        "#campaignId": "campaign_id",
      },
      expressionAttributeValues: {
        ":campaignId": campaignId,
      },
      exclusiveStartKey,
      operation: "list_email_campaign_recipients",
    });

    for (const item of page.items) {
      const recipient = emailCampaignRecipientFromAttributes(item);
      if (recipient) {
        recipients.push(recipient);
      }
    }

    exclusiveStartKey = page.lastEvaluatedKey;
  } while (exclusiveStartKey);

  return recipients;
}

function emailSubscriberFromCampaignAttributes(
  attributes: Record<string, unknown> | undefined,
) {
  const id = stringAttribute(attributes?.id);
  const email = stringAttribute(attributes?.email);
  const normalizedEmail = stringAttribute(attributes?.normalized_email);
  const status = emailSubscriberStatusAttribute(attributes?.status);
  const consentTimestamp = stringAttribute(attributes?.consent_timestamp);
  const consentSource = stringAttribute(attributes?.consent_source);
  const createdAt = stringAttribute(attributes?.created_at);
  const updatedAt = stringAttribute(attributes?.updated_at);
  const unsubscribeToken = stringAttribute(attributes?.unsubscribe_token);

  if (
    !id ||
    !normalizedEmail ||
    !status
  ) {
    return null;
  }

  return {
    id,
    email: email || normalizedEmail,
    normalized_email: normalizedEmail,
    status,
    consent_timestamp: consentTimestamp || "",
    consent_source: consentSource || "",
    created_at: createdAt || "",
    updated_at: updatedAt || "",
    unsubscribe_token: unsubscribeToken || "",
  };
}

export async function listEmailSubscribersByStatus(statuses: EmailSubscriberRecord["status"][]) {
  const subscribers: EmailSubscriberRecord[] = [];

  for (const status of statuses) {
    let exclusiveStartKey: Record<string, unknown> | undefined;

    do {
      const page = await queryDynamoItemsPage({
        tableEnvName: DYNAMO_TABLE_ENVS.emailSubscribers,
        indexName: "status-updated_at-index",
        keyConditionExpression: "#status = :status",
        expressionAttributeNames: {
          "#status": "status",
        },
        expressionAttributeValues: {
          ":status": status,
        },
        exclusiveStartKey,
        operation: "list_email_subscribers_by_status",
      });

      for (const item of page.items) {
        const subscriber = emailSubscriberFromCampaignAttributes(item);
        if (subscriber) {
          subscribers.push(subscriber as EmailSubscriberRecord);
        }
      }

      exclusiveStartKey = page.lastEvaluatedKey;
    } while (exclusiveStartKey);
  }

  return subscribers;
}
