import type { EmailCampaignRecord } from "@/app/lib/server/persistence";

export type EmailCampaignReadinessReason =
  | "email_draft_missing"
  | "text_draft_missing"
  | "email_preview_missing"
  | "email_preview_stale"
  | "text_preview_missing"
  | "text_preview_stale"
  | "email_test_missing"
  | "email_test_stale"
  | "text_test_missing"
  | "text_test_stale"
  | "audience_missing"
  | "audience_stale";

export type EmailCampaignReadiness = {
  email_saved_current: boolean;
  text_saved_current: boolean;
  email_preview_current: boolean;
  text_preview_current: boolean;
  email_test_current: boolean;
  text_test_current: boolean;
  audience_current: boolean;
  ready_for_recipient_refresh: boolean;
  ready_for_final_send: boolean;
  reason_codes: EmailCampaignReadinessReason[];
};

type EmailCampaignReadinessSource = Pick<
  EmailCampaignRecord,
  | "version"
  | "email_draft_version"
  | "email_preview_generated_at"
  | "email_preview_version"
  | "tested_at"
  | "email_test_version"
  | "test_message_id"
  | "sms_enabled"
  | "sms_saved_at"
  | "sms_draft_version"
  | "sms_preview_generated_at"
  | "sms_preview_version"
  | "sms_tested_at"
  | "sms_test_version"
  | "sms_test_message_sid"
  | "sms_test_status"
  | "sms_test_transport"
  | "audience_counted_at"
  | "audience_version"
  | "audience_email_status"
  | "audience_sms_status"
> &
  Partial<
    Pick<
      EmailCampaignRecord,
      "subject" | "heading" | "body" | "sms_body" | "sms_rendered_body"
    >
  >;

export function emailDraftVersion(campaign: EmailCampaignReadinessSource) {
  return campaign.email_draft_version || campaign.version;
}

export function smsDraftVersion(campaign: EmailCampaignReadinessSource) {
  return campaign.sms_draft_version || 0;
}

export function hasCurrentEmailPreview(campaign: EmailCampaignReadinessSource) {
  return Boolean(
    campaign.email_preview_generated_at &&
      campaign.email_preview_version === emailDraftVersion(campaign),
  );
}

export function hasCurrentSmsPreview(campaign: EmailCampaignReadinessSource) {
  return Boolean(
    campaign.sms_enabled &&
      campaign.sms_saved_at &&
      hasSavedSmsDraft(campaign) &&
      campaign.sms_preview_generated_at &&
      campaign.sms_preview_version === smsDraftVersion(campaign),
  );
}

export function hasCurrentEmailTest(campaign: EmailCampaignReadinessSource) {
  return Boolean(
    campaign.tested_at &&
      campaign.test_message_id &&
      campaign.email_test_version === emailDraftVersion(campaign),
  );
}

export function hasCurrentSmsTestAccepted(campaign: EmailCampaignReadinessSource) {
  const status = campaign.sms_test_status || "";

  return Boolean(
    campaign.sms_tested_at &&
      campaign.sms_test_message_sid &&
      campaign.sms_test_version === smsDraftVersion(campaign) &&
      campaign.sms_test_transport === "sms" &&
      (status === "accepted" || status === "delivered"),
  );
}

export function hasCurrentAdminTests(campaign: EmailCampaignRecord) {
  return hasCurrentEmailTest(campaign) && hasCurrentSmsTestAccepted(campaign);
}

export function hasSavedEmailDraft(campaign: EmailCampaignReadinessSource) {
  if (campaign.body !== undefined) {
    return Boolean(campaign.subject && campaign.heading && campaign.body);
  }

  return Boolean(campaign.subject && campaign.heading && emailDraftVersion(campaign));
}

export function hasSavedSmsDraft(campaign: EmailCampaignReadinessSource) {
  if (campaign.sms_body !== undefined || campaign.sms_rendered_body !== undefined) {
    return Boolean(
      campaign.sms_enabled &&
        campaign.sms_saved_at &&
        campaign.sms_body &&
        campaign.sms_rendered_body,
    );
  }

  return Boolean(
    campaign.sms_enabled &&
      campaign.sms_saved_at &&
      smsDraftVersion(campaign),
  );
}

export function hasCurrentAudienceSnapshot(campaign: EmailCampaignReadinessSource) {
  return Boolean(
    campaign.audience_counted_at &&
      campaign.audience_version === campaign.version &&
      (campaign.audience_email_status === "success" ||
        campaign.audience_sms_status === "success"),
  );
}

export function getEmailCampaignReadiness(
  campaign: EmailCampaignReadinessSource,
): EmailCampaignReadiness {
  const emailSavedCurrent = hasSavedEmailDraft(campaign);
  const textSavedCurrent = hasSavedSmsDraft(campaign);
  const emailPreviewCurrent = hasCurrentEmailPreview(campaign);
  const textPreviewCurrent = hasCurrentSmsPreview(campaign);
  const emailTestCurrent = hasCurrentEmailTest(campaign);
  const textTestCurrent = hasCurrentSmsTestAccepted(campaign);
  const audienceCurrent = hasCurrentAudienceSnapshot(campaign);
  const reasonCodes: EmailCampaignReadinessReason[] = [];

  if (!emailSavedCurrent) {
    reasonCodes.push("email_draft_missing");
  }

  if (!textSavedCurrent) {
    reasonCodes.push("text_draft_missing");
  }

  if (!emailPreviewCurrent) {
    reasonCodes.push(
      campaign.email_preview_generated_at
        ? "email_preview_stale"
        : "email_preview_missing",
    );
  }

  if (!textPreviewCurrent) {
    reasonCodes.push(
      campaign.sms_preview_generated_at
        ? "text_preview_stale"
        : "text_preview_missing",
    );
  }

  if (!emailTestCurrent) {
    reasonCodes.push(
      campaign.tested_at || campaign.test_message_id
        ? "email_test_stale"
        : "email_test_missing",
    );
  }

  if (!textTestCurrent) {
    reasonCodes.push(
      campaign.sms_tested_at || campaign.sms_test_message_sid
        ? "text_test_stale"
        : "text_test_missing",
    );
  }

  if (!audienceCurrent) {
    reasonCodes.push(
      campaign.audience_counted_at ? "audience_stale" : "audience_missing",
    );
  }

  const readyForRecipientRefresh =
    emailSavedCurrent &&
    textSavedCurrent &&
    emailPreviewCurrent &&
    textPreviewCurrent &&
    emailTestCurrent &&
    textTestCurrent;

  return {
    email_saved_current: emailSavedCurrent,
    text_saved_current: textSavedCurrent,
    email_preview_current: emailPreviewCurrent,
    text_preview_current: textPreviewCurrent,
    email_test_current: emailTestCurrent,
    text_test_current: textTestCurrent,
    audience_current: audienceCurrent,
    ready_for_recipient_refresh: readyForRecipientRefresh,
    ready_for_final_send: readyForRecipientRefresh && audienceCurrent,
    reason_codes: reasonCodes,
  };
}

export function campaignReadinessResponse(campaign: EmailCampaignReadinessSource) {
  const readiness = getEmailCampaignReadiness(campaign);

  return {
    emailSavedCurrent: readiness.email_saved_current,
    textSavedCurrent: readiness.text_saved_current,
    emailPreviewCurrent: readiness.email_preview_current,
    textPreviewCurrent: readiness.text_preview_current,
    emailTestCurrent: readiness.email_test_current,
    textTestCurrent: readiness.text_test_current,
    audienceCurrent: readiness.audience_current,
    readyForRecipientRefresh: readiness.ready_for_recipient_refresh,
    readyForFinalSend: readiness.ready_for_final_send,
    reasonCodes: readiness.reason_codes,
  };
}
