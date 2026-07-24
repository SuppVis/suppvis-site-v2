import type { EmailCampaignRecord } from "@/app/lib/server/persistence";

export function emailDraftVersion(campaign: EmailCampaignRecord) {
  return campaign.email_draft_version || campaign.version;
}

export function smsDraftVersion(campaign: EmailCampaignRecord) {
  return campaign.sms_draft_version || 0;
}

export function hasCurrentEmailPreview(campaign: EmailCampaignRecord) {
  return Boolean(
    campaign.email_preview_generated_at &&
      campaign.email_preview_version === emailDraftVersion(campaign),
  );
}

export function hasCurrentSmsPreview(campaign: EmailCampaignRecord) {
  return Boolean(
    campaign.sms_enabled &&
      campaign.sms_saved_at &&
      campaign.sms_body &&
      campaign.sms_rendered_body &&
      campaign.sms_preview_generated_at &&
      campaign.sms_preview_version === smsDraftVersion(campaign),
  );
}

export function hasCurrentEmailTest(campaign: EmailCampaignRecord) {
  return Boolean(
    campaign.tested_at &&
      campaign.test_message_id &&
      campaign.email_test_version === emailDraftVersion(campaign),
  );
}

export function hasCurrentSmsTestAccepted(campaign: EmailCampaignRecord) {
  const status = campaign.sms_test_status || "";

  return Boolean(
    campaign.sms_tested_at &&
      campaign.sms_test_message_sid &&
      campaign.sms_test_version === smsDraftVersion(campaign) &&
      (status === "accepted" || status === "delivered"),
  );
}

export function hasCurrentAdminTests(campaign: EmailCampaignRecord) {
  return hasCurrentEmailTest(campaign) && hasCurrentSmsTestAccepted(campaign);
}

export function hasSavedEmailDraft(campaign: EmailCampaignRecord) {
  return Boolean(campaign.subject && campaign.heading && campaign.body);
}

export function hasSavedSmsDraft(campaign: EmailCampaignRecord) {
  return Boolean(
    campaign.sms_enabled &&
      campaign.sms_saved_at &&
      campaign.sms_body &&
      campaign.sms_rendered_body,
  );
}
