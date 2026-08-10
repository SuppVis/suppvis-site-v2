import { randomUUID } from "node:crypto";
import {
  hasCurrentEmailPreview,
  hasCurrentEmailTest,
  hasCurrentSmsPreview,
  hasCurrentSmsTestAccepted,
  hasSavedSmsDraft,
} from "../email/campaign-readiness";
import {
  firstAdminCampaignLinkFields,
  normalizeAdminCampaignLinks,
} from "../messages/admin-campaign";
import type { EmailCampaignRecord } from "../persistence";

export function isReusableEmailCampaign(record: EmailCampaignRecord) {
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

export function deriveReusableEmailCampaignDraft(input: {
  adminIdentifier: string;
  id?: string;
  now: string;
  source: EmailCampaignRecord;
}): EmailCampaignRecord {
  const { adminIdentifier, now, source } = input;
  const links = normalizeAdminCampaignLinks({
    ctaLabel: source.cta_label,
    ctaUrl: source.cta_url,
    links: source.links,
  });
  const firstLink = firstAdminCampaignLinkFields(links);
  const emailPreviewCurrent = hasCurrentEmailPreview(source);
  const emailTestCurrent = hasCurrentEmailTest(source);
  const smsSaved = hasSavedSmsDraft(source);
  const smsPreviewCurrent = smsSaved && hasCurrentSmsPreview(source);
  const smsTestCurrent = smsSaved && hasCurrentSmsTestAccepted(source);
  const emailDraftVersion = 1;
  const smsDraftVersion = smsSaved ? 1 : 0;
  const readyForReuse =
    emailPreviewCurrent &&
    emailTestCurrent &&
    smsPreviewCurrent &&
    smsTestCurrent;

  return {
    id: input.id || `email_campaign_${randomUUID()}`,
    record_type: "email_campaign",
    message_type: source.message_type,
    subject: source.subject,
    heading: source.heading,
    body: source.body,
    cta_label: firstLink.ctaLabel,
    cta_url: firstLink.ctaUrl,
    links,
    status: readyForReuse ? "tested" : "draft",
    created_by: adminIdentifier,
    updated_by: adminIdentifier,
    created_at: now,
    updated_at: now,
    version: 1,
    email_draft_version: emailDraftVersion,
    email_preview_generated_at: emailPreviewCurrent ? now : null,
    email_preview_version: emailPreviewCurrent ? emailDraftVersion : 0,
    tested_at: emailTestCurrent ? now : null,
    email_test_version: emailTestCurrent ? emailDraftVersion : 0,
    approved_at: null,
    sent_at: null,
    test_recipient: emailTestCurrent ? source.test_recipient : null,
    test_message_id: emailTestCurrent ? source.test_message_id : null,
    sms_enabled: Boolean(source.sms_enabled),
    sms_body: source.sms_body || "",
    sms_rendered_body: source.sms_rendered_body || "",
    sms_draft_version: smsDraftVersion,
    sms_preview_generated_at: smsPreviewCurrent ? now : null,
    sms_preview_version: smsPreviewCurrent ? smsDraftVersion : 0,
    sms_saved_at: smsSaved ? now : null,
    sms_tested_at: smsTestCurrent ? now : null,
    sms_test_version: smsTestCurrent ? smsDraftVersion : 0,
    sms_test_recipient_id: smsTestCurrent
      ? source.sms_test_recipient_id || null
      : null,
    sms_test_recipient_masked: smsTestCurrent
      ? source.sms_test_recipient_masked || null
      : null,
    sms_test_message_sid: smsTestCurrent
      ? source.sms_test_message_sid || null
      : null,
    sms_test_provider_status: smsTestCurrent
      ? source.sms_test_provider_status || null
      : null,
    sms_test_sender_masked: smsTestCurrent
      ? source.sms_test_sender_masked || null
      : null,
    sms_test_status: smsTestCurrent ? source.sms_test_status || null : null,
    sms_test_transport: smsTestCurrent
      ? source.sms_test_transport || null
      : null,
    sms_test_attempt_id: null,
    sms_test_send_reserved_at: null,
    sms_test_send_reserved_by: null,
    last_sms_test_send_failed_at: null,
    last_sms_test_send_error_code: null,
    sms_character_count: source.sms_character_count || 0,
    sms_segment_count: source.sms_segment_count || 0,
    sms_encoding: source.sms_encoding || "GSM-7",
    sms_updated_by: adminIdentifier,
    sms_updated_at: smsSaved ? now : null,
    audience_counted_at: null,
    audience_version: 0,
    audience_email_total: 0,
    audience_email_eligible: 0,
    audience_email_excluded: 0,
    audience_email_duplicate_count: 0,
    audience_email_status: "not_counted",
    audience_email_error_code: null,
    audience_sms_total: 0,
    audience_sms_eligible: 0,
    audience_sms_excluded: 0,
    audience_sms_duplicate_count: 0,
    audience_sms_status: "not_counted",
    audience_sms_error_code: null,
    audience_both_eligible: null,
    audience_last_error_code: null,
    audience_last_error_at: null,
    audience_segment: source.audience_segment || "all",
    custom_audience_subscriber_ids:
      source.audience_segment === "custom"
        ? source.custom_audience_subscriber_ids || []
        : [],
    is_pinned: false,
    pinned_at: null,
    pinned_by: null,
  };
}
