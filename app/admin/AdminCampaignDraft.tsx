"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { signOut } from "next-auth/react";
import {
  DEFAULT_ADMIN_EMAIL_BODY,
  DEFAULT_ADMIN_EMAIL_CTA_LABEL,
  DEFAULT_ADMIN_EMAIL_CTA_URL,
  DEFAULT_ADMIN_EMAIL_HEADING,
  DEFAULT_ADMIN_EMAIL_SUBJECT,
  DEFAULT_ADMIN_MESSAGE_TYPE,
  DEFAULT_ADMIN_SMS_BODY,
  isUnsafeTestPlaceholder,
} from "@/app/lib/admin-campaign-defaults";

type CampaignDraft = {
  id: string;
  messageType:
    | "beta_update"
    | "testflight_update"
    | "product_update"
    | "feedback_request"
    | "important_notice";
  subject: string;
  heading: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  status: string;
  createdAt?: string;
  updatedAt: string;
  version: number;
  emailDraftVersion?: number;
  emailPreviewGeneratedAt?: string | null;
  emailPreviewVersion?: number;
  emailTestVersion?: number;
  testMessageId?: string | null;
  testedAt?: string | null;
  approvedAt?: string | null;
  queueingStartedAt?: string | null;
  queuedAt?: string | null;
  sentAt?: string | null;
  completedAt?: string | null;
  canceledAt?: string | null;
  failedAt?: string | null;
  testRecipient?: string | null;
  recipientCount?: number;
  eligibleCount?: number;
  excludedCount?: number;
  queuedCount?: number;
  sentCount?: number;
  deliveredCount?: number;
  failedCount?: number;
  skippedCount?: number;
  smsEnabled?: boolean;
  smsBody?: string;
  smsRenderedBody?: string;
  smsDraftVersion?: number;
  smsPreviewGeneratedAt?: string | null;
  smsPreviewVersion?: number;
  smsSavedAt?: string | null;
  smsTestedAt?: string | null;
  smsTestVersion?: number;
  smsCharacterCount?: number;
  smsSegmentCount?: number;
  smsEncoding?: "GSM-7" | "Unicode";
  smsEligibleCount?: number;
  smsExcludedCount?: number;
  smsDuplicateCount?: number;
  smsQueuedCount?: number;
  smsSentCount?: number;
  smsDeliveredCount?: number;
  smsFailedCount?: number;
  smsSkippedCount?: number;
  smsTestProviderStatus?: string | null;
  smsTestRecipientMasked?: string | null;
  smsTestSenderMasked?: string | null;
  smsTestStatus?: string | null;
  smsTestTransport?: string | null;
  smsTestMessageSid?: string | null;
  audienceCountedAt?: string | null;
  audienceVersion?: number;
  audienceEmailTotal?: number;
  audienceEmailEligible?: number;
  audienceEmailExcluded?: number;
  audienceEmailDuplicateCount?: number;
  audienceEmailStatus?: "success" | "failed" | "not_counted";
  audienceEmailErrorCode?: string | null;
  audienceSmsTotal?: number;
  audienceSmsEligible?: number;
  audienceSmsExcluded?: number;
  audienceSmsDuplicateCount?: number;
  audienceSmsStatus?: "success" | "failed" | "not_counted";
  audienceSmsErrorCode?: string | null;
  audienceBothEligible?: number | null;
  audienceLastErrorCode?: string | null;
  audienceLastErrorAt?: string | null;
  audienceSegment?: BetaAudienceSegment;
  readiness?: CampaignReadiness;
  isPinned?: boolean;
  pinnedAt?: string | null;
};

type BetaAudienceSegment = "all" | "priority" | "standard";

type CampaignReadiness = {
  audienceCurrent: boolean;
  emailPreviewCurrent: boolean;
  emailSavedCurrent: boolean;
  emailTestCurrent: boolean;
  readyForFinalSend: boolean;
  readyForRecipientRefresh: boolean;
  reasonCodes: Array<
    | "audience_missing"
    | "audience_stale"
    | "email_draft_missing"
    | "email_preview_missing"
    | "email_preview_stale"
    | "email_test_missing"
    | "email_test_stale"
    | "text_draft_missing"
    | "text_preview_missing"
    | "text_preview_stale"
    | "text_test_missing"
    | "text_test_stale"
  >;
  textPreviewCurrent: boolean;
  textSavedCurrent: boolean;
  textTestCurrent: boolean;
};

type ProgressSummary = {
  campaignStatus: string;
  completedAt?: string | null;
  counts: {
    bounced: number;
    complained: number;
    delayed: number;
    delivered: number;
    failed: number;
    queued: number;
    rejected: number;
    sending: number;
    sent: number;
    skipped: number;
    total: number;
  };
  eligible: number;
  excluded: number;
  isActive: boolean;
  updatedAt: string;
};

type AudienceSummary = {
  audienceSegment?: BetaAudienceSegment;
  confirmationPhrase: string;
  countedAt?: string;
  diagnostics?: {
    emailEligible?: number;
    emailErrorCode?: string | null;
    emailExcluded?: number;
    emailExclusionGroups?: Record<string, number>;
    emailIndexName?: string;
    emailQueryStatus?: "success" | "failed" | "not_counted";
    emailRecordsExamined?: number;
    emailStatusGroups?: Record<string, number>;
    emailTableName?: string | null;
    health?: unknown;
    lastRefreshResult?: string;
    smsEligible?: number;
    smsErrorCode?: string | null;
    smsExcluded?: number;
    smsExclusionGroups?: Record<string, number>;
    smsIndexName?: string;
    smsQueryStatus?: "success" | "failed" | "not_counted";
    smsRecordsExamined?: number;
    smsStatusGroups?: Record<string, number>;
    smsTableName?: string | null;
  };
  duplicateCount: number;
  eligibleCount: number;
  excludedCount: number;
  totalCount?: number;
  smsDuplicateCount?: number;
  smsErrorCode?: string | null;
  smsEligibleCount?: number;
  smsExcludedCount?: number;
  smsStatus?: "success" | "failed" | "not_counted";
  smsTotalCount?: number;
  smsIncluded?: boolean;
  emailErrorCode?: string | null;
  emailStatus?: "success" | "failed" | "not_counted";
  receivingBothCount?: number | null;
};

type AudienceOverview = {
  checkedAt: string;
  email: {
    eligibleCount: number;
    errorCode: string | null;
    status: "success" | "failed" | "not_counted";
    totalCount: number;
  };
  refreshResult: string;
  sms: {
    eligibleCount: number;
    errorCode: string | null;
    status: "success" | "failed" | "not_counted";
    totalCount: number;
  };
};

type AdminBetaSubscriber = {
  adminNotes: string;
  adminNotesUpdatedAt: string | null;
  createdAt: string;
  email: string;
  emailDelivery: {
    lastEmailMessageId: string | null;
    lastEmailSentAt: string | null;
    lastEmailType: string | null;
    welcomeEmailSentAt: string | null;
  };
  emailStatus: string;
  firstName: string;
  fullName: string;
  id: string;
  lastName: string;
  phoneE164: string | null;
  phoneRaw: string | null;
  priorityBadge: string;
  priorityBeta: boolean;
  priorityUpdatedAt: string | null;
  signupOrderNumber: number | null;
  smsConsent: {
    informational: boolean;
    informationalAt: string | null;
    marketing: boolean;
    marketingAt: string | null;
    version: string | null;
  };
  smsDelivery: {
    lastSmsMessageSid: string | null;
    lastSmsSentAt: string | null;
    lastSmsStatus: string | null;
    providerStatus: string | null;
    welcomeSmsSentAt: string | null;
  };
  smsStatus: string;
  sourcePage: string;
  subscriberAdminVersion: number;
  updatedAt: string;
};

type AdminSubscriberSort =
  | "name_asc"
  | "newest"
  | "priority_first"
  | "signup_order_asc"
  | "signup_order_desc";

type AdminSubscriberPriorityFilter = "all" | "priority" | "standard";

type Preview = {
  html: string;
  subject: string;
  text: string;
};

type SmsPreview = {
  body: string;
  characterCount: number;
  editableBody: string;
  encoding: "GSM-7" | "Unicode";
  segmentCount: number;
};

type SmsTestReadiness = {
  adminCampaignsEnabled: boolean;
  featureEnabled: boolean;
  mappingConfigValid: boolean;
  mappingFound: boolean;
  maskedPhone: string | null;
  phoneValid: boolean;
  ready: boolean;
  reason:
    | "admin_campaigns_disabled"
    | "mapping_invalid"
    | "mapping_missing"
    | "ready"
    | "sms_preview_required"
    | "sms_test_disabled"
    | "stale_version"
    | "text_not_saved"
    | "twilio_config_incomplete";
  sessionAuthorized: boolean;
  smsPreviewCurrent?: boolean;
  textSaved: boolean;
  twilioConfigured: boolean;
  versionMatches: boolean;
};

type FormValues = {
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  heading: string;
  messageType: CampaignDraft["messageType"];
  smsBody: string;
  smsEnabled: boolean;
  subject: string;
};

type BusyAction =
  | "approve"
  | "audience"
  | "delete"
  | "load"
  | "pin"
  | "preview"
  | "refresh"
  | "saveEmail"
  | "saveSms"
  | "sentHistory"
  | "subscriberDetail"
  | "subscriberExport"
  | "subscriberList"
  | "subscriberNotes"
  | "subscriberPriority"
  | "smsPreview"
  | "smsTest"
  | "start"
  | "test"
  | null;

type NextActionKey =
  | "emailBody"
  | "emailCtaLabel"
  | "emailCtaUrl"
  | "emailHeading"
  | "emailPreview"
  | "emailSave"
  | "emailSubject"
  | "emailTest"
  | "recipientCount"
  | "sendAnnouncement"
  | "smsBody"
  | "startPhrase"
  | "smsPreview"
  | "smsSave"
  | "smsTest";

type SmsTestModalState =
  | {
      message: string;
      providerStatus?: string | null;
      tone: "error" | "info" | "success";
    }
  | null;

const ADMIN_IDLE_TIMEOUT_MS = 6 * 60 * 1000;
const ADMIN_IDLE_WARNING_AFTER_MS = 60 * 1000;
const ADMIN_IDLE_WARNING_DURATION_MS =
  ADMIN_IDLE_TIMEOUT_MS - ADMIN_IDLE_WARNING_AFTER_MS;
const ADMIN_HEARTBEAT_INTERVAL_MS = 90 * 1000;
const ADMIN_PRESENCE_SESSION_KEY = "suppvis-admin-presence-active";

function formatIdleCountdown(milliseconds: number) {
  const remainingSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
const FOCUS_GUIDE_STEP_IDLE_MS = 10 * 1000;
const SUBSCRIBERS_PER_PAGE = 20;
const SUBSCRIBER_SEARCH_DEBOUNCE_MS = 250;
const SUBSCRIBER_SUGGESTION_LIMIT = 5;
const SUBSCRIBER_PRIORITY_FILTER_OPTIONS: Array<
  AdminSelectOption<AdminSubscriberPriorityFilter>
> = [
  { label: "All subscribers", value: "all" },
  { label: "Priority only", value: "priority" },
  { label: "Standard only", value: "standard" },
];
const SUBSCRIBER_SORT_OPTIONS: Array<AdminSelectOption<AdminSubscriberSort>> = [
  { label: "Signup order", value: "signup_order_asc" },
  { label: "Signup order descending", value: "signup_order_desc" },
  { label: "Newest first", value: "newest" },
  { label: "Name A-Z", value: "name_asc" },
  { label: "Priority first", value: "priority_first" },
];

const initialForm: FormValues = {
  body: DEFAULT_ADMIN_EMAIL_BODY,
  ctaLabel: DEFAULT_ADMIN_EMAIL_CTA_LABEL,
  ctaUrl: DEFAULT_ADMIN_EMAIL_CTA_URL,
  heading: DEFAULT_ADMIN_EMAIL_HEADING,
  messageType: DEFAULT_ADMIN_MESSAGE_TYPE,
  smsBody: DEFAULT_ADMIN_SMS_BODY,
  smsEnabled: true,
  subject: DEFAULT_ADMIN_EMAIL_SUBJECT,
};

async function parseJsonResponse(response: Response) {
  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.ok) {
    if (
      response.status === 401 ||
      payload?.code === "admin_auth_required"
    ) {
      throw new Error("Your admin session expired. Sign in again and retry.");
    }

    const message =
      payload?.message ||
      payload?.code ||
      "The admin action could not be completed.";
    throw new Error(message);
  }

  return payload;
}

function adminFetch(input: RequestInfo | URL, init?: RequestInit) {
  return fetch(input, {
    ...init,
    credentials: "same-origin",
  });
}

function campaignToForm(campaign: CampaignDraft): FormValues {
  return {
    body: campaign.body,
    ctaLabel: campaign.ctaLabel,
    ctaUrl: campaign.ctaUrl,
    heading: campaign.heading,
    messageType: campaign.messageType,
    smsBody: campaign.smsBody || DEFAULT_ADMIN_SMS_BODY,
    smsEnabled: true,
    subject: campaign.subject,
  };
}

function confirmationPhraseForCounts(emailCount: number, smsCount: number) {
  if (emailCount > 0 && smsCount > 0) {
    return `SEND EMAIL TO ${emailCount} AND TEXT TO ${smsCount}`;
  }

  if (emailCount > 0) {
    return `SEND EMAIL TO ${emailCount}`;
  }

  if (smsCount > 0) {
    return `SEND TEXT TO ${smsCount}`;
  }

  return "";
}

function audienceFromCampaign(
  campaign: CampaignDraft | null,
): AudienceSummary | null {
  if (
    !campaign?.audienceCountedAt ||
    campaign.audienceVersion !== campaign.version
  ) {
    return null;
  }

  const emailEligible = campaign.audienceEmailEligible || 0;
  const smsEligible = campaign.audienceSmsEligible || 0;
  const emailStatus = campaign.audienceEmailStatus || "not_counted";
  const smsStatus = campaign.audienceSmsStatus || "not_counted";

  return {
    audienceSegment: campaign.audienceSegment || "all",
    confirmationPhrase: confirmationPhraseForCounts(
      emailStatus === "success" ? emailEligible : 0,
      smsStatus === "success" ? smsEligible : 0,
    ),
    countedAt: campaign.audienceCountedAt,
    duplicateCount: campaign.audienceEmailDuplicateCount || 0,
    emailErrorCode: campaign.audienceEmailErrorCode || null,
    emailStatus,
    eligibleCount: emailEligible,
    excludedCount: campaign.audienceEmailExcluded || 0,
    totalCount: campaign.audienceEmailTotal || 0,
    smsDuplicateCount: campaign.audienceSmsDuplicateCount || 0,
    smsErrorCode: campaign.audienceSmsErrorCode || null,
    smsEligibleCount: smsEligible,
    smsExcludedCount: campaign.audienceSmsExcluded || 0,
    smsStatus,
    smsTotalCount: campaign.audienceSmsTotal || 0,
    smsIncluded: true,
    receivingBothCount: campaign.audienceBothEligible ?? null,
    diagnostics: {
      emailEligible,
      emailErrorCode: campaign.audienceEmailErrorCode || null,
      emailExcluded: campaign.audienceEmailExcluded || 0,
      emailQueryStatus: emailStatus,
      emailRecordsExamined: campaign.audienceEmailTotal || 0,
      lastRefreshResult:
        emailStatus === "success" && smsStatus === "success"
          ? "success"
          : emailStatus === "success" || smsStatus === "success"
            ? "partial"
            : "failed",
      smsEligible,
      smsErrorCode: campaign.audienceSmsErrorCode || null,
      smsExcluded: campaign.audienceSmsExcluded || 0,
      smsQueryStatus: smsStatus,
      smsRecordsExamined: campaign.audienceSmsTotal || 0,
    },
  };
}

function audienceErrorCopy(code: string) {
  if (code === "audience_query_access_denied") {
    return "Recipient counting cannot read the subscriber status index. AWS IAM needs DynamoDB Query access for the subscriber status index.";
  }

  if (code === "audience_base_table_read_failed") {
    return "Recipient counting can read the subscriber index, but cannot read the full subscriber records from the base table.";
  }

  if (code === "audience_base_table_access_denied") {
    return "Recipient counting can find subscriber keys, but AWS IAM is missing DynamoDB BatchGetItem access for the subscriber table.";
  }

  if (code === "audience_index_key_mismatch") {
    return "The subscriber status index exists, but its key schema does not match the status query.";
  }

  if (code === "audience_index_projection_insufficient") {
    return "The subscriber status index lookup worked, but the records need a base-table read for eligibility fields.";
  }

  if (code === "audience_index_not_found") {
    return "The configured subscriber status index was not found on the subscriber table.";
  }

  if (code === "audience_index_query_invalid") {
    return "The configured subscriber status index does not match the query shape. Check the index keys/projection.";
  }

  if (code === "audience_resource_not_found") {
    return "The configured subscriber table or status index was not found.";
  }

  if (code === "audience_query_failed") {
    return "Recipient counting could not read subscriber records. Try again after the database issue is resolved.";
  }

  return "Recipient counts could not be refreshed. Try again later.";
}

function audienceRefreshWarning(audience: AudienceSummary | null) {
  if (!audience) {
    return null;
  }

  const emailFailed = audience.emailStatus === "failed";
  const smsFailed = audience.smsStatus === "failed";
  const emailReason = audience.emailErrorCode
    ? audienceErrorCopy(audience.emailErrorCode)
    : "Email recipients could not be read.";
  const smsReason = audience.smsErrorCode
    ? audienceErrorCopy(audience.smsErrorCode)
    : "Text recipients could not be read.";

  if (emailFailed && smsFailed) {
    return `Email and text recipient counts failed. Email: ${emailReason} Text: ${smsReason}`;
  }

  if (emailFailed) {
    return `Text recipients refreshed. Email recipients could not be read. ${emailReason}`;
  }

  if (smsFailed) {
    return `Email recipients refreshed. Text recipients could not be read. ${smsReason}`;
  }

  return null;
}

function audienceSegmentLabel(segment: BetaAudienceSegment) {
  if (segment === "priority") {
    return "Priority beta subscribers only";
  }

  if (segment === "standard") {
    return "Standard beta subscribers only";
  }

  return "All beta subscribers";
}

function formatOptionalDate(value?: string | null) {
  return value ? new Date(value).toLocaleString() : "-";
}

function phoneDisplay(subscriber: AdminBetaSubscriber) {
  const value = subscriber.phoneE164 || subscriber.phoneRaw;

  if (!value) {
    return "-";
  }

  const digits = value.replace(/\D/g, "");
  const national =
    digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;

  if (national.length === 10) {
    return `(${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6)}`;
  }

  return value;
}

function adminStatusLabel(value?: string | null) {
  if (!value) {
    return "-";
  }

  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function statusLabel(status?: string) {
  if (!status) {
    return "Unsaved";
  }

  const labels: Record<string, string> = {
    approved: "Approved",
    canceled: "Canceled",
    completed: "Announcement sent",
    completed_with_failures: "Announcement completed with issues",
    draft: "Draft",
    failed: "Issue found",
    queueing: "Preparing send",
    queued: "Sending",
    sending: "Sending",
    test_ready: "Test ready",
    tested: "Tested",
  };

  return labels[status] || status.replace(/_/g, " ");
}

type RecentChannelTone = "success" | "warning" | "muted" | "danger";

function recentChannelBadgeClass(tone: RecentChannelTone) {
  const tones: Record<RecentChannelTone, string> = {
    danger: "border-red-400/25 bg-red-400/10 text-red-100",
    muted: "border-white/10 bg-white/[0.03] text-text-secondary",
    success: "border-accent/25 bg-accent/10 text-teal-50",
    warning: "border-yellow-400/20 bg-yellow-400/10 text-yellow-50",
  };

  return `rounded-full border px-2 py-1 text-xs ${tones[tone]}`;
}

function currentEmailDraftVersion(draft: CampaignDraft) {
  return draft.emailDraftVersion || draft.version;
}

function recentEmailState(draft: CampaignDraft): {
  label: string;
  tone: RecentChannelTone;
} {
  const emailVersion = currentEmailDraftVersion(draft);
  const previewCurrent = Boolean(
    draft.emailPreviewGeneratedAt &&
      draft.emailPreviewVersion === emailVersion,
  );
  const testRecorded = Boolean(draft.testedAt && draft.testMessageId);
  const testCurrent = Boolean(
    testRecorded && draft.emailTestVersion === emailVersion,
  );

  if (!emailVersion) {
    return { label: "Email: Not saved", tone: "warning" };
  }

  if (testCurrent) {
    return { label: "Email: Test accepted", tone: "success" };
  }

  if (testRecorded) {
    return { label: "Email: Test stale", tone: "warning" };
  }

  if (previewCurrent) {
    return { label: "Email: Previewed", tone: "success" };
  }

  if (draft.emailPreviewGeneratedAt) {
    return { label: "Email: Preview stale", tone: "warning" };
  }

  return { label: "Email: Saved", tone: "muted" };
}

function recentTextState(draft: CampaignDraft): {
  label: string;
  tone: RecentChannelTone;
} {
  const textVersion = draft.smsDraftVersion || 0;
  const previewCurrent = Boolean(
    draft.smsPreviewGeneratedAt &&
      draft.smsPreviewVersion === textVersion,
  );
  const providerStatus = (
    draft.smsTestStatus ||
    draft.smsTestProviderStatus ||
    ""
  ).toLowerCase();
  const testRecorded = Boolean(
    draft.smsTestMessageSid ||
      draft.smsTestedAt ||
      providerStatus === "accepted" ||
      providerStatus === "delivered" ||
      providerStatus === "failed" ||
      providerStatus === "undelivered",
  );
  const testCurrent = Boolean(
    testRecorded && draft.smsTestVersion === textVersion,
  );

  if (!draft.smsEnabled || !draft.smsSavedAt || !textVersion) {
    return { label: "Text: Not saved", tone: "warning" };
  }

  if (testRecorded && testCurrent && draft.smsTestTransport !== "sms") {
    return { label: "Text: Non-SMS test", tone: "warning" };
  }

  if (testCurrent) {
    if (providerStatus === "failed" || providerStatus === "undelivered") {
      return { label: "Text: Test failed", tone: "danger" };
    }

    if (providerStatus === "delivered") {
      return { label: "Text: Test delivered", tone: "success" };
    }

    return { label: "Text: Test accepted", tone: "success" };
  }

  if (testRecorded) {
    return { label: "Text: Test stale", tone: "warning" };
  }

  if (previewCurrent) {
    return { label: "Text: Previewed", tone: "success" };
  }

  if (draft.smsPreviewGeneratedAt) {
    return { label: "Text: Preview stale", tone: "warning" };
  }

  return { label: "Text: Saved", tone: "muted" };
}

function messageTypeLabel(messageType?: string) {
  if (messageType === "testflight_update") {
    return "TestFlight update";
  }

  if (messageType === "product_update") {
    return "Product update";
  }

  if (messageType === "feedback_request") {
    return "Feedback request";
  }

  if (messageType === "important_notice") {
    return "Important notice";
  }

  return "Beta announcement";
}

function messageTypeEmailLabel(messageType?: string) {
  return messageTypeLabel(messageType).toUpperCase();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function localParagraphs(body: string) {
  return body
    .trim()
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function localEmailPreviewHtml(form: FormValues) {
  const label = messageTypeEmailLabel(form.messageType);
  const brandIconUrl = "https://www.suppvis.health/email/suppvis-logo.png";
  const bodyHtml = [
    ...localParagraphs(form.body).map((paragraph) =>
      `<p style="margin:0 0 18px 0;color:#9BAFBF;font-size:16px;line-height:1.65;">${paragraph
        .split(/\n/)
        .map(escapeHtml)
        .join("<br />")}</p>`,
    ),
    form.ctaLabel && form.ctaUrl
      ? `<p style="margin:0 0 18px 0;text-align:center;"><a href="${escapeHtml(
          form.ctaUrl,
        )}" style="display:inline-block;border-radius:999px;background:#14B8A6;color:#0A0F14;text-decoration:none;font-size:16px;font-weight:800;padding:14px 24px;">${escapeHtml(
          form.ctaLabel,
        )}</a></p>`
      : "",
    form.ctaUrl
      ? `<p style="margin:0 0 22px 0;color:#9BAFBF;font-size:13px;line-height:1.55;word-break:break-all;text-align:center;">${escapeHtml(
          form.ctaUrl,
        )}</p>`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(form.subject)}</title>
  </head>
  <body style="margin:0;background:#0A0F14;color:#F0F4F8;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0A0F14;margin:0;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;border-collapse:collapse;">
            <tr>
              <td style="padding:0 0 18px 0;text-align:left;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                  <tr>
                    <td style="text-align:left;vertical-align:middle;">
                      <div style="font-size:24px;line-height:1;font-weight:800;letter-spacing:0;color:#F0F4F8;">SuppVis</div>
                      <div style="padding-top:7px;color:#14B8A6;font-size:11px;line-height:1;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;">${escapeHtml(
                        label,
                      )}</div>
                    </td>
                    <td align="right" style="vertical-align:middle;">
                      <div style="display:inline-block;width:42px;height:42px;border:1px solid rgba(20,184,166,0.42);border-radius:14px;background:rgba(20,184,166,0.10);overflow:hidden;">
                        <img src="${brandIconUrl}" width="42" height="42" alt="SuppVis" style="display:block;width:42px;height:42px;border:0;outline:none;text-decoration:none;" />
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="background:#0D1117;border:1px solid rgba(20,184,166,0.22);border-radius:18px;padding:34px 28px;box-shadow:0 18px 50px rgba(0,0,0,0.28);">
                <p style="margin:0 0 14px 0;color:#14B8A6;font-size:12px;line-height:1;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;">${escapeHtml(
                  label,
                )}</p>
                <h1 style="margin:0 0 22px 0;color:#F0F4F8;font-size:28px;line-height:1.15;font-weight:800;">${escapeHtml(
                  form.heading,
                )}</h1>
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:18px 8px 0 8px;text-align:center;color:#5A7089;font-size:12px;line-height:1.6;">
                You are receiving this because you joined the SuppVis beta.
                <br />
                <span style="color:#14B8A6;text-decoration:underline;">Unsubscribe link will be inserted per recipient before a production send.</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

const GSM_7_EXTENSION_CHARS = "^{}\\[~]|";
const GSM_7_BASIC_SET = new Set(
  Array.from({ length: 95 }, (_, index) => String.fromCharCode(index + 32))
    .filter((char) => !GSM_7_EXTENSION_CHARS.includes(char))
    .concat(["\n", "\r"]),
);
const GSM_7_EXTENSION_SET = new Set(GSM_7_EXTENSION_CHARS.split(""));

function localSmsMetrics(message: string) {
  let gsmLength = 0;
  let isGsm = true;

  for (const char of message) {
    if (GSM_7_EXTENSION_SET.has(char)) {
      gsmLength += 2;
    } else if (GSM_7_BASIC_SET.has(char)) {
      gsmLength += 1;
    } else {
      isGsm = false;
      break;
    }
  }

  const encoding: SmsPreview["encoding"] = isGsm ? "GSM-7" : "Unicode";
  const characterCount = isGsm ? gsmLength : Array.from(message).length;
  const singleSegmentLimit = isGsm ? 160 : 70;
  const multipartSegmentLimit = isGsm ? 153 : 67;
  const segmentCount =
    characterCount <= singleSegmentLimit
      ? 1
      : Math.ceil(characterCount / multipartSegmentLimit);

  return { characterCount, encoding, segmentCount };
}

function localSmsPreview(smsBody: string): SmsPreview {
  const editableBody = smsBody.trim().replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n");
  const body = `SuppVis: ${editableBody}\n\nMsg frequency varies. Msg & data rates may apply.`;

  return {
    body,
    editableBody,
    ...localSmsMetrics(body),
  };
}

function canDeleteDraft(campaign: CampaignDraft) {
  return (
    (campaign.status === "draft" ||
      campaign.status === "test_ready" ||
      campaign.status === "tested" ||
      (campaign.status === "approved" &&
        !campaign.queueingStartedAt &&
        !campaign.queuedAt &&
        !campaign.sentAt &&
        !campaign.recipientCount))
  );
}

function canModifyDraft(campaign: CampaignDraft | null) {
  return (
    !campaign ||
    campaign.status === "draft" ||
    campaign.status === "test_ready" ||
    campaign.status === "tested"
  );
}

function PinIcon({ pinned }: { pinned: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill={pinned ? "currentColor" : "none"}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    >
      <path d="M15 4.5 19.5 9" />
      <path d="m14 5.5-5 5-3 .5 7 7 .5-3 5-5" />
      <path d="m9 15-4 4" />
    </svg>
  );
}

function primaryButtonClass(tone: "teal" | "blue" | "amber" | "red" | "dark") {
  const toneClass =
    tone === "teal"
      ? "bg-accent text-[#03100E] hover:bg-accent-hover focus-visible:ring-accent/70"
      : tone === "blue"
        ? "bg-[#2563EB] text-white hover:bg-[#1D4ED8] focus-visible:ring-blue-300/70"
        : tone === "amber"
          ? "bg-[#D7A321] text-[#171006] hover:bg-[#E1B039] focus-visible:ring-yellow-200/70"
          : tone === "red"
            ? "bg-[#B94040] text-white hover:bg-[#A43434] focus-visible:ring-red-200/70"
            : "bg-white/10 text-text-primary hover:bg-white/15 focus-visible:ring-white/40";

  return [
    "inline-flex min-h-11 items-center justify-center rounded-full px-5 py-3 text-sm font-bold",
    "transition duration-150 ease-out hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0D1117]",
    "disabled:pointer-events-none disabled:cursor-not-allowed disabled:translate-y-0 disabled:scale-100 disabled:bg-white/10 disabled:text-text-muted disabled:opacity-55 disabled:shadow-none",
    toneClass,
  ].join(" ");
}

function SecondaryButton({
  children,
  disabled,
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label="Continue to the next announcement step"
      onClick={onClick}
      disabled={disabled}
      className="rounded-full border border-white/15 px-3 py-2 text-xs font-semibold text-text-secondary transition hover:border-accent/60 hover:text-accent active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function UpArrowIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    >
      <path d="M12 19V5" />
      <path d="M5 12l7-7 7 7" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    >
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function Modal({
  bodyClassName = "",
  children,
  closeOnBackdrop = true,
  closeOnEscape = true,
  headerClassName = "",
  lockScroll = true,
  maxWidth = "max-w-lg",
  onClose,
  panelClassName = "",
  showCloseButton = true,
  title,
}: {
  bodyClassName?: string;
  children: ReactNode;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  headerClassName?: string;
  lockScroll?: boolean;
  maxWidth?: string;
  onClose: () => void;
  panelClassName?: string;
  showCloseButton?: boolean;
  title: string;
}) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const scrollY = window.scrollY;
    const previousBodyStyle = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
    };

    if (lockScroll) {
      document.body.style.overflow = "hidden";
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = "100%";
    }

    window.setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 0);

    return () => {
      if (lockScroll) {
        document.body.style.overflow = previousBodyStyle.overflow;
        document.body.style.position = previousBodyStyle.position;
        document.body.style.top = previousBodyStyle.top;
        document.body.style.width = previousBodyStyle.width;
        window.scrollTo(0, scrollY);
      }

      previousFocusRef.current?.focus({ preventScroll: true });
    };
  }, [lockScroll]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && closeOnEscape) {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) {
        return;
      }

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute("aria-hidden"));

      if (!focusable.length) {
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [closeOnEscape, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-modal-title"
      onMouseDown={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        className={`flex max-h-[92vh] w-full ${maxWidth} flex-col overflow-hidden rounded-[8px] border border-white/10 bg-[#0D1117] shadow-2xl shadow-black/50 ${panelClassName}`}
      >
        <div
          className={`relative z-20 flex shrink-0 items-start justify-between gap-4 border-b border-white/10 bg-[#0D1117] px-5 py-4 shadow-[0_14px_24px_rgba(0,0,0,0.26)] ${headerClassName}`}
        >
          <h2
            id="admin-modal-title"
            className="min-w-0 break-words pr-2 font-headline text-2xl font-bold text-text-primary"
          >
            {title}
          </h2>
          {showCloseButton ? (
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              aria-label={`Close ${title.toLowerCase()}`}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 text-text-secondary transition hover:border-accent/50 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0D1117]"
            >
              <span aria-hidden="true" className="text-xl leading-none">
                x
              </span>
            </button>
          ) : null}
        </div>
        <div className={`min-h-0 flex-1 overflow-y-auto p-5 ${bodyClassName}`}>
          {children}
        </div>
      </div>
    </div>
  );
}

function FocusGuideDirectionCue({
  children,
  direction,
  onClick,
}: {
  children: ReactNode;
  direction: "above" | "below";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Next step is ${direction}`}
      className={`fixed left-1/2 z-[70] -translate-x-1/2 rounded-full border border-accent/45 bg-[#071413]/95 px-4 py-2 text-xs font-bold text-accent shadow-[0_0_30px_rgba(36,196,182,0.28)] transition duration-200 hover:border-accent hover:bg-accent/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 motion-reduce:transition-none ${
        direction === "above" ? "top-4" : "bottom-4"
      }`}
    >
      {direction === "above" ? (
        <svg
          aria-hidden="true"
          className="mr-2 inline h-3.5 w-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        >
          <path d="M12 19V5" />
          <path d="m5 12 7-7 7 7" />
        </svg>
      ) : null}
      <span>{children}</span>
      {direction === "below" ? (
      <svg
        aria-hidden="true"
          className="ml-2 inline h-3.5 w-3.5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      >
        <path d="M12 5v14" />
        <path d="m19 12-7 7-7-7" />
      </svg>
      ) : null}
    </button>
  );
}

type AdminSelectOption<T extends string> = {
  label: string;
  value: T;
};

function AdminSelect<T extends string>({
  disabled = false,
  label,
  onChange,
  options,
  value,
}: {
  disabled?: boolean;
  label: string;
  onChange: (value: T) => void;
  options: Array<AdminSelectOption<T>>;
  value: T;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const [highlightedIndex, setHighlightedIndex] = useState(selectedIndex);
  const [open, setOpen] = useState(false);
  const selected = options[selectedIndex] || options[0];

  useEffect(() => {
    setHighlightedIndex(selectedIndex);
  }, [selectedIndex]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function closeOnOutsidePointer(event: PointerEvent) {
      if (
        containerRef.current &&
        event.target instanceof Node &&
        !containerRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeOnOutsidePointer);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
    };
  }, [open]);

  function selectOption(option: AdminSelectOption<T>) {
    onChange(option.value);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={label}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
            return;
          }

          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
            setHighlightedIndex((index) =>
              Math.min(options.length - 1, index + 1),
            );
            return;
          }

          if (event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            setHighlightedIndex((index) => Math.max(0, index - 1));
            return;
          }

          if ((event.key === "Enter" || event.key === " ") && open) {
            event.preventDefault();
            selectOption(options[highlightedIndex] || selected);
          }
        }}
        className="flex w-full items-center justify-between gap-3 rounded-[8px] border border-white/10 bg-[#0D1117] px-3 py-2 text-left text-sm font-semibold text-text-primary outline-none transition hover:border-accent/50 focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="truncate">{selected?.label}</span>
        <span aria-hidden="true" className="text-text-muted">
          v
        </span>
      </button>
      {open ? (
        <div
          role="listbox"
          aria-label={label}
          className="absolute z-40 mt-2 max-h-72 w-full overflow-y-auto rounded-[8px] border border-white/10 bg-[#080D12] p-1 shadow-2xl shadow-black/40"
        >
          {options.map((option, index) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              onMouseEnter={() => setHighlightedIndex(index)}
              onClick={() => selectOption(option)}
              className={`block w-full rounded-[6px] px-3 py-2 text-left text-sm transition ${
                option.value === value
                  ? "bg-accent/15 font-semibold text-text-primary"
                  : index === highlightedIndex
                    ? "bg-white/[0.06] text-text-primary"
                    : "text-text-secondary hover:bg-white/[0.05] hover:text-text-primary"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function AdminCampaignDraft({
  adminEmail,
  bulkInfraReady,
  bulkSendEnabled,
  smsBulkInfraReady,
  smsBulkSendEnabled,
  smsTestSendEnabled,
  smsTestRecipientConfigError,
  smsTestRecipientMasked,
  testSendEnabled,
}: {
  adminEmail: string;
  bulkInfraReady: boolean;
  bulkSendEnabled: boolean;
  smsBulkInfraReady: boolean;
  smsBulkSendEnabled: boolean;
  smsTestSendEnabled: boolean;
  smsTestRecipientConfigError: boolean;
  smsTestRecipientMasked: string | null;
  testSendEnabled: boolean;
}) {
  const topRef = useRef<HTMLElement | null>(null);
  const emailWorkspaceRef = useRef<HTMLDivElement | null>(null);
  const emailPreviewButtonRef = useRef<HTMLButtonElement | null>(null);
  const emailSaveRef = useRef<HTMLButtonElement | null>(null);
  const emailTestButtonRef = useRef<HTMLButtonElement | null>(null);
  const emailBodyRef = useRef<HTMLTextAreaElement | null>(null);
  const emailCtaLabelRef = useRef<HTMLInputElement | null>(null);
  const emailCtaUrlRef = useRef<HTMLInputElement | null>(null);
  const emailHeadingFieldRef = useRef<HTMLInputElement | null>(null);
  const firstEmailFieldRef = useRef<HTMLInputElement | null>(null);
  const textWorkspaceRef = useRef<HTMLDivElement | null>(null);
  const textHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const textBodyRef = useRef<HTMLTextAreaElement | null>(null);
  const textPreviewButtonRef = useRef<HTMLButtonElement | null>(null);
  const textSaveRef = useRef<HTMLButtonElement | null>(null);
  const textTestButtonRef = useRef<HTMLButtonElement | null>(null);
  const deliveryRef = useRef<HTMLElement | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const smsPreviewRef = useRef<HTMLDivElement | null>(null);
  const focusGuideTimeoutRef = useRef<number | null>(null);
  const focusGuidePointerThrottleRef = useRef(0);
  const heartbeatIntervalRef = useRef<number | null>(null);
  const idleDeadlineRef = useRef<number>(Date.now() + ADMIN_IDLE_TIMEOUT_MS);
  const idleTimerRef = useRef<number | null>(null);
  const lastHeartbeatAtRef = useRef(0);
  const currentCampaignIdRef = useRef<string | null>(null);
  const newAnnouncementButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const recipientCountButtonRef = useRef<HTMLButtonElement | null>(null);
  const startPhraseInputRef = useRef<HTMLInputElement | null>(null);
  const sendAnnouncementButtonRef = useRef<HTMLButtonElement | null>(null);
  const workflowGuideScrollInProgressRef = useRef(false);
  const workflowGuideActivityThrottleRef = useRef(0);
  const draftsRequestSeqRef = useRef(0);
  const subscriberListRequestSeqRef = useRef(0);
  const subscriberSuggestionsSeqRef = useRef(0);
  const [audience, setAudience] = useState<AudienceSummary | null>(null);
  const [audienceOverview, setAudienceOverview] =
    useState<AudienceOverview | null>(null);
  const [audienceOverviewError, setAudienceOverviewError] =
    useState<string | null>(null);
  const [audienceRefreshError, setAudienceRefreshError] = useState<string | null>(null);
  const [audienceSegment, setAudienceSegment] =
    useState<BetaAudienceSegment>("all");
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [campaign, setCampaign] = useState<CampaignDraft | null>(null);
  const [focusGuideVisible, setFocusGuideVisible] = useState(false);
  const [focusGuideDirection, setFocusGuideDirection] = useState<
    "above" | "below" | null
  >(null);
  const [focusGuideResetSignal, setFocusGuideResetSignal] = useState(0);
  const [guidanceHighlight, setGuidanceHighlight] =
    useState<NextActionKey | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CampaignDraft | null>(null);
  const [drafts, setDrafts] = useState<CampaignDraft[]>([]);
  const [emailTestModalOpen, setEmailTestModalOpen] = useState(false);
  const [emailTestModalConfirmed, setEmailTestModalConfirmed] = useState(false);
  const [emailPreviewOutdated, setEmailPreviewOutdated] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof FormValues, string>>
  >({});
  const [form, setForm] = useState<FormValues>(initialForm);
  const [emailPreviewSnapshot, setEmailPreviewSnapshot] =
    useState<FormValues>(initialForm);
  const [message, setMessage] = useState<{
    tone: "error" | "success" | "info";
    text: string;
  } | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewMode, setPreviewMode] = useState<"html" | "text">("html");
  const [progress, setProgress] = useState<ProgressSummary | null>(null);
  const [smsPreview, setSmsPreview] = useState<SmsPreview | null>(null);
  const [smsPreviewOutdated, setSmsPreviewOutdated] = useState(false);
  const [smsPreviewSnapshot, setSmsPreviewSnapshot] = useState(
    initialForm.smsBody,
  );
  const [smsTestMessageSid, setSmsTestMessageSid] = useState<string | null>(null);
  const [smsTestModalState, setSmsTestModalState] =
    useState<SmsTestModalState>(null);
  const [smsTestModalConfirmed, setSmsTestModalConfirmed] = useState(false);
  const [smsTestModalOpen, setSmsTestModalOpen] = useState(false);
  const [smsTestRecipient, setSmsTestRecipient] = useState<string | null>(null);
  const [smsTestReadiness, setSmsTestReadiness] =
    useState<SmsTestReadiness | null>(null);
  const [startPhrase, setStartPhrase] = useState("");
  const [testSendMessageId, setTestSendMessageId] = useState<string | null>(null);
  const [pinningId, setPinningId] = useState<string | null>(null);
  const [newAnnouncementConfirmOpen, setNewAnnouncementConfirmOpen] =
    useState(false);
  const [saveHighlight, setSaveHighlight] = useState<"email" | "text" | null>(
    null,
  );
  const [sentAnnouncements, setSentAnnouncements] = useState<CampaignDraft[]>(
    [],
  );
  const [sentHistoryOpen, setSentHistoryOpen] = useState(false);
  const [workflowStarted, setWorkflowStarted] = useState(false);
  const [idleWarningOpen, setIdleWarningOpen] = useState(false);
  const [idleCountdown, setIdleCountdown] = useState(
    formatIdleCountdown(ADMIN_IDLE_WARNING_DURATION_MS),
  );
  const [subscriberError, setSubscriberError] = useState<string | null>(null);
  const [subscriberList, setSubscriberList] = useState<AdminBetaSubscriber[]>([]);
  const [subscriberPage, setSubscriberPage] = useState(1);
  const [subscriberPageSize] = useState(SUBSCRIBERS_PER_PAGE);
  const [subscriberPriorityCount, setSubscriberPriorityCount] = useState(0);
  const [subscriberPriorityFilter, setSubscriberPriorityFilter] =
    useState<AdminSubscriberPriorityFilter>("all");
  const [subscriberPriorityLimit, setSubscriberPriorityLimit] = useState(300);
  const [subscriberSearch, setSubscriberSearch] = useState("");
  const [subscriberSearchInput, setSubscriberSearchInput] = useState("");
  const [subscriberSort, setSubscriberSort] =
    useState<AdminSubscriberSort>("signup_order_asc");
  const [subscriberTotalCount, setSubscriberTotalCount] = useState(0);
  const [subscriberTotalPages, setSubscriberTotalPages] = useState(1);
  const [subscriberSuggestions, setSubscriberSuggestions] = useState<
    AdminBetaSubscriber[]
  >([]);
  const [subscriberSuggestionsLoading, setSubscriberSuggestionsLoading] =
    useState(false);
  const [subscriberSuggestionsOpen, setSubscriberSuggestionsOpen] =
    useState(false);
  const [subscriberSuggestionIndex, setSubscriberSuggestionIndex] =
    useState(-1);
  const [selectedSubscriber, setSelectedSubscriber] =
    useState<AdminBetaSubscriber | null>(null);
  const [subscriberNotesDraft, setSubscriberNotesDraft] = useState("");
  const [subscriberPriorityReplacementId, setSubscriberPriorityReplacementId] =
    useState("");
  const [priorityOptions, setPriorityOptions] = useState<AdminBetaSubscriber[]>(
    [],
  );
  const [standardOptions, setStandardOptions] = useState<AdminBetaSubscriber[]>(
    [],
  );
  const [subscriberActionMessage, setSubscriberActionMessage] = useState<{
    tone: "error" | "success" | "info";
    text: string;
  } | null>(null);

  const isBusy = Boolean(busyAction);
  const subscriberRangeStart = subscriberTotalCount
    ? (subscriberPage - 1) * subscriberPageSize + 1
    : 0;
  const subscriberRangeEnd = subscriberTotalCount
    ? Math.min(
        subscriberTotalCount,
        subscriberRangeStart + subscriberList.length - 1,
      )
    : 0;
  const status = useMemo(() => statusLabel(campaign?.status), [campaign]);
  const isSendStarted =
    campaign?.status === "queueing" ||
    campaign?.status === "queued" ||
    campaign?.status === "sending" ||
    campaign?.status === "completed" ||
    campaign?.status === "completed_with_failures" ||
    campaign?.status === "failed";
  const emailChangedSinceSave = Boolean(
    campaign &&
      (form.body !== campaign.body ||
        form.ctaLabel !== campaign.ctaLabel ||
        form.ctaUrl !== campaign.ctaUrl ||
        form.heading !== campaign.heading ||
        form.messageType !== campaign.messageType ||
        form.subject !== campaign.subject),
  );
  const persistedReadiness = campaign?.readiness;
  const persistedEmailSaved =
    persistedReadiness?.emailSavedCurrent ??
    Boolean(campaign?.subject && campaign?.heading && campaign?.body);
  const emailSaved = Boolean(
    campaign && !emailChangedSinceSave && persistedEmailSaved,
  );
  const textWorkspaceUnlocked = workflowStarted || Boolean(campaign);
  const smsChangedSinceSave = Boolean(
    campaign && (!campaign.smsEnabled || campaign.smsBody !== form.smsBody),
  );
  const persistedTextSaved =
    persistedReadiness?.textSavedCurrent ??
    Boolean(
      campaign?.smsEnabled &&
        campaign.smsSavedAt &&
        campaign.smsBody &&
        campaign.smsRenderedBody,
    );
  const hasSavedSmsDraft = Boolean(
    campaign && !smsChangedSinceSave && persistedTextSaved,
  );
  const selectedChannelsSaved = Boolean(
    campaign && !emailChangedSinceSave && hasSavedSmsDraft,
  );
  const smsSaved = hasSavedSmsDraft;
  const persistedSmsPreview = useMemo<SmsPreview | null>(() => {
    if (!campaign?.smsEnabled || !campaign.smsRenderedBody) {
      return null;
    }

    return {
      body: campaign.smsRenderedBody,
      characterCount:
        campaign.smsCharacterCount || campaign.smsRenderedBody.length,
      editableBody: campaign.smsBody || "",
      encoding: campaign.smsEncoding || "GSM-7",
      segmentCount: campaign.smsSegmentCount || 0,
    };
  }, [
    campaign?.smsBody,
    campaign?.smsCharacterCount,
    campaign?.smsEnabled,
    campaign?.smsEncoding,
    campaign?.smsRenderedBody,
    campaign?.smsSegmentCount,
  ]);
  const defaultEmailPreviewHtml = useMemo(
    () => localEmailPreviewHtml(emailPreviewSnapshot),
    [emailPreviewSnapshot],
  );
  const defaultSmsPreview = useMemo(
    () => localSmsPreview(smsPreviewSnapshot),
    [smsPreviewSnapshot],
  );
  const activeSmsPreview = smsPreview;
  const displaySmsPreview = activeSmsPreview || defaultSmsPreview;
  const smsTestModalPreview =
    smsPreview && !smsPreviewOutdated ? smsPreview : persistedSmsPreview;
  const canUseSmsControls = textWorkspaceUnlocked && !isSendStarted;
  const emailDraftVersion = campaign?.emailDraftVersion || campaign?.version || 0;
  const smsDraftVersion = campaign?.smsDraftVersion || 0;
  const emailPreviewCurrent = Boolean(
    campaign &&
      !emailPreviewOutdated &&
      !emailChangedSinceSave &&
      (persistedReadiness?.emailPreviewCurrent ??
        Boolean(
          campaign.emailPreviewGeneratedAt &&
            campaign.emailPreviewVersion === emailDraftVersion,
        )),
  );
  const smsPreviewCurrent = Boolean(
    campaign &&
      !smsPreviewOutdated &&
      !smsChangedSinceSave &&
      (persistedReadiness?.textPreviewCurrent ??
        Boolean(
          campaign.smsPreviewGeneratedAt &&
            campaign.smsPreviewVersion === smsDraftVersion,
        )),
  );
  const emailTestCurrent = Boolean(
    campaign &&
      !emailChangedSinceSave &&
      !emailPreviewOutdated &&
      (persistedReadiness?.emailTestCurrent ??
        Boolean(
          campaign.testedAt &&
            campaign.testMessageId &&
            campaign.emailTestVersion &&
            campaign.emailTestVersion === emailDraftVersion,
        )),
  );
  const smsTestAcceptedForCurrentDraft = Boolean(
    campaign &&
      !smsChangedSinceSave &&
      !smsPreviewOutdated &&
      (persistedReadiness?.textTestCurrent ??
        Boolean(
          campaign.smsTestedAt &&
            campaign.smsTestMessageSid &&
            campaign.smsTestVersion &&
            campaign.smsTestVersion === smsDraftVersion &&
            campaign.smsTestTransport === "sms" &&
            (campaign.smsTestStatus === "accepted" ||
              campaign.smsTestStatus === "delivered"),
        )),
  );
  const canRequestEmailTest =
    Boolean(campaign) &&
    emailSaved &&
    emailPreviewCurrent &&
    testSendEnabled &&
    !isSendStarted;
  const canRequestSmsTest =
    Boolean(campaign) &&
    smsSaved &&
    smsPreviewCurrent &&
    Boolean(smsTestReadiness?.ready) &&
    !isSendStarted;
  const smsProductionReady = smsBulkSendEnabled && smsBulkInfraReady;
  const canSaveEmailContent = Boolean(
    workflowStarted &&
      form.subject.trim() &&
      form.heading.trim() &&
      form.body.trim(),
  );
  const canSaveTextContent = Boolean(
    workflowStarted && campaign && form.smsBody.trim() && !isSendStarted,
  );
  const hasUnsavedWork = Boolean(
    workflowStarted &&
      (!campaign
        ? form.subject !== initialForm.subject ||
          form.heading !== initialForm.heading ||
          form.body !== initialForm.body ||
          form.ctaLabel !== initialForm.ctaLabel ||
          form.ctaUrl !== initialForm.ctaUrl ||
          form.smsBody !== initialForm.smsBody
        : emailChangedSinceSave || smsChangedSinceSave),
  );
  const anyModalOpen =
    emailTestModalOpen ||
    smsTestModalOpen ||
    Boolean(deleteTarget) ||
    newAnnouncementConfirmOpen ||
    sentHistoryOpen ||
    Boolean(selectedSubscriber) ||
    idleWarningOpen;

  useEffect(() => {
    currentCampaignIdRef.current = campaign?.id || null;
  }, [campaign?.id]);

  const usesReducedMotion = useCallback(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  const scrollToElement = useCallback(
    (
      ref: { current: HTMLElement | null },
      options: { block?: ScrollLogicalPosition; focus?: boolean } = {},
    ) => {
      const target = ref.current;

      if (!target) {
        return;
      }

      const rect = target.getBoundingClientRect();
      const block = options.block || "center";
      const top =
        block === "start"
          ? Math.max(0, window.scrollY + rect.top - 24)
          : Math.max(
              0,
              window.scrollY +
                rect.top +
                rect.height / 2 -
                window.innerHeight / 2,
            );

      window.scrollTo({
        top,
        behavior: usesReducedMotion() ? "auto" : "smooth",
      });

      if (options.focus) {
        window.setTimeout(
          () => target.focus({ preventScroll: true }),
          usesReducedMotion() ? 0 : 350,
        );
      }
    },
    [usesReducedMotion],
  );

  const delayedScrollToElement = useCallback(
    (
      ref: { current: HTMLElement | null },
      options: {
        block?: ScrollLogicalPosition;
        delayMs?: number;
        focus?: boolean;
        skipIfModalOpen?: boolean;
      } = {},
    ) => {
      const delay = usesReducedMotion() ? 0 : options.delayMs ?? 350;

      window.setTimeout(() => {
        if (options.skipIfModalOpen && anyModalOpen) {
          return;
        }

        scrollToElement(ref, {
          block: options.block,
          focus: options.focus,
        });
      }, delay);
    },
    [anyModalOpen, scrollToElement, usesReducedMotion],
  );

  const dismissFocusGuide = useCallback(() => {
    setFocusGuideVisible(false);
    setFocusGuideDirection(null);
  }, []);

  const refreshIdleDeadline = useCallback(() => {
    idleDeadlineRef.current = Date.now() + ADMIN_IDLE_TIMEOUT_MS;
  }, []);

  const touchAdminSession = useCallback(async () => {
    const response = await adminFetch("/api/admin/session/touch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });
    await parseJsonResponse(response);
    lastHeartbeatAtRef.current = Date.now();
  }, []);

  const touchAdminSessionIfNeeded = useCallback(() => {
    const now = Date.now();

    if (
      document.visibilityState !== "visible" ||
      now >= idleDeadlineRef.current ||
      now - lastHeartbeatAtRef.current < 60_000
    ) {
      return;
    }

    touchAdminSession().catch(() => undefined);
  }, [touchAdminSession]);

  const recordAdminActivity = useCallback(() => {
    if (document.visibilityState !== "visible") {
      return;
    }

    refreshIdleDeadline();
    setIdleCountdown(formatIdleCountdown(ADMIN_IDLE_WARNING_DURATION_MS));
    setIdleWarningOpen(false);
    touchAdminSessionIfNeeded();
  }, [refreshIdleDeadline, touchAdminSessionIfNeeded]);

  const clearSensitiveClientState = useCallback(() => {
    setAudience(null);
    setAudienceRefreshError(null);
    setCampaign(null);
    setDeleteTarget(null);
    setEmailTestModalOpen(false);
    setEmailTestModalConfirmed(false);
    setEmailPreviewOutdated(false);
    setFieldErrors({});
    setForm({ ...initialForm, smsEnabled: true });
    setEmailPreviewSnapshot({ ...initialForm, smsEnabled: true });
    setMessage(null);
    setPreview(null);
    setPreviewMode("html");
    setProgress(null);
    setSmsPreview(null);
    setSmsPreviewOutdated(false);
    setSmsPreviewSnapshot(initialForm.smsBody);
    setSmsTestMessageSid(null);
    setSmsTestModalOpen(false);
    setSmsTestModalConfirmed(false);
    setSmsTestModalState(null);
    setSmsTestRecipient(null);
    setSmsTestReadiness(null);
    setGuidanceHighlight(null);
    setSaveHighlight(null);
    setSentHistoryOpen(false);
    setStartPhrase("");
    setTestSendMessageId(null);
    setWorkflowStarted(false);
  }, []);

  const handleIdleSignOut = useCallback(async () => {
    clearSensitiveClientState();
    setIdleWarningOpen(false);
    window.sessionStorage.removeItem(ADMIN_PRESENCE_SESSION_KEY);
    await signOut({
      callbackUrl: "/admin",
      redirect: true,
    });
  }, [clearSensitiveClientState]);

  useEffect(() => {
    const navigation = performance.getEntriesByType("navigation")[0] as
      | PerformanceNavigationTiming
      | undefined;
    const navigationType = navigation?.type;

    if (
      navigationType === "reload" ||
      navigationType === "back_forward"
    ) {
      window.sessionStorage.removeItem(ADMIN_PRESENCE_SESSION_KEY);
      clearSensitiveClientState();
      signOut({ callbackUrl: "/admin", redirect: true }).catch(() => undefined);
      return;
    }

    window.sessionStorage.setItem(ADMIN_PRESENCE_SESSION_KEY, "active");

    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) {
        return;
      }

      window.sessionStorage.removeItem(ADMIN_PRESENCE_SESSION_KEY);
      clearSensitiveClientState();
      signOut({ callbackUrl: "/admin", redirect: true }).catch(() => undefined);
    };

    window.addEventListener("pageshow", onPageShow);

    return () => {
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [clearSensitiveClientState]);

  function sortVisibleDrafts(nextDrafts: CampaignDraft[]) {
    const visible = nextDrafts.slice(0, 20);
    const byUpdatedAtDesc = (a: CampaignDraft, b: CampaignDraft) =>
      b.updatedAt.localeCompare(a.updatedAt);
    const byPinnedAtDesc = (a: CampaignDraft, b: CampaignDraft) =>
      (b.pinnedAt || b.updatedAt).localeCompare(a.pinnedAt || a.updatedAt);
    const pinned = visible
      .filter((draft) => draft.isPinned)
      .sort(byPinnedAtDesc)
      .slice(0, 5);
    const unpinned = visible
      .filter((draft) => !draft.isPinned)
      .sort(byUpdatedAtDesc)
      .slice(0, Math.max(0, 5 - pinned.length));

    return [...pinned, ...unpinned];
  }

  function isBlockedPlaceholder(value: string) {
    return isUnsafeTestPlaceholder(value);
  }

  function validateEmailBeforeSave() {
    const nextErrors: Partial<Record<keyof FormValues, string>> = {};

    if (!form.subject.trim()) {
      nextErrors.subject = "Add a subject before saving.";
    } else if (isBlockedPlaceholder(form.subject)) {
      nextErrors.subject = "Replace test placeholder text before saving.";
    }

    if (!form.heading.trim()) {
      nextErrors.heading = "Add a heading before saving.";
    } else if (isBlockedPlaceholder(form.heading)) {
      nextErrors.heading = "Replace test placeholder text before saving.";
    }

    if (!form.body.trim()) {
      nextErrors.body = "Add email copy before saving.";
    } else if (isBlockedPlaceholder(form.body)) {
      nextErrors.body = "Replace test placeholder text before saving.";
    }

    setFieldErrors(nextErrors);

    if (Object.keys(nextErrors).length) {
      setMessage({
        tone: "error",
        text: "Complete the email before saving it.",
      });
      return false;
    }

    return true;
  }

  function validateTextBeforeSave() {
    const nextErrors: Partial<Record<keyof FormValues, string>> = {};

    if (!form.smsBody.trim()) {
      nextErrors.smsBody = "Add text message copy before saving.";
    } else if (isBlockedPlaceholder(form.smsBody)) {
      nextErrors.smsBody =
        "Replace test placeholder text before saving.";
    }

    setFieldErrors(nextErrors);

    if (Object.keys(nextErrors).length) {
      setMessage({
        tone: "error",
        text: "Complete the text message before saving it.",
      });
      return false;
    }

    return true;
  }

  async function refreshDrafts(options?: { silent?: boolean }) {
    const requestSeq = draftsRequestSeqRef.current + 1;
    draftsRequestSeqRef.current = requestSeq;

    if (!options?.silent) {
      setBusyAction((current) => current || "refresh");
    }
    try {
      const response = await adminFetch("/api/admin/email-campaigns", {
        cache: "no-store",
      });
      const payload = await parseJsonResponse(response);
      if (draftsRequestSeqRef.current === requestSeq) {
        setDrafts(payload.drafts || []);
      }
    } finally {
      if (!options?.silent) {
        setBusyAction((current) => (current === "refresh" ? null : current));
      }
    }
  }

  async function refreshAudienceOverview() {
    try {
      const response = await adminFetch("/api/admin/audience/summary", {
        cache: "no-store",
      });
      const payload = await parseJsonResponse(response);
      setAudienceOverview(payload.summary || null);
      setAudienceOverviewError(null);
    } catch (error) {
      setAudienceOverview(null);
      setAudienceOverviewError(
        error instanceof Error
          ? error.message
          : "Could not load current audience totals.",
      );
    }
  }

  async function loadSubscribers(options?: {
    filter?: AdminSubscriberPriorityFilter;
    page?: number;
    search?: string;
    silent?: boolean;
    sort?: AdminSubscriberSort;
  }) {
    const requestSeq = subscriberListRequestSeqRef.current + 1;
    subscriberListRequestSeqRef.current = requestSeq;
    const page = options?.page ?? subscriberPage;
    const filter = options?.filter ?? subscriberPriorityFilter;
    const search = options?.search ?? subscriberSearch;
    const sort = options?.sort ?? subscriberSort;
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(subscriberPageSize),
      priority: filter,
      sort,
    });

    if (search.trim()) {
      params.set("search", search.trim());
    }

    if (!options?.silent) {
      setBusyAction((current) => current || "subscriberList");
    }

    try {
      const response = await adminFetch(`/api/admin/subscribers?${params}`, {
        cache: "no-store",
      });
      const payload = await parseJsonResponse(response);

      if (subscriberListRequestSeqRef.current !== requestSeq) {
        return;
      }

      setSubscriberList(payload.items || []);
      setSubscriberPage(payload.page || page);
      setSubscriberTotalCount(payload.totalCount || 0);
      setSubscriberTotalPages(payload.totalPages || 1);
      setSubscriberPriorityCount(payload.priorityCount || 0);
      setSubscriberPriorityLimit(payload.priorityLimit || 300);
      setSubscriberError(null);
    } catch (error) {
      if (subscriberListRequestSeqRef.current !== requestSeq) {
        return;
      }

      setSubscriberError(
        error instanceof Error
          ? error.message
          : "Could not load beta subscribers.",
      );
    } finally {
      if (!options?.silent) {
        setBusyAction((current) =>
          current === "subscriberList" ? null : current,
        );
      }
    }
  }

  async function exportSubscribers() {
    if (isBusy) {
      return;
    }

    const params = new URLSearchParams({
      priority: subscriberPriorityFilter,
      sort: subscriberSort,
    });

    if (subscriberSearch.trim()) {
      params.set("search", subscriberSearch.trim());
    }

    setBusyAction("subscriberExport");
    setSubscriberError(null);

    try {
      const response = await adminFetch(
        `/api/admin/subscribers/export?${params}`,
        { cache: "no-store" },
      );

      if (!response.ok) {
        const payload = await response.json().catch(() => null);

        if (response.status === 401 || payload?.code === "admin_auth_required") {
          throw new Error("Your admin session expired. Sign in again and retry.");
        }

        throw new Error(
          payload?.message ||
            "Beta subscriber export could not be generated. Please try again.",
        );
      }

      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") || "";
      const filenameMatch = disposition.match(/filename="?([^";]+)"?/i);
      const filename =
        filenameMatch?.[1] ||
        `suppvis-beta-subscribers-${new Date()
          .toISOString()
          .slice(0, 10)}.xlsx`;
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      setSubscriberError(
        error instanceof Error
          ? error.message
          : "Beta subscriber export could not be generated. Please try again.",
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function loadSubscriberSuggestions(search: string) {
    const trimmed = search.trim();
    const requestSeq = subscriberSuggestionsSeqRef.current + 1;
    subscriberSuggestionsSeqRef.current = requestSeq;

    if (!trimmed) {
      setSubscriberSuggestions([]);
      setSubscriberSuggestionsLoading(false);
      setSubscriberSuggestionIndex(-1);
      return;
    }

    setSubscriberSuggestionsLoading(true);

    const params = new URLSearchParams({
      page: "1",
      pageSize: String(SUBSCRIBER_SUGGESTION_LIMIT),
      priority: subscriberPriorityFilter,
      search: trimmed,
      sort: "name_asc",
    });

    try {
      const response = await adminFetch(`/api/admin/subscribers?${params}`, {
        cache: "no-store",
      });
      const payload = await parseJsonResponse(response);

      if (subscriberSuggestionsSeqRef.current !== requestSeq) {
        return;
      }

      setSubscriberSuggestions(payload.items || []);
      setSubscriberSuggestionIndex(payload.items?.length ? 0 : -1);
    } catch {
      if (subscriberSuggestionsSeqRef.current !== requestSeq) {
        return;
      }

      setSubscriberSuggestions([]);
      setSubscriberSuggestionIndex(-1);
    } finally {
      if (subscriberSuggestionsSeqRef.current === requestSeq) {
        setSubscriberSuggestionsLoading(false);
      }
    }
  }

  async function loadPriorityOptions() {
    const [priorityResponse, standardResponse] = await Promise.all([
      adminFetch(
        "/api/admin/subscribers?page=1&pageSize=100&priority=priority&sort=signup_order_asc",
        { cache: "no-store" },
      ),
      adminFetch(
        "/api/admin/subscribers?page=1&pageSize=100&priority=standard&sort=signup_order_asc",
        { cache: "no-store" },
      ),
    ]);
    const [priorityPayload, standardPayload] = await Promise.all([
      parseJsonResponse(priorityResponse),
      parseJsonResponse(standardResponse),
    ]);
    setPriorityOptions(priorityPayload.items || []);
    setStandardOptions(standardPayload.items || []);
  }

  async function openSubscriber(subscriber: AdminBetaSubscriber) {
    setBusyAction("subscriberDetail");
    setSubscriberActionMessage(null);
    setSubscriberPriorityReplacementId("");

    try {
      const response = await adminFetch(`/api/admin/subscribers/${subscriber.id}`, {
        cache: "no-store",
      });
      const payload = await parseJsonResponse(response);
      const detail = payload.subscriber as AdminBetaSubscriber;
      setSelectedSubscriber(detail);
      setSubscriberNotesDraft(detail.adminNotes || "");
      await loadPriorityOptions();
    } catch (error) {
      setSubscriberError(
        error instanceof Error
          ? error.message
          : "Could not open subscriber details.",
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function saveSubscriberNotes() {
    if (!selectedSubscriber || isBusy) {
      return;
    }

    setBusyAction("subscriberNotes");
    setSubscriberActionMessage(null);

    try {
      const response = await adminFetch(
        `/api/admin/subscribers/${selectedSubscriber.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            expectedVersion: selectedSubscriber.subscriberAdminVersion,
            notes: subscriberNotesDraft,
          }),
        },
      );
      const payload = await parseJsonResponse(response);
      const next = payload.subscriber as AdminBetaSubscriber;
      setSelectedSubscriber(next);
      setSubscriberNotesDraft(next.adminNotes || "");
      setSubscriberActionMessage({
        tone: "success",
        text: "Subscriber notes saved.",
      });
      await loadSubscribers({ silent: true });
    } catch (error) {
      setSubscriberActionMessage({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : "Could not save subscriber notes.",
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function updateSubscriberPriority(priority: boolean) {
    if (!selectedSubscriber || isBusy) {
      return;
    }

    setBusyAction("subscriberPriority");
    setSubscriberActionMessage(null);

    try {
      const response = await adminFetch(
        `/api/admin/subscribers/${selectedSubscriber.id}/priority`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            expectedVersion: selectedSubscriber.subscriberAdminVersion,
            priority,
            replacementSubscriberId:
              subscriberPriorityReplacementId || undefined,
          }),
        },
      );
      const payload = await parseJsonResponse(response);
      const next = payload.subscriber as AdminBetaSubscriber;
      setSelectedSubscriber(next);
      setSubscriberNotesDraft(next.adminNotes || "");
      setSubscriberPriorityReplacementId("");
      setSubscriberActionMessage({
        tone: "success",
        text: priority
          ? "Subscriber promoted to priority."
          : "Subscriber removed from priority.",
      });
      await Promise.all([
        loadSubscribers({ silent: true }),
        loadPriorityOptions(),
        refreshAudienceOverview(),
      ]);
    } catch (error) {
      setSubscriberActionMessage({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : "Could not update priority status.",
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function refreshSentAnnouncements() {
    setBusyAction((current) => current || "sentHistory");
    try {
      const response = await adminFetch(
        "/api/admin/email-campaigns?view=sent",
        {
          cache: "no-store",
        },
      );
      const payload = await parseJsonResponse(response);
      setSentAnnouncements(payload.sent || []);
    } finally {
      setBusyAction((current) =>
        current === "sentHistory" ? null : current,
      );
    }
  }

  async function fetchProgress(campaignId: string) {
    const response = await adminFetch(
      `/api/admin/email-campaigns/${campaignId}/progress`,
      { cache: "no-store" },
    );
    const payload = await parseJsonResponse(response);
    if (currentCampaignIdRef.current === campaignId) {
      setProgress(payload.progress);
    }
    return payload.progress as ProgressSummary;
  }

  async function refreshSmsTestReadiness(target = campaign) {
    if (!target) {
      setSmsTestReadiness(null);
      return null;
    }

    try {
      const response = await adminFetch(
        `/api/admin/email-campaigns/${target.id}/sms-test-readiness?expectedVersion=${target.version}`,
        { cache: "no-store" },
      );
      const payload = await parseJsonResponse(response);
      setSmsTestReadiness(payload.readiness || null);
      return payload.readiness as SmsTestReadiness | null;
    } catch {
      setSmsTestReadiness({
        adminCampaignsEnabled: false,
        featureEnabled: false,
        mappingConfigValid: true,
        mappingFound: false,
        maskedPhone: null,
        phoneValid: false,
        ready: false,
        reason: "sms_test_disabled",
        sessionAuthorized: false,
        smsPreviewCurrent: false,
        textSaved: false,
        twilioConfigured: false,
        versionMatches: false,
      });
      return null;
    }
  }

  useEffect(() => {
    refreshDrafts().catch((error) => {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not load drafts.",
      });
    });
    refreshAudienceOverview().catch(() => undefined);
  }, []);

  useEffect(() => {
    loadSubscribers({ silent: true }).catch(() => undefined);
  }, [subscriberPage, subscriberPriorityFilter, subscriberSearch, subscriberSort]);

  useEffect(() => {
    if (!subscriberSuggestionsOpen || !subscriberSearchInput.trim()) {
      setSubscriberSuggestions([]);
      setSubscriberSuggestionsLoading(false);
      setSubscriberSuggestionIndex(-1);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      loadSubscriberSuggestions(subscriberSearchInput).catch(() => undefined);
    }, SUBSCRIBER_SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [subscriberPriorityFilter, subscriberSearchInput, subscriberSuggestionsOpen]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState !== "visible") {
        return;
      }

      refreshDrafts({ silent: true }).catch(() => undefined);
    }, 15_000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    refreshIdleDeadline();

    const activityEvents = [
      "click",
      "focusin",
      "input",
      "keydown",
      "pointerdown",
      "pointermove",
      "scroll",
    ];

    const onActivity = (event: Event) => {
      if (event.type === "pointermove" || event.type === "scroll") {
        const now = Date.now();

        if (now - focusGuidePointerThrottleRef.current < 1000) {
          return;
        }

        focusGuidePointerThrottleRef.current = now;
      }

      recordAdminActivity();
    };

    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, onActivity, {
        passive: true,
      });
    });

    return () => {
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, onActivity);
      });
    };
  }, [recordAdminActivity, refreshIdleDeadline]);

  useEffect(() => {
    const activityEvents = [
      "change",
      "click",
      "focusin",
      "input",
      "keydown",
      "paste",
      "pointerdown",
      "pointermove",
      "scroll",
    ];

    const onWorkflowActivity = (event: Event) => {
      if (!workflowStarted && !focusGuideVisible) {
        return;
      }

      if (
        event.target instanceof Element &&
        event.target.closest("[data-subscriber-management]")
      ) {
        return;
      }

      if (event.type === "scroll" && workflowGuideScrollInProgressRef.current) {
        return;
      }

      if (event.type === "pointermove" || event.type === "scroll") {
        const now = Date.now();

        if (now - workflowGuideActivityThrottleRef.current < 1000) {
          return;
        }

        workflowGuideActivityThrottleRef.current = now;
      }

      dismissFocusGuide();
      setFocusGuideResetSignal((value) => value + 1);
    };

    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, onWorkflowActivity, {
        passive: true,
      });
    });

    return () => {
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, onWorkflowActivity);
      });
    };
  }, [dismissFocusGuide, focusGuideVisible, workflowStarted]);

  useEffect(() => {
    if (heartbeatIntervalRef.current) {
      window.clearInterval(heartbeatIntervalRef.current);
    }

    heartbeatIntervalRef.current = window.setInterval(() => {
      const now = Date.now();

      if (
        idleWarningOpen ||
        document.visibilityState !== "visible" ||
        now >= idleDeadlineRef.current ||
        now - lastHeartbeatAtRef.current < ADMIN_HEARTBEAT_INTERVAL_MS
      ) {
        return;
      }

      touchAdminSession().catch(() => undefined);
    }, ADMIN_HEARTBEAT_INTERVAL_MS);

    return () => {
      if (heartbeatIntervalRef.current) {
        window.clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
    };
  }, [idleWarningOpen, touchAdminSession]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") {
        return;
      }

      const remaining = idleDeadlineRef.current - Date.now();

      if (remaining <= 0) {
        setIdleCountdown("0:00");
        handleIdleSignOut().catch(() => undefined);
        return;
      }

      if (remaining <= ADMIN_IDLE_WARNING_DURATION_MS) {
        previousFocusRef.current =
          document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        setIdleCountdown(formatIdleCountdown(remaining));
        setIdleWarningOpen(true);
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [handleIdleSignOut, idleWarningOpen]);

  useEffect(() => {
    if (idleTimerRef.current) {
      window.clearInterval(idleTimerRef.current);
    }

    idleTimerRef.current = window.setInterval(() => {
      const remaining = idleDeadlineRef.current - Date.now();

      if (remaining <= 0) {
        setIdleCountdown("0:00");
        handleIdleSignOut().catch(() => undefined);
        return;
      }

      if (remaining <= ADMIN_IDLE_WARNING_DURATION_MS) {
        previousFocusRef.current =
          document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        setIdleCountdown(formatIdleCountdown(remaining));
        setIdleWarningOpen(true);
        return;
      }

      setIdleWarningOpen(false);
      setIdleCountdown(formatIdleCountdown(ADMIN_IDLE_WARNING_DURATION_MS));
    }, 1000);

    return () => {
      if (idleTimerRef.current) {
        window.clearInterval(idleTimerRef.current);
        idleTimerRef.current = null;
      }
    };
  }, [handleIdleSignOut]);

  useEffect(() => {
    return () => {
      if (focusGuideTimeoutRef.current) {
        window.clearTimeout(focusGuideTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setTestSendMessageId(null);
    setSmsPreview(null);
    setSmsPreviewOutdated(false);
    setEmailPreviewOutdated(false);
    setSmsTestMessageSid(null);
    setSmsTestRecipient(null);
    setSmsTestModalState(null);
    const hydratedAudience = audienceFromCampaign(campaign);
    setAudience(hydratedAudience);
    setAudienceRefreshError(audienceRefreshWarning(hydratedAudience));
    setStartPhrase("");
    setProgress(null);
    setSmsTestReadiness(null);
  }, [campaign?.id]);

  useEffect(() => {
    if (!campaign || !isSendStarted) {
      return;
    }

    let canceled = false;

    fetchProgress(campaign.id).catch(() => undefined);

    if (
      campaign.status !== "queueing" &&
      campaign.status !== "queued" &&
      campaign.status !== "sending"
    ) {
      return () => {
        canceled = true;
      };
    }

    const interval = window.setInterval(() => {
      if (!canceled) {
        fetchProgress(campaign.id).catch(() => undefined);
      }
    }, 5000);

    return () => {
      canceled = true;
      window.clearInterval(interval);
    };
  }, [campaign?.id, campaign?.status, isSendStarted]);

  useEffect(() => {
    if (!campaign?.id || !campaign.smsTestMessageSid) {
      return;
    }

    const smsStatus = (
      campaign.smsTestStatus ||
      campaign.smsTestProviderStatus ||
      ""
    ).toLowerCase();

    if (
      smsStatus === "delivered" ||
      smsStatus === "failed" ||
      smsStatus === "undelivered"
    ) {
      return;
    }

    let canceled = false;
    const interval = window.setInterval(async () => {
      try {
        const response = await adminFetch(
          `/api/admin/email-campaigns/${campaign.id}`,
          {
            cache: "no-store",
          },
        );
        const payload = await parseJsonResponse(response);

        if (!canceled && payload.campaign) {
          updateCampaignFromPartial(payload.campaign);
          refreshDrafts({ silent: true }).catch(() => undefined);
        }
      } catch {
        // The next explicit admin action will surface authorization or network issues.
      }
    }, 5000);

    return () => {
      canceled = true;
      window.clearInterval(interval);
    };
  }, [
    campaign?.id,
    campaign?.smsTestMessageSid,
    campaign?.smsTestProviderStatus,
    campaign?.smsTestStatus,
  ]);

  function updateField<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setAudience(null);
    setAudienceRefreshError(null);
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
    if (
      key === "body" ||
      key === "ctaLabel" ||
      key === "ctaUrl" ||
      key === "heading" ||
      key === "messageType" ||
      key === "subject"
    ) {
      setEmailPreviewOutdated(true);
      setTestSendMessageId(null);
    }
    if (key === "smsBody" || key === "smsEnabled") {
      setSmsPreviewOutdated(true);
      setSmsTestMessageSid(null);
      setSmsTestRecipient(null);
      setSmsTestReadiness(null);
      setSmsTestModalState(null);
    }
  }

  function updateAudienceSegment(nextSegment: BetaAudienceSegment) {
    setAudienceSegment(nextSegment);
    setAudience(null);
    setAudienceRefreshError(null);
    setStartPhrase("");
    setMessage({
      tone: "info",
      text: `Audience set to ${audienceSegmentLabel(nextSegment)}. Refresh recipient counts before sending.`,
    });
  }

  function updateCampaignFromPartial(partial: Partial<CampaignDraft>) {
    setCampaign((current) => {
      if (!current) {
        return current;
      }

      if (partial.id && partial.id !== current.id) {
        return current;
      }

      if (
        typeof partial.version === "number" &&
        typeof current.version === "number" &&
        partial.version < current.version
      ) {
        return current;
      }

      const next = {
        ...current,
        ...partial,
        readiness:
          partial.readiness === undefined ? undefined : partial.readiness,
      };
      const hasAudiencePatch =
        partial.audienceCountedAt !== undefined ||
        partial.audienceVersion !== undefined ||
        partial.audienceEmailEligible !== undefined ||
        partial.audienceSmsEligible !== undefined ||
        partial.audienceEmailStatus !== undefined ||
        partial.audienceSmsStatus !== undefined ||
        partial.audienceEmailErrorCode !== undefined ||
        partial.audienceSmsErrorCode !== undefined ||
        partial.audienceLastErrorCode !== undefined ||
        partial.audienceLastErrorAt !== undefined;

      if (hasAudiencePatch) {
        const nextAudience = audienceFromCampaign(next);
        setAudience(nextAudience);
        setAudienceRefreshError(audienceRefreshWarning(nextAudience));
      }

      return next;
    });
  }

  function startAnotherAnnouncement() {
    if (isBusy) {
      return;
    }

    if (hasUnsavedWork) {
      setNewAnnouncementConfirmOpen(true);
      return;
    }

    beginNewAnnouncement();
  }

  function beginNewAnnouncement() {
    setAudience(null);
    setAudienceRefreshError(null);
    setAudienceSegment("all");
    setCampaign(null);
    setDeleteTarget(null);
    setEmailTestModalOpen(false);
    setEmailTestModalConfirmed(false);
    setEmailPreviewOutdated(false);
    setFieldErrors({});
    setForm({ ...initialForm, smsEnabled: true });
    setEmailPreviewSnapshot({ ...initialForm, smsEnabled: true });
    setMessage(null);
    setPreview(null);
    setPreviewMode("html");
    setProgress(null);
    setSmsPreview(null);
    setSmsPreviewOutdated(false);
    setSmsPreviewSnapshot(initialForm.smsBody);
    setSmsTestMessageSid(null);
    setSmsTestModalOpen(false);
    setSmsTestModalConfirmed(false);
    setSmsTestModalState(null);
    setSmsTestRecipient(null);
    setSmsTestReadiness(null);
    setGuidanceHighlight(null);
    setSaveHighlight(null);
    setSentHistoryOpen(false);
    setStartPhrase("");
    setTestSendMessageId(null);
    setWorkflowStarted(true);
    window.setTimeout(() => {
      scrollToElement(emailWorkspaceRef, { block: "center" });
      window.setTimeout(() => {
        firstEmailFieldRef.current?.focus({ preventScroll: true });
      }, usesReducedMotion() ? 0 : 350);
    }, usesReducedMotion() ? 0 : 350);
  }

  async function createEmailDraft() {
    if (!validateEmailBeforeSave()) {
      return;
    }

    setBusyAction("saveEmail");
    setMessage(null);

    try {
      const response = await adminFetch("/api/admin/email-campaigns", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          body: form.body,
          ctaLabel: form.ctaLabel,
          ctaUrl: form.ctaUrl,
          heading: form.heading,
          messageType: form.messageType,
          subject: form.subject,
        }),
      });
      const payload = await parseJsonResponse(response);
      setCampaign(payload.campaign);
      setAudienceSegment(payload.campaign?.audienceSegment || "all");
      setAudience(audienceFromCampaign(payload.campaign));
      setAudienceRefreshError(null);
      setMessage({
        tone: "success",
        text: `Email saved at ${new Date(
          payload.campaign.updatedAt,
        ).toLocaleTimeString()}.`,
      });
      await refreshDrafts();
      setGuidanceHighlight("emailPreview");
      window.setTimeout(() => setGuidanceHighlight(null), 1800);
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not save email.",
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function saveEmailDraft() {
    if (!campaign) {
      return createEmailDraft();
    }

    if (!validateEmailBeforeSave()) {
      return;
    }

    setBusyAction("saveEmail");
    setMessage(null);

    try {
      const response = await adminFetch(`/api/admin/email-campaigns/${campaign.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          body: form.body,
          ctaLabel: form.ctaLabel,
          ctaUrl: form.ctaUrl,
          expectedVersion: campaign.version,
          heading: form.heading,
          messageType: form.messageType,
          saveChannel: "email",
          subject: form.subject,
        }),
      });
      const payload = await parseJsonResponse(response);
      setCampaign(payload.campaign);
      setAudienceSegment(payload.campaign?.audienceSegment || audienceSegment);
      setAudience(audienceFromCampaign(payload.campaign));
      setAudienceRefreshError(null);
      setMessage({
        tone: "success",
        text: `Email saved at ${new Date(
          payload.campaign.updatedAt,
        ).toLocaleTimeString()}.`,
      });
      await refreshDrafts();
      setGuidanceHighlight("emailPreview");
      window.setTimeout(() => setGuidanceHighlight(null), 1800);
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not save email.",
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function saveTextDraft() {
    if (!campaign) {
      setMessage({
        tone: "error",
        text: "Save the email before saving the text message.",
      });
      scrollToElement(emailWorkspaceRef, { block: "center" });
      return;
    }

    if (!validateTextBeforeSave()) {
      return;
    }

    setBusyAction("saveSms");
    setMessage(null);

    try {
      const response = await adminFetch(`/api/admin/email-campaigns/${campaign.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          expectedVersion: campaign.version,
          saveChannel: "sms",
          smsBody: form.smsBody,
        }),
      });
      const payload = await parseJsonResponse(response);
      setCampaign(payload.campaign);
      setAudienceSegment(payload.campaign?.audienceSegment || audienceSegment);
      setAudience(audienceFromCampaign(payload.campaign));
      setAudienceRefreshError(null);
      setMessage({
        tone: "success",
        text: `Text saved at ${new Date(
          payload.campaign.updatedAt,
        ).toLocaleTimeString()}.`,
      });
      await refreshDrafts();
      await refreshSmsTestReadiness(payload.campaign);
      setGuidanceHighlight("smsPreview");
      window.setTimeout(() => setGuidanceHighlight(null), 1800);
    } catch (error) {
      setMessage({
        tone: "error",
        text:
          error instanceof Error ? error.message : "Could not save text.",
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function loadDraft(id: string) {
    setBusyAction("load");
    setMessage(null);

    try {
      const response = await adminFetch(`/api/admin/email-campaigns/${id}`, {
        cache: "no-store",
      });
      const payload = await parseJsonResponse(response);
      const loadedForm = campaignToForm(payload.campaign);
      const loadedAudience = audienceFromCampaign(payload.campaign);
      setCampaign(payload.campaign);
      setAudienceSegment(payload.campaign?.audienceSegment || "all");
      setAudience(loadedAudience);
      setAudienceRefreshError(audienceRefreshWarning(loadedAudience));
      setForm(loadedForm);
      setEmailPreviewSnapshot(loadedForm);
      setFieldErrors({});
      setPreview(null);
      setSmsPreview(null);
      setSmsPreviewSnapshot(loadedForm.smsBody);
      setEmailPreviewOutdated(false);
      setSmsPreviewOutdated(false);
      setSmsTestReadiness(null);
      setMessage({ tone: "info", text: "Announcement loaded." });
      setWorkflowStarted(true);
      await refreshSmsTestReadiness(payload.campaign);
      delayedScrollToElement(emailWorkspaceRef, { block: "center" });
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not load draft.",
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function deleteDraft(target: CampaignDraft) {
    if (!canDeleteDraft(target)) {
      setMessage({
        tone: "error",
        text: "This draft can no longer be deleted.",
      });
      return;
    }

    setDeleteTarget(target);
  }

  async function confirmDeleteDraft() {
    if (!deleteTarget) {
      return;
    }

    const target = deleteTarget;
    const deletingOpenAnnouncement = campaign?.id === target.id;
    setBusyAction("delete");
    setMessage(null);

    try {
      const response = await adminFetch(`/api/admin/email-campaigns/${target.id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          expectedVersion: target.version,
        }),
      });
      await parseJsonResponse(response);
      setDrafts((current) => current.filter((draft) => draft.id !== target.id));
      if (deletingOpenAnnouncement) {
        setAudience(null);
        setAudienceRefreshError(null);
        setCampaign(null);
        setEmailPreviewOutdated(false);
        setEmailTestModalConfirmed(false);
        setEmailTestModalOpen(false);
        setFieldErrors({});
        setForm({ ...initialForm, smsEnabled: true });
        setEmailPreviewSnapshot({ ...initialForm, smsEnabled: true });
        setPreview(null);
        setProgress(null);
        setSmsPreview(null);
        setSmsPreviewOutdated(false);
        setSmsPreviewSnapshot(initialForm.smsBody);
        setSmsTestMessageSid(null);
        setSmsTestModalConfirmed(false);
        setSmsTestModalOpen(false);
        setSmsTestModalState(null);
        setSmsTestRecipient(null);
        setSmsTestReadiness(null);
        setStartPhrase("");
        setTestSendMessageId(null);
        setWorkflowStarted(false);
      }
      setDeleteTarget(null);
      setMessage({ tone: "success", text: "Draft deleted." });
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not delete draft.",
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function togglePin(target: CampaignDraft) {
    if (isBusy || pinningId) {
      return;
    }

    setPinningId(target.id);
    setMessage(null);

    try {
      const response = await adminFetch(
        `/api/admin/email-campaigns/${target.id}/pin`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            expectedVersion: target.version,
            pinned: !target.isPinned,
          }),
        },
      );
      const payload = await parseJsonResponse(response);
      const partial = payload.campaign as Partial<CampaignDraft>;

      if (campaign?.id === target.id) {
        updateCampaignFromPartial(partial);
      }

      setDrafts((current) =>
        sortVisibleDrafts(
          current.map((draft) =>
            draft.id === target.id ? { ...draft, ...partial } : draft,
          ),
        ),
      );
      setMessage({
        tone: "success",
        text: partial.isPinned ? "Announcement pinned." : "Announcement unpinned.",
      });
      await refreshDrafts();
    } catch (error) {
      setMessage({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : "Could not update the pin.",
      });
    } finally {
      setPinningId(null);
    }
  }

  function scrollToTop() {
    window.scrollTo({
      top: 0,
      behavior: usesReducedMotion() ? "auto" : "smooth",
    });
    window.setTimeout(
      () => topRef.current?.focus({ preventScroll: true }),
      usesReducedMotion() ? 0 : 350,
    );
  }

  async function generatePreview() {
    if (!emailSaved) {
      setMessage({
        tone: "info",
        text: "Save the email before generating its preview.",
      });
      setSaveHighlight("email");
      scrollToElement(emailSaveRef, { block: "center" });
      window.setTimeout(() => setSaveHighlight(null), 1500);
      return;
    }

    setBusyAction("preview");
    setMessage(null);

    try {
      const response = await adminFetch("/api/admin/email-campaigns/preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          body: form.body,
          campaignId: campaign?.id,
          ctaLabel: form.ctaLabel,
          ctaUrl: form.ctaUrl,
          expectedVersion: campaign?.version,
          heading: form.heading,
          messageType: form.messageType,
          subject: form.subject,
        }),
      });
      const payload = await parseJsonResponse(response);
      setPreview(payload.preview);
      setEmailPreviewSnapshot(form);
      setEmailPreviewOutdated(false);
      if (payload.campaign) {
        updateCampaignFromPartial(payload.campaign);
        await refreshSmsTestReadiness({ ...campaign, ...payload.campaign });
      }
      setMessage({ tone: "success", text: "Preview generated." });

      if (workflowStarted) {
        delayedScrollToElement(previewRef, { block: "center" });
      }
    } catch (error) {
      setMessage({
        tone: "error",
        text:
          error instanceof Error ? error.message : "Could not generate preview.",
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function generateSmsPreview() {
    if (!smsSaved) {
      setMessage({
        tone: "info",
        text: "Save the text before generating its preview.",
      });
      setSaveHighlight("text");
      scrollToElement(textSaveRef, { block: "center" });
      window.setTimeout(() => setSaveHighlight(null), 1500);
      return;
    }

    if (!canUseSmsControls || isBusy) {
      return;
    }

    setBusyAction("smsPreview");
    setMessage(null);

    try {
      const response = await adminFetch("/api/admin/email-campaigns/sms-preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          campaignId: campaign?.id,
          expectedVersion: campaign?.version,
          smsBody: form.smsBody,
          smsEnabled: true,
        }),
      });
      const payload = await parseJsonResponse(response);
      setSmsPreview(payload.preview);
      setSmsPreviewSnapshot(form.smsBody);
      setSmsPreviewOutdated(false);
      if (payload.campaign) {
        updateCampaignFromPartial(payload.campaign);
        await refreshSmsTestReadiness({ ...campaign, ...payload.campaign });
      }
      setMessage({ tone: "success", text: "Text preview generated." });

      if (workflowStarted) {
        delayedScrollToElement(smsPreviewRef, { block: "center" });
      }
    } catch (error) {
      setMessage({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : "Could not generate text preview.",
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function requestTestSend() {
    if (!campaign || !canRequestEmailTest || !emailTestModalConfirmed || isBusy) {
      return;
    }

    setBusyAction("test");
    setMessage(null);

    try {
      const response = await adminFetch(
        `/api/admin/email-campaigns/${campaign.id}/test-send`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        },
      );
      const payload = await parseJsonResponse(response);

      if (payload.status === "sent") {
        setMessage({
          tone: "success",
          text: `Test email accepted by SES for ${adminEmail}.`,
        });
        setTestSendMessageId(payload.messageId || null);
        window.setTimeout(() => {
          scrollToElement(textWorkspaceRef, { block: "center" });
          window.setTimeout(() => {
            if (form.smsBody.trim()) {
              textHeadingRef.current?.focus({ preventScroll: true });
            } else {
              textBodyRef.current?.focus({ preventScroll: true });
            }
          }, usesReducedMotion() ? 0 : 350);
        }, usesReducedMotion() ? 0 : 800);
      } else {
        setMessage({
          tone: "info",
          text: payload.message || "Test email sending is disabled.",
        });
      }

      setEmailTestModalConfirmed(false);
      setEmailTestModalOpen(false);

      if (payload.campaign) {
        updateCampaignFromPartial(payload.campaign);
      }
      await refreshDrafts();
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not send test.",
      });
    } finally {
      setBusyAction(null);
    }
  }

  function closeSmsTestModal() {
    setSmsTestModalOpen(false);
    setSmsTestModalConfirmed(false);
    setSmsTestModalState(null);
    window.setTimeout(
      () => textTestButtonRef.current?.focus({ preventScroll: true }),
      usesReducedMotion() ? 0 : 50,
    );
  }

  async function requestSmsTestSend() {
    if (
      !campaign ||
      !canRequestSmsTest ||
      !smsTestModalConfirmed ||
      isBusy
    ) {
      return;
    }

    setBusyAction("smsTest");
    setMessage(null);
    setSmsTestModalState({
      tone: "info",
      message: "Sending test...",
    });

    try {
      const response = await adminFetch(
        `/api/admin/email-campaigns/${campaign.id}/sms-test-send`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            expectedVersion: campaign.version,
          }),
        },
      );
      const payload = await parseJsonResponse(response);

      if (payload.status === "sent" && payload.messageSid) {
        const providerStatus = payload.providerStatus || "queued";
        setMessage({
          tone: "success",
          text: `Text test accepted by Twilio for ${
            payload.maskedPhone || currentSmsTestMaskedPhone || "your test number"
          }. Provider status: ${providerStatus}.`,
        });
        setSmsTestModalState({
          tone: "success",
          message: "Accepted by Twilio.",
          providerStatus,
        });
      } else {
        setMessage({
          tone: payload.status === "failed" ? "error" : "info",
          text:
            payload.message ||
            (payload.status === "failed"
              ? "The test text could not be sent right now."
              : "Text testing is not enabled."),
        });
        setSmsTestModalState({
          tone: payload.status === "failed" ? "error" : "info",
          message:
            payload.message ||
            (payload.status === "failed"
              ? "The test text could not be sent right now."
              : "Text testing is not enabled."),
          providerStatus: payload.providerStatus || null,
        });
      }

      setSmsTestRecipient(payload.maskedPhone || null);
      setSmsTestMessageSid(payload.messageSid || null);

      if (payload.campaign) {
        updateCampaignFromPartial(payload.campaign);
        await refreshSmsTestReadiness(payload.campaign);
      }
      await refreshDrafts();

      if (payload.status === "sent" && payload.messageSid) {
        window.setTimeout(
          () => {
            closeSmsTestModal();
            delayedScrollToElement(deliveryRef, {
              block: "center",
              delayMs: 250,
              skipIfModalOpen: false,
            });
          },
          usesReducedMotion() ? 0 : 950,
        );
      }
    } catch (error) {
      const errorText =
        error instanceof Error ? error.message : "Could not send test text.";
      setMessage({
        tone: "error",
        text: errorText,
      });
      setSmsTestModalState({
        tone: "error",
        message: errorText,
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function calculateAudienceForCampaign(campaignId: string) {
    const response = await adminFetch(
      `/api/admin/email-campaigns/${campaignId}/audience`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ audienceSegment }),
      },
    );
    const payload = await parseJsonResponse(response);
    if (currentCampaignIdRef.current !== campaignId) {
      return payload.audience as AudienceSummary;
    }

    const nextAudience = payload.audience as AudienceSummary;
    if (payload.campaign) {
      updateCampaignFromPartial(payload.campaign);
      setAudienceSegment(payload.campaign.audienceSegment || audienceSegment);
    }
    setAudience(nextAudience);
    setAudienceRefreshError(audienceRefreshWarning(nextAudience));
    setStartPhrase("");
    return nextAudience;
  }

  async function calculateAudience() {
    if (!campaign || isBusy || !selectedChannelsSaved || !adminTestsReady) {
      return;
    }

    setBusyAction("audience");
    setMessage(null);
    setAudienceRefreshError(null);

    try {
      const nextAudience = await calculateAudienceForCampaign(campaign.id);
      const warning = audienceRefreshWarning(nextAudience);
      setMessage({
        tone: warning ? "info" : "success",
        text: warning || "Recipient counts refreshed.",
      });
    } catch (error) {
      const errorText =
        error instanceof Error ? error.message : "Could not count recipients.";
      setAudienceRefreshError(errorText);
      setMessage({
        tone: "error",
        text: errorText,
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function startCampaign() {
    if (!campaign || !currentAudience || !canStart || isBusy) {
      return;
    }

    if (
      !hasAnyEligibleAudience ||
      !selectedDeliveryReady ||
      !confirmationPhraseMatches
    ) {
      setMessage({
        tone: "info",
        text:
          deliveryBlockedReason ||
          "Refresh recipients and type the exact confirmation phrase before sending.",
      });
      return;
    }

    setBusyAction("start");
    setMessage(null);

    try {
      let workingCampaign = campaign;

      if (workingCampaign.status !== "approved") {
        const approveResponse = await adminFetch(
          `/api/admin/email-campaigns/${workingCampaign.id}/approve`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ expectedVersion: workingCampaign.version }),
          },
        );
        const approvePayload = await parseJsonResponse(approveResponse);

        if (approvePayload.campaign) {
          workingCampaign = { ...workingCampaign, ...approvePayload.campaign };
          updateCampaignFromPartial(approvePayload.campaign);
        }
      }

      const response = await adminFetch(
        `/api/admin/email-campaigns/${workingCampaign.id}/start`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            expectedVersion: workingCampaign.version,
            confirmationPhrase: startPhrase,
          }),
        },
      );
      const payload = await parseJsonResponse(response);

      if (payload.status === "disabled") {
        setMessage({
          tone: "info",
          text:
            payload.message ||
            "Sending is not available yet because the email delivery system is still being prepared.",
        });
      } else {
        setMessage({
          tone: "success",
          text: `Announcement queued. ${payload.emailQueuedCount || 0} email recipients queued. ${payload.smsQueuedCount || 0} text recipients queued.`,
        });
        window.setTimeout(() => {
          scrollToElement(topRef, { block: "start", focus: true });
        }, usesReducedMotion() ? 0 : 1200);
      }

      if (payload.campaign) {
        updateCampaignFromPartial(payload.campaign);
        fetchProgress(payload.campaign.id).catch(() => undefined);
      }
      await refreshDrafts();
    } catch (error) {
      setMessage({
        tone: "error",
        text:
          error instanceof Error ? error.message : "Could not send announcement.",
      });
    } finally {
      setBusyAction(null);
    }
  }

  const messageToneClass =
    message?.tone === "success"
      ? "border-accent/25 bg-accent/10 text-teal-50"
      : message?.tone === "error"
        ? "border-red-400/25 bg-red-400/10 text-red-100"
        : "border-white/10 bg-[#080D12] text-text-secondary";

  const previewsReady = Boolean(emailPreviewCurrent && smsPreviewCurrent);
  const emailTestReady = emailTestCurrent;
  const smsTestReady = smsTestAcceptedForCurrentDraft;
  const adminTestsReady = Boolean(emailTestReady && smsTestReady);
  const persistedAudience =
    !emailChangedSinceSave &&
    !smsChangedSinceSave &&
    (campaign?.audienceSegment || "all") === audienceSegment
      ? audienceFromCampaign(campaign)
      : null;
  const currentAudience =
    (audience?.audienceSegment || "all") === audienceSegment
      ? audience
      : persistedAudience;
  const canStart = Boolean(
    campaign &&
      selectedChannelsSaved &&
      previewsReady &&
      adminTestsReady &&
      currentAudience,
  );
  const emailAudienceStatus = currentAudience?.emailStatus || "not_counted";
  const smsAudienceStatus = currentAudience?.smsStatus || "not_counted";
  const emailAudienceAvailable = emailAudienceStatus === "success";
  const smsAudienceAvailable = smsAudienceStatus === "success";
  const emailAudienceCount = emailAudienceAvailable
    ? currentAudience?.eligibleCount || 0
    : 0;
  const smsAudienceCount = smsAudienceAvailable
    ? currentAudience?.smsEligibleCount || 0
    : 0;
  const hasAnyEligibleAudience = emailAudienceCount > 0 || smsAudienceCount > 0;
  const hasAnyAvailableAudience =
    emailAudienceAvailable || smsAudienceAvailable;
  const hasUnavailableAudience =
    emailAudienceStatus === "failed" || smsAudienceStatus === "failed";
  const emailProductionReady = bulkSendEnabled && bulkInfraReady;
  const emailDeliveryRequired = emailAudienceCount > 0;
  const smsDeliveryRequired = smsAudienceCount > 0;
  const selectedDeliveryReady = Boolean(
    hasAnyEligibleAudience &&
      !hasUnavailableAudience &&
      (!emailDeliveryRequired || emailProductionReady) &&
      (!smsDeliveryRequired || smsProductionReady),
  );
  function readinessBlockerCopy() {
    if (!emailSaved) {
      return "Save the email before sending.";
    }

    if (!smsSaved) {
      return "Save the text message before sending.";
    }

    if (!emailPreviewCurrent) {
      return campaign?.emailPreviewGeneratedAt
        ? "Email preview is out of date."
        : "Generate the email preview first.";
    }

    if (!smsPreviewCurrent) {
      return campaign?.smsPreviewGeneratedAt
        ? "Text preview is out of date."
        : "Generate the text preview first.";
    }

    if (!emailTestReady) {
      return campaign?.testedAt || campaign?.testMessageId
        ? "Email test is out of date."
        : "Send the email test first.";
    }

    if (!smsTestReady) {
      return campaign?.smsTestedAt || campaign?.smsTestMessageSid
        ? "Text test is out of date."
        : "Send the text test first.";
    }

    return "Refresh recipient counts first.";
  }
  const confirmationPhraseMatches = Boolean(
    currentAudience?.confirmationPhrase &&
      startPhrase === currentAudience.confirmationPhrase,
  );
  const deliveryBlockedReason = !currentAudience
    ? "Refresh recipient counts first."
    : hasUnavailableAudience
      ? "Resolve the unavailable subscriber source before approving or sending."
    : !hasAnyAvailableAudience
      ? "Recipient counts could not be refreshed."
      : !hasAnyEligibleAudience
        ? "No eligible subscribers are currently available."
        : emailDeliveryRequired && !emailProductionReady
          ? "Email delivery is still being prepared."
          : smsDeliveryRequired && !smsProductionReady
            ? "Text delivery queue is not ready yet."
            : !canStart
              ? readinessBlockerCopy()
              : !confirmationPhraseMatches
                ? "Type the exact confirmation phrase."
                : "";
  const smsReadinessReason = smsTestReadiness?.reason;
  const currentSmsTestMaskedPhone =
    smsTestReadiness?.maskedPhone || smsTestRecipientMasked;
  const currentSmsProviderStatus =
    campaign?.smsTestProviderStatus || campaign?.smsTestStatus || null;
  const currentSmsSender = campaign?.smsTestSenderMasked || null;
  const smsTestDisabledCopy = !smsSaved
    ? "Save before sending a test."
    : !smsPreviewCurrent || smsReadinessReason === "sms_preview_required"
      ? "Generate preview before sending a test."
    : smsReadinessReason === "sms_test_disabled" || !smsTestSendEnabled
      ? "Text testing is disabled in Production."
      : smsReadinessReason === "mapping_invalid" || smsTestRecipientConfigError
        ? "Text testing is not configured correctly yet."
      : smsReadinessReason === "mapping_missing" ||
            (!smsTestReadiness && !currentSmsTestMaskedPhone)
          ? "No test number is configured for this admin."
          : smsReadinessReason === "twilio_config_incomplete"
            ? "Twilio test configuration is incomplete."
            : smsReadinessReason === "stale_version"
              ? "Save the current text message before sending a test."
              : smsReadinessReason === "admin_campaigns_disabled"
                ? "Admin email campaigns are disabled."
                : smsTestReadiness && !smsTestReadiness.sessionAuthorized
                  ? "Your session expired. Sign in again."
                  : smsTestReadiness?.ready
                    ? ""
                    : "Checking text test readiness.";
  const recipientsReviewed = Boolean(
    currentAudience && hasAnyAvailableAudience && !hasUnavailableAudience,
  );
  const announcementQueued =
    campaign?.status === "queueing" ||
    campaign?.status === "queued" ||
    campaign?.status === "sending" ||
    campaign?.status === "completed" ||
    campaign?.status === "completed_with_failures";
  const workflowActiveIndex = (() => {
    if (announcementQueued) {
      return 6;
    }

    if (!selectedChannelsSaved) {
      return 0;
    }

    if (!previewsReady) {
      return 1;
    }

    if (!emailTestReady) {
      return 2;
    }

    if (!smsTestReady) {
      return 3;
    }

    if (
      !currentAudience ||
      hasUnavailableAudience ||
      !hasAnyAvailableAudience ||
      !hasAnyEligibleAudience
    ) {
      return 4;
    }

    return 5;
  })();
  const workflowStepContent = [
    {
      label: "Draft email & text",
      detail: selectedChannelsSaved
        ? "Email and text drafts are saved."
        : workflowStarted
          ? emailSaved && !smsSaved
            ? "Text still needs to be saved."
            : smsSaved && !emailSaved
              ? "Email still needs to be saved."
              : "Save both drafts."
          : "Click New announcement to begin.",
    },
    {
      label: "Preview email & text",
      detail: previewsReady
        ? "Email and text previews are ready."
        : selectedChannelsSaved
          ? !emailPreviewCurrent && !smsPreviewCurrent
            ? "Generate both previews."
            : !emailPreviewCurrent
              ? "Generate the email preview."
              : "Generate the text preview."
          : "Save the draft first.",
    },
    {
      label: "Test email",
      detail: emailTestReady
        ? "Email test is complete."
        : emailSaved && emailPreviewCurrent
          ? "Send one test email to yourself."
          : emailSaved
            ? "Generate the email preview first."
            : "Save the email first.",
    },
    {
      label: "Test text",
      detail: smsTestReady
        ? "Text test is complete."
        : smsSaved && smsPreviewCurrent
          ? smsTestDisabledCopy || "Send one test text to yourself."
          : smsSaved
            ? "Generate the text preview first."
            : "Save the text first.",
    },
    {
      label: "Approve & review recipients",
      detail: recipientsReviewed && currentAudience
        ? `Email: ${currentAudience.eligibleCount}. Text: ${
            currentAudience.smsEligibleCount || 0
          }.`
        : adminTestsReady
          ? hasUnavailableAudience
            ? "Resolve the unavailable subscriber source."
            : currentAudience
            ? "Review the confirmation phrase."
            : "Refresh recipient counts."
          : "Complete admin tests first.",
    },
    {
      label: "Send announcement",
      detail:
        announcementQueued
          ? "The worker continues independently."
          : currentAudience && selectedDeliveryReady
            ? "Type the phrase, then approve and send."
            : deliveryBlockedReason || "Refresh recipient counts first.",
    },
  ] as const;
  const workflowSteps = workflowStepContent.map((step, index) => ({
    ...step,
    state:
      workflowActiveIndex === 6 || index < workflowActiveIndex
        ? "completed"
        : index === workflowActiveIndex
          ? "active"
          : "blocked",
  })) as Array<
    (typeof workflowStepContent)[number] & {
      state: "active" | "blocked" | "completed";
    }
  >;

  const nextWorkflowAction = useMemo<{
    key: NextActionKey;
    label: string;
    ref: { current: HTMLElement | null };
  } | null>(() => {
    if (announcementQueued || isSendStarted) {
      return null;
    }

    if (!workflowStarted) {
      return null;
    }

    if (!form.subject.trim()) {
      return {
        key: "emailSubject",
        label: "the Subject field",
        ref: firstEmailFieldRef,
      };
    }

    if (!form.heading.trim()) {
      return {
        key: "emailHeading",
        label: "the Heading field",
        ref: emailHeadingFieldRef,
      };
    }

    if (!form.body.trim()) {
      return {
        key: "emailBody",
        label: "the Email body field",
        ref: emailBodyRef,
      };
    }

    if (form.ctaUrl.trim() && !form.ctaLabel.trim()) {
      return {
        key: "emailCtaLabel",
        label: "the Link text field",
        ref: emailCtaLabelRef,
      };
    }

    if (form.ctaLabel.trim() && !form.ctaUrl.trim()) {
      return {
        key: "emailCtaUrl",
        label: "the Link URL field",
        ref: emailCtaUrlRef,
      };
    }

    if (!emailSaved) {
      return {
        key: "emailSave",
        label: "Save email",
        ref: emailSaveRef,
      };
    }

    if (!emailPreviewCurrent) {
      return {
        key: "emailPreview",
        label: "Generate preview",
        ref: emailPreviewButtonRef,
      };
    }

    if (!emailTestReady) {
      return {
        key: "emailTest",
        label: "Send test to myself",
        ref: emailTestButtonRef,
      };
    }

    if (!form.smsBody.trim()) {
      return {
        key: "smsBody",
        label: "the Text message field",
        ref: textBodyRef,
      };
    }

    if (!smsSaved) {
      return {
        key: "smsSave",
        label: "Save text",
        ref: textSaveRef,
      };
    }

    if (!smsPreviewCurrent) {
      return {
        key: "smsPreview",
        label: "Generate preview",
        ref: textPreviewButtonRef,
      };
    }

    if (!smsTestReady) {
      return {
        key: "smsTest",
        label: "Send test to myself",
        ref: textTestButtonRef,
      };
    }

    if (adminTestsReady && !currentAudience) {
      return {
        key: "recipientCount",
        label: "Refresh recipient count",
        ref: recipientCountButtonRef,
      };
    }

    if (
      currentAudience &&
      startPhrase !== currentAudience.confirmationPhrase
    ) {
      return {
        key: "startPhrase",
        label: "Type the confirmation phrase",
        ref: startPhraseInputRef,
      };
    }

    if (
      currentAudience &&
      canStart &&
      selectedDeliveryReady &&
      confirmationPhraseMatches
    ) {
      return {
        key: "sendAnnouncement",
        label: "Approve & send announcement",
        ref: sendAnnouncementButtonRef,
      };
    }

    return null;
  }, [
    adminTestsReady,
    announcementQueued,
    canStart,
    confirmationPhraseMatches,
    Boolean(currentAudience),
    currentAudience?.countedAt,
    currentAudience?.confirmationPhrase,
    emailPreviewOutdated,
    emailPreviewCurrent,
    emailSaved,
    emailTestReady,
    form.body,
    form.ctaLabel,
    form.ctaUrl,
    form.heading,
    form.smsBody,
    form.subject,
    isSendStarted,
    selectedDeliveryReady,
    smsPreviewCurrent,
    smsSaved,
    smsTestReady,
    startPhrase,
    workflowStarted,
  ]);

  useEffect(() => {
    if (!focusGuideVisible || !nextWorkflowAction) {
      return;
    }

    const dismissOnIntentionalInteraction = (event: Event) => {
      if (
        event.type !== "mousemove" &&
        event.type !== "click" &&
        event.type !== "keydown" &&
        event.type !== "pointerdown" &&
        event.type !== "input" &&
        event.type !== "focusin"
      ) {
        return;
      }

      dismissFocusGuide();
      setFocusGuideResetSignal((value) => value + 1);
    };

    window.addEventListener("mousemove", dismissOnIntentionalInteraction, {
      passive: true,
    });
    window.addEventListener("click", dismissOnIntentionalInteraction, {
      passive: true,
    });
    window.addEventListener("keydown", dismissOnIntentionalInteraction);
    window.addEventListener("pointerdown", dismissOnIntentionalInteraction, {
      passive: true,
    });
    window.addEventListener("input", dismissOnIntentionalInteraction, {
      passive: true,
    });
    window.addEventListener("focusin", dismissOnIntentionalInteraction, {
      passive: true,
    });

    return () => {
      window.removeEventListener("mousemove", dismissOnIntentionalInteraction);
      window.removeEventListener("click", dismissOnIntentionalInteraction);
      window.removeEventListener("keydown", dismissOnIntentionalInteraction);
      window.removeEventListener("pointerdown", dismissOnIntentionalInteraction);
      window.removeEventListener("input", dismissOnIntentionalInteraction);
      window.removeEventListener("focusin", dismissOnIntentionalInteraction);
    };
  }, [dismissFocusGuide, focusGuideVisible, nextWorkflowAction]);

  const guidedControlClass = (key: NextActionKey) =>
    focusGuideVisible && nextWorkflowAction?.key === key
      ? "relative z-[65] ring-2 ring-accent ring-offset-2 ring-offset-[#05090D] shadow-[0_0_28px_rgba(36,196,182,0.72),0_0_80px_rgba(36,196,182,0.28)]"
      : guidanceHighlight === key
        ? "ring-2 ring-accent ring-offset-2 ring-offset-[#0D1117] shadow-[0_0_34px_rgba(36,196,182,0.32)]"
        : "";

  function workflowCueText(action: {
    key: NextActionKey;
    label: string;
  }) {
    if (action.key === "startPhrase") {
      return "Type the confirmation phrase next.";
    }

    if (
      action.key === "emailSubject" ||
      action.key === "emailHeading" ||
      action.key === "emailBody" ||
      action.key === "emailCtaLabel" ||
      action.key === "emailCtaUrl" ||
      action.key === "smsBody"
    ) {
      return `Fill in ${action.label} next.`;
    }

    return `Click ${action.label} next.`;
  }

  useEffect(() => {
    if (focusGuideTimeoutRef.current) {
      window.clearTimeout(focusGuideTimeoutRef.current);
      focusGuideTimeoutRef.current = null;
    }

    setFocusGuideVisible(false);
    setFocusGuideDirection(null);

    if (
      anyModalOpen ||
      isBusy ||
      !nextWorkflowAction ||
      announcementQueued
    ) {
      return;
    }

    const delay = FOCUS_GUIDE_STEP_IDLE_MS;

    focusGuideTimeoutRef.current = window.setTimeout(() => {
      const target = nextWorkflowAction.ref.current;

      if (!target || anyModalOpen || isBusy) {
        return;
      }

      const rect = target.getBoundingClientRect();
      const below = rect.top > window.innerHeight - 96;
      const above = rect.bottom < 96;

      setFocusGuideDirection(below ? "below" : above ? "above" : null);
      setFocusGuideVisible(true);
      focusGuideTimeoutRef.current = null;

      if (below || above) {
        workflowGuideScrollInProgressRef.current = true;
        scrollToElement(nextWorkflowAction.ref, { block: "center" });
        window.setTimeout(
          () => {
            workflowGuideScrollInProgressRef.current = false;
            const nextRect = target.getBoundingClientRect();
            const stillBelow = nextRect.top > window.innerHeight - 96;
            const stillAbove = nextRect.bottom < 96;
            setFocusGuideDirection(
              stillBelow ? "below" : stillAbove ? "above" : null,
            );
          },
          usesReducedMotion() ? 0 : 750,
        );
      }
    }, delay);

    return () => {
      if (focusGuideTimeoutRef.current) {
        window.clearTimeout(focusGuideTimeoutRef.current);
        focusGuideTimeoutRef.current = null;
      }
    };
  }, [
    announcementQueued,
    anyModalOpen,
    focusGuideResetSignal,
    isBusy,
    nextWorkflowAction?.key,
    scrollToElement,
    usesReducedMotion,
  ]);

  useEffect(() => {
    if (!focusGuideVisible || !nextWorkflowAction?.ref.current) {
      return;
    }

    const updateDirection = () => {
      const target = nextWorkflowAction.ref.current;

      if (!target) {
        setFocusGuideDirection(null);
        return;
      }

      const rect = target.getBoundingClientRect();
      const below = rect.top > window.innerHeight - 96;
      const above = rect.bottom < 96;

      setFocusGuideDirection(below ? "below" : above ? "above" : null);
    };

    updateDirection();
    window.addEventListener("resize", updateDirection);
    window.addEventListener("scroll", updateDirection, { passive: true });

    return () => {
      window.removeEventListener("resize", updateDirection);
      window.removeEventListener("scroll", updateDirection);
    };
  }, [focusGuideVisible, nextWorkflowAction]);

  const stepTone = {
    active:
      "border-accent/70 bg-accent/15 text-teal-50 shadow-[0_0_30px_rgba(36,196,182,0.16)]",
    blocked: "border-white/10 bg-white/[0.03] text-text-muted",
    completed: "border-accent/20 bg-white/[0.04] text-text-secondary",
  };
  const emailAudienceDisplay = currentAudience
    ? emailAudienceAvailable
      ? String(currentAudience.eligibleCount)
      : "Unavailable"
    : "-";
  const smsAudienceDisplay = currentAudience
    ? smsAudienceAvailable
      ? String(currentAudience.smsEligibleCount || 0)
      : "Unavailable"
    : "-";
  const emailAudienceDetail = !currentAudience
    ? "No recipient count has been generated yet."
    : emailAudienceAvailable
      ? `${currentAudience.excludedCount} excluded or suppressed${currentAudience.duplicateCount ? `, ${currentAudience.duplicateCount} duplicates` : ""}`
      : currentAudience.emailErrorCode
        ? audienceErrorCopy(currentAudience.emailErrorCode)
        : "Email records could not be read.";
  const smsAudienceDetail = !currentAudience
    ? "No recipient count has been generated yet."
    : smsAudienceAvailable
      ? `${currentAudience.smsExcludedCount || 0} excluded or suppressed${currentAudience.smsDuplicateCount ? `, ${currentAudience.smsDuplicateCount} duplicates` : ""}`
      : currentAudience.smsErrorCode
        ? audienceErrorCopy(currentAudience.smsErrorCode)
        : "Text records could not be read.";
  const totalRecordsChecked =
    currentAudience && hasAnyAvailableAudience
      ? (emailAudienceAvailable ? currentAudience.totalCount || 0 : 0) +
        (smsAudienceAvailable ? currentAudience.smsTotalCount || 0 : 0)
      : null;

  const subscriberDeliverySection = (
    <section
      ref={deliveryRef}
      className="rounded-[8px] border border-white/10 bg-[#0D1117] p-6 shadow-2xl shadow-black/20"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
            Subscriber delivery
          </p>
          <h2 className="mt-2 font-headline text-2xl font-bold text-text-primary">
            Review recipients and send
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-text-secondary">
            Review the final email, text, and recipient counts before sending.
            You will be asked to type a confirmation phrase.
          </p>
        </div>
        <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-text-secondary">
          {isSendStarted
              ? status
              : currentAudience
                ? hasUnavailableAudience
                  ? "Audience issue"
                  : hasAnyEligibleAudience
                  ? "Audience counted"
                  : "No eligible subscribers"
                : "Count needed"}
        </span>
      </div>

      <div className="mt-4 rounded-[8px] border border-white/10 bg-[#080D12] p-4 text-sm leading-6 text-text-secondary">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-text-primary">
              Current beta audience
            </p>
            <p className="mt-1 text-xs text-text-muted">
              Counts are refreshed from the current subscriber databases.
            </p>
          </div>
          <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-text-muted">
            Last refreshed:{" "}
            {currentAudience?.countedAt
              ? new Date(currentAudience.countedAt).toLocaleString()
              : "Never"}
          </span>
        </div>

        <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-[8px] border border-white/10 bg-[#0D1117] p-3">
            <dt className="text-xs uppercase tracking-[0.12em] text-text-muted">
              Email subscribers
            </dt>
            <dd className="mt-1 text-2xl font-bold text-text-primary">
              {emailAudienceDisplay}
            </dd>
            <p className="mt-1 text-xs text-text-muted">
              {emailAudienceDetail}
            </p>
          </div>
          <div className="rounded-[8px] border border-white/10 bg-[#0D1117] p-3">
            <dt className="text-xs uppercase tracking-[0.12em] text-text-muted">
              Text subscribers
            </dt>
            <dd className="mt-1 text-2xl font-bold text-text-primary">
              {smsAudienceDisplay}
            </dd>
            <p className="mt-1 text-xs text-text-muted">
              {smsAudienceDetail}
            </p>
          </div>
          <div className="rounded-[8px] border border-white/10 bg-[#0D1117] p-3">
            <dt className="text-xs uppercase tracking-[0.12em] text-text-muted">
              Eligible for both
            </dt>
            <dd className="mt-1 text-2xl font-bold text-text-primary">
              {currentAudience?.receivingBothCount ?? "-"}
            </dd>
            <p className="mt-1 text-xs text-text-muted">
              A safe email-phone join is not enabled yet.
            </p>
          </div>
          <div className="rounded-[8px] border border-white/10 bg-[#0D1117] p-3">
            <dt className="text-xs uppercase tracking-[0.12em] text-text-muted">
              Total records checked
            </dt>
            <dd className="mt-1 text-2xl font-bold text-text-primary">
              {totalRecordsChecked ?? "-"}
            </dd>
            <p className="mt-1 text-xs text-text-muted">
              Email and text sources are counted separately.
            </p>
          </div>
        </dl>

        {currentAudience ? (
          <div
            className={`mt-4 rounded-[8px] border p-3 text-sm ${
              hasAnyEligibleAudience
                ? "border-accent/20 bg-accent/10 text-teal-50"
                : "border-yellow-400/20 bg-yellow-400/10 text-yellow-100"
            }`}
          >
            {!hasAnyAvailableAudience
              ? "Recipient counts could not be refreshed. Check the audience diagnostics below."
              : !hasAnyEligibleAudience && hasUnavailableAudience
                ? "One subscriber source is unavailable, and no eligible subscribers were found in the available source."
                : hasUnavailableAudience && emailAudienceCount > 0 && !smsAudienceAvailable
                  ? `Email has ${emailAudienceCount} eligible subscriber${emailAudienceCount === 1 ? "" : "s"}. Text subscriber eligibility is currently unavailable.`
                : hasUnavailableAudience && smsAudienceCount > 0 && !emailAudienceAvailable
                  ? `Text has ${smsAudienceCount} eligible subscriber${smsAudienceCount === 1 ? "" : "s"}. Email subscriber eligibility is currently unavailable.`
                : !hasAnyEligibleAudience
                  ? "There are currently no eligible beta subscribers. The announcement cannot be sent yet."
                  : emailAudienceCount > 0 && smsAudienceCount > 0
                    ? `Email will be sent to ${emailAudienceCount} eligible subscriber${emailAudienceCount === 1 ? "" : "s"}. Text will be sent to ${smsAudienceCount} eligible subscriber${smsAudienceCount === 1 ? "" : "s"}.`
                    : emailAudienceCount > 0
                      ? `Email will be sent to ${emailAudienceCount} eligible subscriber${emailAudienceCount === 1 ? "" : "s"}. No eligible text subscribers were found.`
                      : `Text will be sent to ${smsAudienceCount} eligible subscriber${smsAudienceCount === 1 ? "" : "s"}. No eligible email subscribers were found.`}
          </div>
        ) : (
          <p className="mt-4 rounded-[8px] border border-white/10 bg-[#0D1117] p-3 text-sm text-text-muted">
            No recipient count has been generated yet.
          </p>
        )}
        {audienceRefreshError ? (
          <div className="mt-4 rounded-[8px] border border-red-400/25 bg-red-400/10 p-3 text-sm leading-6 text-red-100">
            {audienceRefreshError}
          </div>
        ) : null}
        <details className="mt-4 rounded-[8px] border border-white/10 bg-[#0D1117] p-3 text-sm leading-6 text-text-secondary">
          <summary className="cursor-pointer font-semibold text-text-primary">
            Audience diagnostics
          </summary>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-[0.12em] text-text-muted">
                Email query status
              </dt>
              <dd>
                {adminStatusLabel(
                  currentAudience?.diagnostics?.emailQueryStatus,
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.12em] text-text-muted">
                Text query status
              </dt>
              <dd>
                {adminStatusLabel(
                  currentAudience?.diagnostics?.smsQueryStatus,
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.12em] text-text-muted">
                Email table / index
              </dt>
              <dd>
                {currentAudience?.diagnostics?.emailTableName || "-"} /{" "}
                {currentAudience?.diagnostics?.emailIndexName || "-"}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.12em] text-text-muted">
                Text table / index
              </dt>
              <dd>
                {currentAudience?.diagnostics?.smsTableName || "-"} /{" "}
                {currentAudience?.diagnostics?.smsIndexName || "-"}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.12em] text-text-muted">
                Email records examined
              </dt>
              <dd>{currentAudience?.diagnostics?.emailRecordsExamined ?? "-"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.12em] text-text-muted">
                Text records examined
              </dt>
              <dd>{currentAudience?.diagnostics?.smsRecordsExamined ?? "-"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.12em] text-text-muted">
                Email status groups
              </dt>
              <dd>
                {currentAudience?.diagnostics?.emailStatusGroups
                  ? Object.entries(
                      currentAudience.diagnostics.emailStatusGroups,
                    )
                      .map(
                        ([label, value]) =>
                          `${adminStatusLabel(label)}: ${value}`,
                      )
                      .join(", ")
                  : "Not available"}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.12em] text-text-muted">
                Text status groups
              </dt>
              <dd>
                {currentAudience?.diagnostics?.smsStatusGroups
                  ? Object.entries(currentAudience.diagnostics.smsStatusGroups)
                      .map(
                        ([label, value]) =>
                          `${adminStatusLabel(label)}: ${value}`,
                      )
                      .join(", ")
                  : "Not available"}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.12em] text-text-muted">
                Email query issue
              </dt>
              <dd>
                {currentAudience?.diagnostics?.emailErrorCode ? (
                  <>
                    <span>
                      {audienceErrorCopy(
                        currentAudience.diagnostics.emailErrorCode,
                      )}
                    </span>
                    <span className="mt-1 block font-mono text-xs text-text-muted">
                      {currentAudience.diagnostics.emailErrorCode}
                    </span>
                  </>
                ) : (
                  "None"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.12em] text-text-muted">
                Text query issue
              </dt>
              <dd>
                {currentAudience?.diagnostics?.smsErrorCode ? (
                  <>
                    <span>
                      {audienceErrorCopy(
                        currentAudience.diagnostics.smsErrorCode,
                      )}
                    </span>
                    <span className="mt-1 block font-mono text-xs text-text-muted">
                      {currentAudience.diagnostics.smsErrorCode}
                    </span>
                  </>
                ) : (
                  "None"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.12em] text-text-muted">
                Last refresh result
              </dt>
              <dd>
                {audienceRefreshError
                  ? audienceRefreshError
                  : currentAudience?.diagnostics?.lastRefreshResult ||
                    campaign?.audienceLastErrorCode ||
                    "No refresh yet"}
              </dd>
            </div>
          </dl>
        </details>
      </div>

      <div className="mt-4 rounded-[8px] border border-white/10 bg-[#080D12] p-4">
        <label className="block max-w-xl">
          <span className="text-sm font-semibold text-text-primary">
            Announcement audience
          </span>
          <select
            value={audienceSegment}
            onChange={(event) =>
              updateAudienceSegment(event.target.value as BetaAudienceSegment)
            }
            disabled={isBusy || isSendStarted}
            className="mt-2 w-full rounded-[8px] border border-white/10 bg-[#0D1117] px-3 py-3 text-sm text-text-primary outline-none transition focus:border-accent disabled:cursor-not-allowed disabled:opacity-60"
          >
            <option value="all">All beta subscribers</option>
            <option value="priority">Priority beta subscribers only</option>
            <option value="standard">
              Standard, non-priority beta subscribers only
            </option>
          </select>
        </label>
        <p className="mt-2 text-xs leading-5 text-text-muted">
          Current selection: {audienceSegmentLabel(audienceSegment)}. Counts are
          locked to this choice only after you click Refresh recipient count.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          ref={recipientCountButtonRef}
          onClick={calculateAudience}
          disabled={
            !campaign ||
            isBusy ||
            !selectedChannelsSaved ||
            !adminTestsReady
          }
          className={`${primaryButtonClass("dark")} ${guidedControlClass("recipientCount")}`}
        >
          {busyAction === "audience" ? "Counting..." : "Refresh recipient count"}
        </button>
      </div>

      <div className="mt-4 rounded-[8px] border border-white/10 bg-[#080D12] p-4 text-sm leading-6 text-text-secondary">
        <label className="block">
          <span className="font-semibold text-text-primary">
            Confirmation phrase
          </span>
          <code className="mt-2 block rounded-[8px] border border-white/10 bg-[#05090D] px-3 py-2 text-xs text-accent">
            {hasUnavailableAudience
              ? "Subscriber source unavailable"
              : currentAudience?.confirmationPhrase || "No eligible subscribers"}
          </code>
          <input
            ref={startPhraseInputRef}
            value={startPhrase}
            onChange={(event) => setStartPhrase(event.target.value)}
            disabled={
              isSendStarted ||
              !currentAudience ||
              !hasAnyEligibleAudience ||
              hasUnavailableAudience ||
              isBusy
            }
            placeholder={
              currentAudience
                ? hasUnavailableAudience
                  ? "Resolve subscriber count issue first"
                  : hasAnyEligibleAudience
                  ? "Type the exact phrase above"
                  : "No eligible subscribers"
                : "Refresh recipient counts first"
            }
            className={`mt-2 w-full rounded-[8px] border border-white/10 bg-[#080D12] px-4 py-3 text-sm text-text-primary outline-none transition placeholder:text-text-muted focus:border-accent disabled:cursor-not-allowed disabled:opacity-60 ${guidedControlClass("startPhrase")}`}
          />
        </label>
        <button
          type="button"
          ref={sendAnnouncementButtonRef}
          onClick={startCampaign}
          disabled={
            !campaign ||
            !canStart ||
            !selectedDeliveryReady ||
            !confirmationPhraseMatches ||
            isBusy
          }
          className={`mt-4 ${primaryButtonClass("amber")} ${guidedControlClass("sendAnnouncement")}`}
        >
          {busyAction === "start"
            ? "Queueing..."
            : "Approve & send announcement"}
        </button>
        {deliveryBlockedReason ? (
          <p className="mt-3 text-xs leading-5 text-yellow-100">
            {deliveryBlockedReason}
          </p>
        ) : (
          <p className="mt-3 text-xs leading-5 text-accent">
            The announcement is ready to send.
          </p>
        )}
      </div>

      {progress ? (
        <div className="mt-4 rounded-[8px] border border-white/10 bg-[#080D12] p-4 text-sm leading-6 text-text-secondary">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-semibold text-text-primary">
              {statusLabel(progress.campaignStatus)}
            </p>
            <button
              type="button"
              onClick={() =>
                campaign && fetchProgress(campaign.id).catch(() => undefined)
              }
              className="rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-text-secondary transition hover:border-accent/60 hover:text-accent"
            >
              Refresh progress
            </button>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
            {[
              ["Eligible", progress.eligible],
              ["Queued", progress.counts.queued],
              ["Sending", progress.counts.sending],
              ["Provider accepted", progress.counts.sent],
              ["Delivered", progress.counts.delivered],
              ["Delayed", progress.counts.delayed],
              ["Skipped", progress.counts.skipped],
              ["Failed", progress.counts.failed],
              ["Bounced", progress.counts.bounced],
              ["Complained", progress.counts.complained],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-[8px] border border-white/10 bg-[#0D1117] p-3"
              >
                <dt className="text-text-muted">{label}</dt>
                <dd className="mt-1 text-lg font-bold text-text-primary">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs leading-5 text-text-muted">
            Queued means ready for a channel worker. Provider accepted means
            SES or Twilio accepted the message. Delivered means the provider
            reported delivery.
          </p>
        </div>
      ) : null}
    </section>
  );

  const liveSubscriberSnapshotSection = (
    <section className="mb-5 rounded-[8px] border border-white/10 bg-[#0D1117] p-5 shadow-2xl shadow-black/20">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
            Current beta audience
          </p>
          <h2 className="mt-2 font-headline text-xl font-bold text-text-primary">
            Live subscriber snapshot
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-text-secondary">
            Informational totals load automatically from subscriber records.
            Sending still requires a manual recipient refresh for the open
            announcement.
          </p>
        </div>
        <button
          type="button"
          onClick={() => refreshAudienceOverview()}
          className="rounded-full border border-white/10 px-3 py-2 text-xs font-semibold text-text-secondary transition hover:border-accent/60 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
        >
          Refresh snapshot
        </button>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <div className="rounded-[8px] border border-white/10 bg-[#080D12] p-3">
          <p className="text-xs uppercase tracking-[0.12em] text-text-muted">
            Eligible email
          </p>
          <p className="mt-1 text-2xl font-bold text-text-primary">
            {audienceOverview
              ? audienceOverview.email.status === "success"
                ? audienceOverview.email.eligibleCount
                : "Unavailable"
              : "-"}
          </p>
        </div>
        <div className="rounded-[8px] border border-white/10 bg-[#080D12] p-3">
          <p className="text-xs uppercase tracking-[0.12em] text-text-muted">
            Eligible text
          </p>
          <p className="mt-1 text-2xl font-bold text-text-primary">
            {audienceOverview
              ? audienceOverview.sms.status === "success"
                ? audienceOverview.sms.eligibleCount
                : "Unavailable"
              : "-"}
          </p>
        </div>
        <div className="rounded-[8px] border border-white/10 bg-[#080D12] p-3">
          <p className="text-xs uppercase tracking-[0.12em] text-text-muted">
            Records checked
          </p>
          <p className="mt-1 text-2xl font-bold text-text-primary">
            {audienceOverview
              ? (audienceOverview.email.status === "success"
                  ? audienceOverview.email.totalCount
                  : 0) +
                (audienceOverview.sms.status === "success"
                  ? audienceOverview.sms.totalCount
                  : 0)
              : "-"}
          </p>
        </div>
        <div className="rounded-[8px] border border-white/10 bg-[#080D12] p-3">
          <p className="text-xs uppercase tracking-[0.12em] text-text-muted">
            Last checked
          </p>
          <p className="mt-1 text-sm font-semibold text-text-primary">
            {audienceOverview?.checkedAt
              ? new Date(audienceOverview.checkedAt).toLocaleString()
              : "Not checked yet"}
          </p>
        </div>
      </div>
      {audienceOverviewError ? (
        <p className="mt-3 rounded-[8px] border border-red-400/25 bg-red-400/10 p-3 text-sm text-red-100">
          {audienceOverviewError}
        </p>
      ) : audienceOverview?.refreshResult === "partial" ||
        audienceOverview?.refreshResult === "failed" ? (
        <p className="mt-3 rounded-[8px] border border-yellow-400/20 bg-yellow-400/10 p-3 text-sm text-yellow-100">
          {audienceOverview.email.status === "failed"
            ? `Email snapshot unavailable. ${audienceOverview.email.errorCode ? audienceErrorCopy(audienceOverview.email.errorCode) : ""}`
            : null}
          {audienceOverview.email.status === "failed" &&
          audienceOverview.sms.status === "failed"
            ? " "
            : null}
          {audienceOverview.sms.status === "failed"
            ? `Text snapshot unavailable. ${audienceOverview.sms.errorCode ? audienceErrorCopy(audienceOverview.sms.errorCode) : ""}`
            : null}
        </p>
      ) : null}

      <div
        data-subscriber-management="true"
        className="mt-5 rounded-[8px] border border-white/10 bg-[#080D12] p-4"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-headline text-lg font-bold text-text-primary">
              Beta subscriber management
            </h3>
            <p className="mt-1 text-sm leading-6 text-text-secondary">
              Search subscribers by name, email, or phone. Open a subscriber to
              edit internal notes or manage priority status.
            </p>
          </div>
          <div className="rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
            {subscriberPriorityCount} / {subscriberPriorityLimit} priority
          </div>
        </div>

        <form
          className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_190px_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            setSubscriberPage(1);
            setSubscriberSearch(subscriberSearchInput);
            setSubscriberSuggestionsOpen(false);
          }}
        >
          <label className="relative block">
            <span className="sr-only">Search beta subscribers</span>
            <input
              aria-autocomplete="list"
              aria-expanded={subscriberSuggestionsOpen}
              aria-controls="subscriber-search-suggestions"
              autoComplete="off"
              value={subscriberSearchInput}
              onBlur={() => {
                window.setTimeout(() => setSubscriberSuggestionsOpen(false), 150);
              }}
              onChange={(event) => {
                setSubscriberSearchInput(event.target.value);
                setSubscriberSuggestionsOpen(Boolean(event.target.value.trim()));
              }}
              onFocus={() => {
                if (subscriberSearchInput.trim()) {
                  setSubscriberSuggestionsOpen(true);
                }
              }}
              onKeyDown={(event) => {
                if (!subscriberSuggestionsOpen) {
                  return;
                }

                if (event.key === "Escape") {
                  setSubscriberSuggestionsOpen(false);
                  return;
                }

                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setSubscriberSuggestionIndex((index) =>
                    Math.min(subscriberSuggestions.length - 1, index + 1),
                  );
                  return;
                }

                if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setSubscriberSuggestionIndex((index) => Math.max(0, index - 1));
                  return;
                }

                if (event.key === "Enter" && subscriberSuggestionIndex >= 0) {
                  const suggestion = subscriberSuggestions[subscriberSuggestionIndex];

                  if (suggestion) {
                    event.preventDefault();
                    setSubscriberSuggestionsOpen(false);
                    openSubscriber(suggestion).catch(() => undefined);
                  }
                }
              }}
              placeholder="Search by name, email, or phone"
              className="w-full rounded-[8px] border border-white/10 bg-[#0D1117] px-3 py-2 text-sm text-text-primary outline-none transition placeholder:text-text-muted focus:border-accent"
            />
            {subscriberSuggestionsOpen ? (
              <div
                id="subscriber-search-suggestions"
                role="listbox"
                className="absolute z-40 mt-2 max-h-72 w-full overflow-y-auto rounded-[8px] border border-white/10 bg-[#080D12] p-1 shadow-2xl shadow-black/40"
              >
                {subscriberSuggestionsLoading ? (
                  <div className="px-3 py-2 text-sm text-text-secondary">
                    Searching...
                  </div>
                ) : subscriberSuggestions.length ? (
                  subscriberSuggestions.map((suggestion, index) => (
                    <button
                      key={suggestion.id}
                      type="button"
                      role="option"
                      aria-selected={index === subscriberSuggestionIndex}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        setSubscriberSuggestionsOpen(false);
                        openSubscriber(suggestion).catch(() => undefined);
                      }}
                      className={`block w-full rounded-[6px] px-3 py-2 text-left text-sm transition ${
                        index === subscriberSuggestionIndex
                          ? "bg-accent/15 text-text-primary"
                          : "text-text-secondary hover:bg-white/[0.05] hover:text-text-primary"
                      }`}
                    >
                      <span className="block font-semibold text-text-primary">
                        {suggestion.fullName}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-text-muted">
                        {suggestion.email}
                        {phoneDisplay(suggestion) !== "-"
                          ? ` - ${phoneDisplay(suggestion)}`
                          : ""}
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-2 text-sm text-text-secondary">
                    No subscribers match.
                  </div>
                )}
              </div>
            ) : null}
          </label>
          <AdminSelect
            label="Priority filter"
            value={subscriberPriorityFilter}
            options={SUBSCRIBER_PRIORITY_FILTER_OPTIONS}
            disabled={isBusy}
            onChange={(next) => {
              setSubscriberPriorityFilter(next);
              setSubscriberPage(1);
              setSubscriberSuggestionsOpen(false);
            }}
          />
          <AdminSelect
            label="Subscriber sort"
            value={subscriberSort}
            options={SUBSCRIBER_SORT_OPTIONS}
            disabled={isBusy}
            onChange={(next) => {
              setSubscriberSort(next);
              setSubscriberPage(1);
              setSubscriberSuggestionsOpen(false);
            }}
          />
          <button
            type="submit"
            disabled={isBusy}
            className={primaryButtonClass("dark")}
          >
            Search
          </button>
        </form>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-text-muted">
          <span>
            {subscriberTotalCount
              ? `Showing ${subscriberRangeStart}-${subscriberRangeEnd} of ${subscriberTotalCount} subscribers`
              : "Showing 0 of 0 subscribers"}
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => exportSubscribers()}
              disabled={isBusy}
              className="rounded-full border border-white/10 px-3 py-1 font-semibold text-text-secondary transition hover:border-accent/60 hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busyAction === "subscriberExport" ? "Exporting..." : "Export Excel"}
            </button>
            <button
              type="button"
              onClick={() => loadSubscribers()}
              disabled={isBusy}
              className="rounded-full border border-white/10 px-3 py-1 font-semibold text-text-secondary transition hover:border-accent/60 hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busyAction === "subscriberList" ? "Refreshing..." : "Refresh list"}
            </button>
          </div>
        </div>

        {subscriberError ? (
          <p className="mt-3 rounded-[8px] border border-red-400/25 bg-red-400/10 p-3 text-sm text-red-100">
            {subscriberError}
          </p>
        ) : null}

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-[840px] w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.12em] text-text-muted">
              <tr>
                <th className="py-2 pr-4 font-semibold">Name</th>
                <th className="py-2 pr-4 font-semibold">#</th>
                <th className="py-2 pr-4 font-semibold">Email</th>
                <th className="py-2 pr-4 font-semibold">Phone</th>
                <th className="py-2 pr-4 font-semibold">Status</th>
                <th className="py-2 pr-4 font-semibold">Priority</th>
                <th className="py-2 pr-4 font-semibold">Signup date</th>
                <th className="py-2 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {subscriberList.length ? (
                subscriberList.map((subscriber) => (
                  <tr key={subscriber.id} className="align-top">
                    <td className="py-3 pr-4 font-semibold text-text-primary">
                      {subscriber.fullName}
                    </td>
                    <td className="py-3 pr-4 text-text-secondary">
                      {subscriber.signupOrderNumber
                        ? `#${subscriber.signupOrderNumber}`
                        : "-"}
                    </td>
                    <td
                      className="max-w-[220px] truncate py-3 pr-4 text-text-secondary"
                      title={subscriber.email}
                    >
                      {subscriber.email}
                    </td>
                    <td
                      className="max-w-[160px] truncate py-3 pr-4 text-text-secondary"
                      title={phoneDisplay(subscriber)}
                    >
                      {phoneDisplay(subscriber)}
                    </td>
                    <td className="py-3 pr-4 text-text-secondary">
                      <span className="font-semibold text-text-primary">
                        Email:
                      </span>{" "}
                      {adminStatusLabel(subscriber.emailStatus)}
                      <br />
                      <span className="font-semibold text-text-primary">
                        Text:
                      </span>{" "}
                      {adminStatusLabel(subscriber.smsStatus)}
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={`rounded-full border px-2 py-1 text-xs font-semibold ${
                          subscriber.priorityBeta
                            ? "border-accent/25 bg-accent/10 text-accent"
                            : "border-white/10 bg-white/[0.03] text-text-secondary"
                        }`}
                      >
                        {subscriber.priorityBadge}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-text-secondary">
                      {formatOptionalDate(subscriber.createdAt)}
                    </td>
                    <td className="py-3">
                      <button
                        type="button"
                        onClick={() => openSubscriber(subscriber)}
                        disabled={isBusy}
                        className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-text-secondary transition hover:border-accent/60 hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={8}
                    className="py-8 text-center text-sm font-semibold text-text-secondary"
                  >
                    No beta subscribers match this view.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setSubscriberPage((page) => Math.max(1, page - 1))}
            disabled={isBusy || subscriberPage <= 1}
            className="rounded-full border border-white/10 px-3 py-2 text-xs font-semibold text-text-secondary transition hover:border-accent/60 hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-xs text-text-muted">
            Page {subscriberPage} of {subscriberTotalPages}
          </span>
          <button
            type="button"
            onClick={() =>
              setSubscriberPage((page) =>
                Math.min(subscriberTotalPages, page + 1),
              )
            }
            disabled={isBusy || subscriberPage >= subscriberTotalPages}
            className="rounded-full border border-white/10 px-3 py-2 text-xs font-semibold text-text-secondary transition hover:border-accent/60 hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );

  const recentAnnouncementsSection = (
    <section className="rounded-[8px] border border-white/10 bg-[#0D1117] p-5 shadow-2xl shadow-black/20">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
            Active work
          </p>
          <h2 className="mt-1 font-headline text-2xl font-bold text-text-primary">
            Recent announcements
          </h2>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <SecondaryButton
            disabled={isBusy}
            onClick={() =>
              refreshDrafts().catch(() =>
                setMessage({
                  tone: "error",
                  text: "Could not refresh announcements.",
                }),
              )
            }
          >
            {busyAction === "refresh" ? "Refreshing..." : "Refresh"}
          </SecondaryButton>
          <button
            type="button"
            onClick={() => {
              setSentHistoryOpen(true);
              refreshSentAnnouncements().catch(() =>
                setMessage({
                  tone: "error",
                  text: "Could not load sent announcements.",
                }),
              );
            }}
            disabled={isBusy}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-2 text-xs font-semibold text-text-secondary transition hover:border-accent/60 hover:text-accent active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <HistoryIcon />
            Sent announcements
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {drafts.length ? (
          drafts.map((draft) => {
            const pinLoading = pinningId === draft.id;
            const emailState = recentEmailState(draft);
            const textState = recentTextState(draft);

            return (
              <article
                key={draft.id}
                className="rounded-[8px] border border-white/10 bg-[#080D12] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-semibold text-text-primary">
                      {draft.subject}
                    </p>
                    <p className="mt-2 line-clamp-2 text-sm text-text-secondary">
                      {draft.heading}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      aria-label={
                        draft.isPinned
                          ? "Unpin announcement"
                          : "Pin announcement"
                      }
                      title={
                        draft.isPinned
                          ? "Unpin announcement"
                          : "Pin announcement"
                      }
                      onClick={(event) => {
                        event.stopPropagation();
                        togglePin(draft);
                      }}
                      disabled={isBusy || Boolean(pinningId)}
                      className={`inline-flex h-9 w-9 items-center justify-center rounded-full border text-xs transition duration-150 ease-out hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#080D12] disabled:pointer-events-none disabled:opacity-50 ${
                        draft.isPinned
                          ? "border-accent/40 bg-accent/15 text-accent"
                          : "border-white/10 bg-white/[0.03] text-text-muted hover:border-accent/50 hover:text-accent"
                      }`}
                    >
                      {pinLoading ? "..." : <PinIcon pinned={Boolean(draft.isPinned)} />}
                    </button>
                    <span className="rounded-full border border-accent/20 px-2 py-1 text-xs capitalize text-accent">
                      {statusLabel(draft.status)}
                    </span>
                  </div>
                </div>
                <dl className="mt-3 grid gap-2 text-xs text-text-muted sm:grid-cols-4">
                  <div>
                    <dt className="font-semibold text-text-secondary">Type</dt>
                    <dd>{messageTypeLabel(draft.messageType)}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-text-secondary">
                      Updated
                    </dt>
                    <dd>{new Date(draft.updatedAt).toLocaleString()}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-text-secondary">
                      Email
                    </dt>
                    <dd>{emailState.label.replace("Email: ", "")}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-text-secondary">Text</dt>
                    <dd>{textState.label.replace("Text: ", "")}</dd>
                  </div>
                </dl>
                <div className="mt-3 flex flex-wrap gap-2">
                  {draft.isPinned ? (
                    <span className="rounded-full border border-accent/25 bg-accent/10 px-2 py-1 text-xs text-teal-50">
                      Pinned
                    </span>
                  ) : null}
                  <span className={recentChannelBadgeClass(emailState.tone)}>
                    {emailState.label}
                  </span>
                  <span className={recentChannelBadgeClass(textState.tone)}>
                    {textState.label}
                  </span>
                  {draft.approvedAt ? (
                    <span className="rounded-full border border-yellow-400/20 bg-yellow-400/10 px-2 py-1 text-xs text-yellow-50">
                      Approved
                    </span>
                  ) : null}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <SecondaryButton
                    disabled={isBusy}
                    onClick={() => loadDraft(draft.id)}
                  >
                    {busyAction === "load" && campaign?.id === draft.id
                      ? "Opening..."
                      : "Open"}
                  </SecondaryButton>
                  {canDeleteDraft(draft) ? (
                    <SecondaryButton
                      disabled={isBusy}
                      onClick={() => deleteDraft(draft)}
                    >
                      {busyAction === "delete" && campaign?.id === draft.id
                        ? "Deleting..."
                        : "Delete draft"}
                    </SecondaryButton>
                  ) : null}
                </div>
              </article>
            );
          })
        ) : (
          <article className="flex min-h-[136px] items-center justify-center rounded-[8px] border border-white/10 bg-[#080D12] p-6 text-center text-sm font-semibold text-text-secondary">
            No announcements recently created.
          </article>
        )}
      </div>
    </section>
  );

  return (
    <>
      {focusGuideVisible ? (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-[60] bg-black/30 backdrop-brightness-75 transition-opacity motion-reduce:transition-none"
        />
      ) : null}
      {focusGuideVisible && focusGuideDirection && nextWorkflowAction ? (
        <FocusGuideDirectionCue
          direction={focusGuideDirection}
          onClick={() =>
            scrollToElement(nextWorkflowAction.ref, { block: "center" })
          }
        >
          {focusGuideDirection === "above"
            ? "Next step is above"
            : "Next step is below"}
          {": "}
          {workflowCueText(nextWorkflowAction)}
        </FocusGuideDirectionCue>
      ) : null}
      {liveSubscriberSnapshotSection}
      <section
        ref={topRef}
        tabIndex={-1}
        className="mb-5 rounded-[8px] border border-white/10 bg-[#0D1117] p-5 shadow-2xl shadow-black/20 focus:outline-none"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
              Workflow
            </p>
            <h2 className="mt-2 font-headline text-xl font-bold text-text-primary">
              Draft, preview, test, approve, then send
            </h2>
          </div>
        </div>
        <ol className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {workflowSteps.map((step, index) => (
            <li
              key={step.label}
              className={`min-h-[118px] rounded-[8px] border p-3 text-sm transition duration-200 motion-reduce:transition-none ${stepTone[step.state]}`}
            >
              <div className="flex items-center gap-2">
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-current/30 text-xs font-bold">
                  {step.state === "completed" ? "✓" : index + 1}
                </span>
                <span className="font-semibold leading-5">{step.label}</span>
              </div>
              <p className="mt-2 text-xs leading-5 opacity-85">{step.detail}</p>
              <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.12em] opacity-70">
                {step.state === "active" ? "current" : step.state}
              </p>
            </li>
          ))}
        </ol>
        <div className="mt-7 flex justify-center">
          <button
            ref={newAnnouncementButtonRef}
            type="button"
            onClick={startAnotherAnnouncement}
            disabled={isBusy}
            className={`${primaryButtonClass("teal")} min-h-16 w-full max-w-xl px-10 text-lg shadow-[0_0_34px_rgba(36,196,182,0.26)] hover:shadow-[0_0_46px_rgba(36,196,182,0.36)]`}
          >
            New announcement
          </button>
        </div>
      </section>

      <div className="mb-5">{recentAnnouncementsSection}</div>

      {workflowStarted ? (
      <>
      <section className="grid gap-5 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
      <div
        ref={emailWorkspaceRef}
        className="rounded-[8px] border border-white/10 bg-[#0D1117] p-5 shadow-2xl shadow-black/20"
      >
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
              Email workspace
            </p>
            <h2 className="mt-2 font-headline text-2xl text-text-primary">
              Email draft
            </h2>
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              Save a draft, preview it, send one admin test, then approve and
              review email and text recipients before sending.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-semibold capitalize text-accent">
              {status}
            </span>
          </div>
        </div>

        <div className="space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-text-primary">
              Message type
            </span>
            <select
              value={form.messageType}
              onChange={(event) =>
                updateField(
                  "messageType",
                  event.target.value as FormValues["messageType"],
                )
              }
              disabled={isSendStarted}
              className="mt-2 w-full rounded-[8px] border border-white/10 bg-[#080D12] px-4 py-3 text-sm text-text-primary outline-none transition focus:border-accent disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="beta_update">Beta announcement</option>
              <option value="testflight_update">TestFlight update</option>
              <option value="product_update">Product update</option>
              <option value="feedback_request">Feedback request</option>
              <option value="important_notice">Important notice</option>
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-text-primary">
              Subject
            </span>
            <input
              ref={firstEmailFieldRef}
              value={form.subject}
              onChange={(event) => updateField("subject", event.target.value)}
              maxLength={120}
              disabled={isSendStarted}
              className={`mt-2 w-full rounded-[8px] border border-white/10 bg-[#080D12] px-4 py-3 text-sm text-text-primary outline-none transition focus:border-accent disabled:cursor-not-allowed disabled:opacity-60 ${guidedControlClass("emailSubject")}`}
            />
            {fieldErrors.subject ? (
              <span className="mt-2 block text-xs text-red-100">
                {fieldErrors.subject}
              </span>
            ) : null}
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-text-primary">
              Heading
            </span>
            <input
              ref={emailHeadingFieldRef}
              value={form.heading}
              onChange={(event) => updateField("heading", event.target.value)}
              maxLength={160}
              disabled={isSendStarted}
              className={`mt-2 w-full rounded-[8px] border border-white/10 bg-[#080D12] px-4 py-3 text-sm text-text-primary outline-none transition focus:border-accent disabled:cursor-not-allowed disabled:opacity-60 ${guidedControlClass("emailHeading")}`}
            />
            {fieldErrors.heading ? (
              <span className="mt-2 block text-xs text-red-100">
                {fieldErrors.heading}
              </span>
            ) : null}
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-text-primary">Body</span>
            <textarea
              ref={emailBodyRef}
              value={form.body}
              onChange={(event) => updateField("body", event.target.value)}
              rows={10}
              maxLength={5000}
              disabled={isSendStarted}
              className={`mt-2 w-full resize-y rounded-[8px] border border-white/10 bg-[#080D12] px-4 py-3 text-sm leading-6 text-text-primary outline-none transition focus:border-accent disabled:cursor-not-allowed disabled:opacity-60 ${guidedControlClass("emailBody")}`}
            />
            {fieldErrors.body ? (
              <span className="mt-2 block text-xs text-red-100">
                {fieldErrors.body}
              </span>
            ) : null}
          </label>

          <div className="grid gap-4 sm:grid-cols-[0.8fr_1.2fr]">
            <label className="block">
              <span className="text-sm font-semibold text-text-primary">
                Link text
              </span>
              <input
                ref={emailCtaLabelRef}
                value={form.ctaLabel}
                onChange={(event) => updateField("ctaLabel", event.target.value)}
                maxLength={64}
                disabled={isSendStarted}
                className={`mt-2 w-full rounded-[8px] border border-white/10 bg-[#080D12] px-4 py-3 text-sm text-text-primary outline-none transition focus:border-accent disabled:cursor-not-allowed disabled:opacity-60 ${guidedControlClass("emailCtaLabel")}`}
              />
              <span className="mt-2 block text-xs leading-5 text-text-muted">
                Optional. Leave link text and URL blank for an email with no
                button.
              </span>
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-text-primary">
                Link URL
              </span>
              <input
                ref={emailCtaUrlRef}
                value={form.ctaUrl}
                onChange={(event) => updateField("ctaUrl", event.target.value)}
                maxLength={300}
                disabled={isSendStarted}
                className={`mt-2 w-full rounded-[8px] border border-white/10 bg-[#080D12] px-4 py-3 text-sm text-text-primary outline-none transition focus:border-accent disabled:cursor-not-allowed disabled:opacity-60 ${guidedControlClass("emailCtaUrl")}`}
              />
              <span className="mt-2 block text-xs leading-5 text-text-muted">
                Optional. URLs are validated only when supplied.
              </span>
            </label>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 rounded-[8px] border border-accent/20 bg-accent/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-text-primary">
              Save the email before previewing or testing it.
            </p>
            <p className="mt-1 text-xs leading-5 text-text-secondary">
              Text work is preserved when the email is saved.
            </p>
          </div>
          <button
            ref={emailSaveRef}
            type="button"
            onClick={() => saveEmailDraft()}
            disabled={
              isBusy ||
              isSendStarted ||
              !canSaveEmailContent ||
              !canModifyDraft(campaign)
            }
            className={`${primaryButtonClass("teal")} min-h-14 min-w-44 px-8 text-base shadow-[0_0_28px_rgba(36,196,182,0.22)] ${
              saveHighlight === "email"
                ? "ring-2 ring-accent ring-offset-2 ring-offset-[#0D1117]"
                : ""
            } ${guidedControlClass("emailSave")}`}
          >
            {busyAction === "saveEmail" ? "Saving..." : "Save email"}
          </button>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            ref={emailPreviewButtonRef}
            onClick={generatePreview}
            disabled={!emailSaved || isBusy}
            className={`${primaryButtonClass("blue")} ${guidedControlClass("emailPreview")}`}
          >
            {busyAction === "preview" ? "Generating..." : "Generate preview"}
          </button>
          <button
            type="button"
            ref={emailTestButtonRef}
            onClick={() => {
              setEmailTestModalConfirmed(false);
              setEmailTestModalOpen(true);
            }}
            disabled={!canRequestEmailTest || isBusy}
            className={`${primaryButtonClass("amber")} ${guidedControlClass("emailTest")}`}
          >
            {busyAction === "test" ? "Sending test..." : "Send test to myself"}
          </button>
        </div>

        {!testSendEnabled ? (
          <div className="mt-5 rounded-[8px] border border-yellow-400/20 bg-yellow-400/10 p-4 text-sm leading-6 text-yellow-100">
            Test email sending is disabled.
          </div>
        ) : !emailSaved ? (
          <div className="mt-5 rounded-[8px] border border-white/10 bg-[#080D12] p-4 text-sm leading-6 text-text-secondary">
            Save the email before sending an admin test.
          </div>
        ) : (
          null
        )}

        {testSendMessageId ? (
          <div className="mt-3 rounded-[8px] border border-accent/25 bg-accent/10 p-4 text-sm leading-6 text-teal-50">
            Test accepted by SES for {adminEmail}. Message ID recorded.
          </div>
        ) : null}

        {message ? (
          <div
            className={`mt-5 rounded-[8px] border p-4 text-sm leading-6 ${messageToneClass}`}
          >
            {message.text}
          </div>
        ) : null}
      </div>

      <div className="space-y-5">
        <div
          ref={previewRef}
          className="rounded-[8px] border border-white/10 bg-[#05090D] p-5 shadow-2xl shadow-black/20"
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
                Email preview
              </p>
              <h2 className="mt-1 text-sm font-semibold text-text-primary">
                {preview?.subject ||
                  emailPreviewSnapshot.subject ||
                  "Untitled beta update"}
              </h2>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-text-secondary">
              {preview
                ? emailPreviewOutdated
                  ? "Outdated"
                  : "Current"
                : "Draft preview"}
            </span>
            <div className="flex rounded-full border border-white/10 bg-[#080D12] p-1">
              <button
                type="button"
                onClick={() => setPreviewMode("html")}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  previewMode === "html"
                    ? "bg-accent text-[#03100E]"
                    : "text-text-secondary"
                }`}
              >
                HTML
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode("text")}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  previewMode === "text"
                    ? "bg-accent text-[#03100E]"
                    : "text-text-secondary"
                }`}
              >
                Text
              </button>
            </div>
            </div>
          </div>

          {emailPreviewOutdated ? (
            <div className="mb-4 rounded-[8px] border border-yellow-400/20 bg-yellow-400/10 p-3 text-xs font-semibold text-yellow-50">
              Draft changed. Generate a new preview.
            </div>
          ) : null}

          {preview ? (
            previewMode === "html" ? (
              <iframe
                title="Email HTML preview"
                sandbox=""
                srcDoc={preview.html}
                className="h-[620px] w-full rounded-[8px] border border-white/10 bg-[#0A0F14]"
              />
            ) : (
              <pre className="max-h-[620px] overflow-auto whitespace-pre-wrap rounded-[8px] border border-white/10 bg-[#0D1117] p-5 text-sm leading-6 text-text-secondary">
                {preview.text}
              </pre>
            )
          ) : (
            <>
              <div className="mb-4 rounded-[8px] border border-accent/20 bg-accent/5 p-3 text-xs font-semibold text-teal-50">
                Draft preview. Generate preview before testing or approving.
              </div>
              {previewMode === "html" ? (
                <iframe
                  title="Email draft preview"
                  sandbox=""
                  srcDoc={defaultEmailPreviewHtml}
                  className="h-[620px] w-full rounded-[8px] border border-white/10 bg-[#0A0F14]"
                />
              ) : (
                <pre className="max-h-[620px] overflow-auto whitespace-pre-wrap rounded-[8px] border border-white/10 bg-[#0D1117] p-5 text-sm leading-6 text-text-secondary">
                  {[
                    emailPreviewSnapshot.heading,
                    "",
                    emailPreviewSnapshot.body.trim(),
                    "",
                    emailPreviewSnapshot.ctaLabel && emailPreviewSnapshot.ctaUrl
                      ? `${emailPreviewSnapshot.ctaLabel}: ${emailPreviewSnapshot.ctaUrl}`
                      : "",
                    "",
                    "You are receiving this because you joined the SuppVis beta.",
                    "Unsubscribe link will be inserted per recipient before a production send.",
                  ]
                    .filter((part) => part !== "")
                    .join("\n")}
                </pre>
              )}
            </>
          )}
        </div>
      </div>
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <div
          ref={textWorkspaceRef}
          className={`relative overflow-hidden rounded-[8px] border border-white/10 bg-[#0D1117] p-5 shadow-2xl shadow-black/20 transition duration-300 ${
            textWorkspaceUnlocked ? "" : "opacity-75"
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
                Text workspace
              </p>
              <h2
                ref={textHeadingRef}
                tabIndex={-1}
                className="mt-2 font-headline text-2xl text-text-primary focus:outline-none"
              >
                Text draft
              </h2>
              <p className="mt-2 text-sm leading-6 text-text-secondary">
                Add the required customer-care beta text that sends with this
                announcement.
              </p>
            </div>
            <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-text-secondary">
              {!textWorkspaceUnlocked
                ? "Locked"
                : smsSaved
                  ? "Saved"
                  : "Unsaved"}
            </span>
          </div>

          {!textWorkspaceUnlocked ? (
            <div className="mt-5 rounded-[8px] border border-white/10 bg-[#080D12] p-4 text-sm leading-6 text-text-secondary transition">
              Click New announcement before adding a text message.
            </div>
          ) : null}

          {textWorkspaceUnlocked ? (
            <div className="mt-5 rounded-[8px] border border-accent/20 bg-accent/10 p-4 text-sm leading-6 text-teal-50">
              Every announcement requires both an email and a text message.
              Text recipients are counted from eligible SMS consent records
              only.
            </div>
          ) : null}

          <div
            aria-disabled={!canUseSmsControls}
            className={`mt-5 space-y-4 transition duration-300 ${
              canUseSmsControls
                ? "opacity-100"
                : "pointer-events-none opacity-45"
            }`}
          >
            <label className="block">
              <span className="text-sm font-semibold text-text-primary">
                Text message
              </span>
              <textarea
                ref={textBodyRef}
                value={form.smsBody}
                onChange={(event) => updateField("smsBody", event.target.value)}
                rows={6}
                maxLength={260}
              disabled={!canUseSmsControls}
              className={`mt-2 w-full resize-y rounded-[8px] border border-white/10 bg-[#080D12] px-4 py-3 text-sm leading-6 text-text-primary outline-none transition focus:border-accent disabled:cursor-not-allowed disabled:opacity-60 ${guidedControlClass("smsBody")}`}
            />
              {fieldErrors.smsBody ? (
                <span className="mt-2 block text-xs text-red-100">
                  {fieldErrors.smsBody}
                </span>
              ) : null}
              <span className="mt-2 block text-xs leading-5 text-text-muted">
                Type only the update itself. The SuppVis prefix and rates notice
                are added automatically.
              </span>
            </label>

            <div className="flex flex-col gap-3 rounded-[8px] border border-accent/20 bg-accent/5 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-text-primary">
                  Save the text before previewing or testing it.
                </p>
                <p className="mt-1 text-xs leading-5 text-text-secondary">
                  This updates the same announcement record as the email draft.
                </p>
              </div>
              <button
                ref={textSaveRef}
                type="button"
                onClick={() => saveTextDraft()}
                disabled={!canSaveTextContent || isBusy || !canModifyDraft(campaign)}
                className={`${primaryButtonClass("teal")} min-h-14 min-w-44 px-8 text-base shadow-[0_0_28px_rgba(36,196,182,0.22)] ${
                  saveHighlight === "text"
                    ? "ring-2 ring-accent ring-offset-2 ring-offset-[#0D1117]"
                    : ""
                } ${guidedControlClass("smsSave")}`}
              >
                {busyAction === "saveSms" ? "Saving..." : "Save text"}
              </button>
            </div>

            {smsChangedSinceSave || emailChangedSinceSave ? (
              <div className="rounded-[8px] border border-yellow-400/20 bg-yellow-400/10 p-3 text-xs leading-5 text-yellow-50">
                Save the latest changes before approval or subscriber sending.
              </div>
            ) : null}

            <div className="rounded-[8px] border border-white/10 bg-[#080D12] p-3 text-xs leading-5 text-text-muted">
              {displaySmsPreview ? (
                <span>
                  {displaySmsPreview.characterCount} characters -{" "}
                  {displaySmsPreview.segmentCount}{" "}
                  {displaySmsPreview.segmentCount === 1 ? "segment" : "segments"}{" "}
                  - {displaySmsPreview.encoding}
                  {!activeSmsPreview ? " - Draft preview" : ""}
                  {smsPreviewOutdated ? " - Draft changed. Generate a new preview." : ""}
                </span>
              ) : (
                <span>Generate a preview to check characters and segments.</span>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                ref={textPreviewButtonRef}
                onClick={generateSmsPreview}
                disabled={!smsSaved || !canUseSmsControls || isBusy}
                className={`${primaryButtonClass("blue")} ${guidedControlClass("smsPreview")}`}
              >
                {busyAction === "smsPreview"
                  ? "Generating..."
                  : "Generate preview"}
              </button>
              <button
                type="button"
                ref={textTestButtonRef}
                onClick={() => {
                  setSmsTestModalConfirmed(false);
                  setSmsTestModalState(null);
                  setSmsTestModalOpen(true);
                }}
                disabled={!canRequestSmsTest || isBusy}
                className={`${primaryButtonClass("amber")} ${guidedControlClass("smsTest")}`}
              >
                {busyAction === "smsTest"
                  ? "Sending test..."
                  : "Send test to myself"}
              </button>
            </div>

            {smsTestDisabledCopy ? (
              <div className="rounded-[8px] border border-yellow-400/20 bg-yellow-400/10 p-4 text-sm leading-6 text-yellow-50">
                {smsTestDisabledCopy}
              </div>
            ) : null}

            {smsTestRecipient || campaign?.smsTestRecipientMasked ? (
              <div className="rounded-[8px] border border-accent/25 bg-accent/10 p-4 text-sm leading-6 text-teal-50">
                Test text accepted by Twilio for{" "}
                {smsTestRecipient || campaign?.smsTestRecipientMasked}.
                {smsTestMessageSid || campaign?.smsTestMessageSid
                  ? " Message SID recorded."
                  : ""}
                {currentSmsProviderStatus
                  ? ` Current provider status: ${currentSmsProviderStatus}.`
                  : ""}
                {currentSmsSender ? ` Sender: ${currentSmsSender}.` : ""}
              </div>
            ) : null}
          </div>
        </div>

        <div
          ref={smsPreviewRef}
          className="rounded-[8px] border border-white/10 bg-[#05090D] p-5 shadow-2xl shadow-black/20"
        >
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
                Text preview
              </p>
              <h2 className="mt-1 text-sm font-semibold text-text-primary">
                SuppVis beta text
              </h2>
            </div>
            <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-text-secondary">
              {activeSmsPreview
                ? smsPreviewOutdated
                  ? "Outdated"
                  : "Previewed"
                : "Draft preview"}
            </span>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-[#0D1117] p-5">
            <div className="mx-auto max-w-[380px] rounded-[24px] border border-white/10 bg-[#05090D] p-4">
              <div className="mb-4 flex items-center justify-between gap-3 border-b border-white/10 pb-3">
                <div>
                  <p className="text-sm font-bold text-text-primary">
                    SuppVis
                  </p>
                  <p className="text-xs text-text-muted">Beta text preview</p>
                </div>
                <span className="h-3 w-3 rounded-full bg-accent shadow-[0_0_18px_rgba(36,196,182,0.55)]" />
              </div>
              {displaySmsPreview ? (
                <div className="rounded-[18px] bg-accent/15 p-4 text-sm leading-6 text-teal-50">
                  {!activeSmsPreview ? (
                    <p className="mb-3 rounded-[8px] border border-accent/20 bg-accent/10 p-2 text-xs font-semibold text-teal-50">
                      Draft preview. Generate preview before testing or
                      approving.
                    </p>
                  ) : null}
                  {smsPreviewOutdated ? (
                    <p className="mb-3 rounded-[8px] border border-yellow-400/20 bg-yellow-400/10 p-2 text-xs font-semibold text-yellow-50">
                      Draft changed. Generate a new preview.
                    </p>
                  ) : null}
                  <p className="whitespace-pre-wrap">{displaySmsPreview.body}</p>
                </div>
              ) : (
                <div className="rounded-[18px] border border-white/10 bg-white/[0.03] p-4 text-sm leading-6 text-text-secondary">
                  Generate the text preview to see the final message, required
                  SuppVis prefix, compliance footer, character count, and
                  segment count.
                </div>
              )}
            </div>
          </div>

          <p className="mt-4 text-xs leading-5 text-text-muted">
            Text delivery uses a separate queue after approval. No SMS
            recipients are touched while the announcement remains unsent.
          </p>
        </div>
      </section>

      {selectedChannelsSaved ? (
      <section className="mt-5">
        {subscriberDeliverySection}
      </section>
      ) : null}

      <div className="mt-10 flex justify-center pb-8">
        <button
          type="button"
          onClick={scrollToTop}
          className="inline-flex min-h-14 w-full max-w-md items-center justify-center gap-2 rounded-full border border-accent/40 bg-accent px-6 py-4 text-base font-bold text-[#03100E] shadow-[0_0_34px_rgba(36,196,182,0.24)] transition duration-150 ease-out hover:-translate-y-0.5 hover:bg-accent-hover hover:shadow-[0_0_44px_rgba(36,196,182,0.34)] active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary motion-reduce:transition-none"
        >
          <UpArrowIcon />
          Back to top
        </button>
      </div>
      </>
      ) : null}

      {newAnnouncementConfirmOpen ? (
        <Modal
          title="Start a new announcement?"
          onClose={() => {
            if (!isBusy) {
              setNewAnnouncementConfirmOpen(false);
            }
          }}
        >
          <p className="text-sm leading-6 text-text-secondary">
            You have unsaved changes. Starting a new announcement clears the
            local form, but it will not delete anything already saved.
          </p>
          <div className="mt-5 flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={() => setNewAnnouncementConfirmOpen(false)}
              disabled={isBusy}
              className={primaryButtonClass("dark")}
            >
              Keep editing
            </button>
            <button
              type="button"
              onClick={() => {
                setNewAnnouncementConfirmOpen(false);
                beginNewAnnouncement();
              }}
              disabled={isBusy}
              className={primaryButtonClass("teal")}
            >
              New announcement
            </button>
          </div>
        </Modal>
      ) : null}

      {emailTestModalOpen ? (
        <Modal
          title="Send test email?"
          onClose={() => {
            if (!isBusy) {
              setEmailTestModalOpen(false);
              setEmailTestModalConfirmed(false);
            }
          }}
        >
          <p className="text-sm leading-6 text-text-secondary">
            This sends exactly one branded test email to your signed-in admin
            address.
          </p>
          <p className="mt-3 rounded-[8px] border border-white/10 bg-[#080D12] p-3 text-sm font-semibold text-text-primary">
            {adminEmail}
          </p>
          <label className="mt-4 flex gap-3 rounded-[8px] border border-yellow-400/20 bg-yellow-400/10 p-4 text-sm leading-6 text-yellow-50">
            <input
              type="checkbox"
              checked={emailTestModalConfirmed}
              onChange={(event) =>
                setEmailTestModalConfirmed(event.target.checked)
              }
              disabled={isBusy}
              className="mt-1 h-4 w-4 shrink-0 accent-accent disabled:cursor-not-allowed"
            />
            <span>
              I understand this sends one test email only to my signed-in admin
              address. It will not send to beta subscribers.
            </span>
          </label>
          <div className="mt-5 flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setEmailTestModalOpen(false);
                setEmailTestModalConfirmed(false);
              }}
              disabled={isBusy}
              className={primaryButtonClass("dark")}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={requestTestSend}
              disabled={!emailTestModalConfirmed || isBusy}
              className={primaryButtonClass("amber")}
            >
              {busyAction === "test" ? "Sending test..." : "Send test"}
            </button>
          </div>
        </Modal>
      ) : null}

      {smsTestModalOpen ? (
        <Modal
          maxWidth="max-w-2xl"
          title="Send test text?"
          onClose={() => {
            if (!isBusy) {
              closeSmsTestModal();
            }
          }}
        >
          <p className="text-sm leading-6 text-text-secondary">
            This sends exactly one test text to the configured admin test
            number for your signed-in account.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1.65fr)_minmax(180px,0.95fr)]">
            <div className="min-w-0 rounded-[8px] border border-white/10 bg-[#080D12] p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
                Admin
              </p>
              <p
                className="mt-1 truncate whitespace-nowrap text-sm font-semibold text-text-primary"
                title={adminEmail}
              >
                {adminEmail}
              </p>
            </div>
            <div className="min-w-0 rounded-[8px] border border-white/10 bg-[#080D12] p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
                Test number
              </p>
              <p className="mt-1 truncate whitespace-nowrap text-sm font-semibold text-text-primary">
                {currentSmsTestMaskedPhone ||
                  "No admin test number is configured for this account."}
              </p>
            </div>
          </div>
          <div className="mt-4 rounded-[8px] border border-white/10 bg-[#080D12] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
              Text preview
            </p>
            {smsTestModalPreview ? (
              <>
                <pre className="mt-3 whitespace-pre-wrap rounded-[8px] border border-white/10 bg-[#05090D] p-4 text-sm leading-6 text-text-secondary">
                  {smsTestModalPreview.body}
                </pre>
                <p className="mt-3 text-xs text-text-muted">
                  {smsTestModalPreview.characterCount} characters -{" "}
                  {smsTestModalPreview.segmentCount}{" "}
                  {smsTestModalPreview.segmentCount === 1
                    ? "segment"
                    : "segments"}{" "}
                  - {smsTestModalPreview.encoding}
                </p>
              </>
            ) : (
              <p className="mt-3 text-sm leading-6 text-text-secondary">
                Save the text message before sending a test.
              </p>
            )}
          </div>
          <label className="mt-4 flex gap-3 rounded-[8px] border border-yellow-400/20 bg-yellow-400/10 p-4 text-sm leading-6 text-yellow-50">
            <input
              type="checkbox"
              checked={smsTestModalConfirmed}
              onChange={(event) =>
                setSmsTestModalConfirmed(event.target.checked)
              }
              disabled={isBusy}
              className="mt-1 h-4 w-4 shrink-0 accent-accent disabled:cursor-not-allowed"
            />
            <span>
              I understand this sends one test text only to my configured admin
              test number.
            </span>
          </label>
          {smsTestModalState ? (
            <div
              className={`mt-4 rounded-[8px] border p-3 text-sm leading-6 ${
                smsTestModalState.tone === "success"
                  ? "border-accent/25 bg-accent/10 text-teal-50"
                  : smsTestModalState.tone === "error"
                    ? "border-red-400/25 bg-red-400/10 text-red-100"
                    : "border-white/10 bg-[#080D12] text-text-secondary"
              }`}
            >
              <p>{smsTestModalState.message}</p>
              {smsTestModalState.providerStatus ? (
                <p className="mt-1 text-xs opacity-80">
                  Provider status:{" "}
                  {adminStatusLabel(smsTestModalState.providerStatus)}
                </p>
              ) : null}
            </div>
          ) : null}
          <div className="mt-5 flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={closeSmsTestModal}
              disabled={isBusy}
              className={primaryButtonClass("dark")}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={requestSmsTestSend}
              disabled={!smsTestModalConfirmed || !canRequestSmsTest || isBusy}
              className={primaryButtonClass("amber")}
            >
              {busyAction === "smsTest" ? "Sending test..." : "Send test"}
            </button>
          </div>
        </Modal>
      ) : null}

      {selectedSubscriber ? (
        <Modal
          bodyClassName="subscriber-detail-scroll"
          panelClassName="subscriber-detail-modal"
          maxWidth="max-w-4xl"
          title={selectedSubscriber.fullName}
          onClose={() => {
            if (!isBusy) {
              setSelectedSubscriber(null);
              setSubscriberActionMessage(null);
              setSubscriberPriorityReplacementId("");
            }
          }}
        >
          <div className="grid gap-3 text-sm md:grid-cols-2">
            {[
              ["Signup order", selectedSubscriber.signupOrderNumber ? `#${selectedSubscriber.signupOrderNumber}` : "-"],
              ["Signup date", formatOptionalDate(selectedSubscriber.createdAt)],
              ["Email", selectedSubscriber.email],
              ["Phone", phoneDisplay(selectedSubscriber)],
              ["Email status", adminStatusLabel(selectedSubscriber.emailStatus)],
              ["Text status", adminStatusLabel(selectedSubscriber.smsStatus)],
              ["Priority", selectedSubscriber.priorityBadge],
              ["Source", selectedSubscriber.sourcePage],
            ].map(([label, value]) => (
              <div
                key={label}
                className="min-w-0 rounded-[8px] border border-white/10 bg-[#080D12] p-3"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
                  {label}
                </p>
                <p
                  className="mt-1 truncate font-semibold text-text-primary"
                  title={String(value)}
                >
                  {value}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-[8px] border border-white/10 bg-[#080D12] p-4">
              <h3 className="font-semibold text-text-primary">
                Consent and delivery
              </h3>
              <dl className="mt-3 space-y-2 text-sm text-text-secondary">
                <div>
                  <dt className="text-xs uppercase tracking-[0.12em] text-text-muted">
                    Text consent
                  </dt>
                  <dd>
                    Informational:{" "}
                    {selectedSubscriber.smsConsent.informational ? "Yes" : "No"}
                    . Marketing:{" "}
                    {selectedSubscriber.smsConsent.marketing ? "Yes" : "No"}.
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.12em] text-text-muted">
                    Welcome email
                  </dt>
                  <dd>
                    {formatOptionalDate(
                      selectedSubscriber.emailDelivery.welcomeEmailSentAt,
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.12em] text-text-muted">
                    Welcome text
                  </dt>
                  <dd>
                    {formatOptionalDate(
                      selectedSubscriber.smsDelivery.welcomeSmsSentAt,
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.12em] text-text-muted">
                    Last text provider status
                  </dt>
                  <dd>
                    {adminStatusLabel(
                      selectedSubscriber.smsDelivery.providerStatus ||
                        selectedSubscriber.smsDelivery.lastSmsStatus,
                    )}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="rounded-[8px] border border-white/10 bg-[#080D12] p-4">
              <h3 className="font-semibold text-text-primary">
                Priority controls
              </h3>
              <p className="mt-2 text-sm leading-6 text-text-secondary">
                Current priority group: {subscriberPriorityCount} /{" "}
                {subscriberPriorityLimit}.
              </p>
              <label className="mt-3 block">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
                  Replacement
                </span>
                <select
                  value={subscriberPriorityReplacementId}
                  onChange={(event) =>
                    setSubscriberPriorityReplacementId(event.target.value)
                  }
                  disabled={isBusy}
                  className="mt-2 w-full rounded-[8px] border border-white/10 bg-[#0D1117] px-3 py-2 text-sm text-text-primary outline-none transition focus:border-accent disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="">
                    {selectedSubscriber.priorityBeta
                      ? "No replacement - leave slot open"
                      : "No replacement selected"}
                  </option>
                  {(selectedSubscriber.priorityBeta
                    ? standardOptions
                    : priorityOptions
                  )
                    .filter((option) => option.id !== selectedSubscriber.id)
                    .map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.fullName}{" "}
                        {option.signupOrderNumber
                          ? `#${option.signupOrderNumber}`
                          : ""}
                      </option>
                    ))}
                </select>
              </label>
              <p className="mt-2 text-xs leading-5 text-text-muted">
                Removing a priority user can optionally promote a standard
                subscriber into the freed slot. Promoting a standard user while
                the group is full requires choosing a priority user to replace.
              </p>
              <button
                type="button"
                onClick={() =>
                  updateSubscriberPriority(!selectedSubscriber.priorityBeta)
                }
                disabled={isBusy}
                className={`mt-4 ${
                  selectedSubscriber.priorityBeta
                    ? primaryButtonClass("dark")
                    : primaryButtonClass("teal")
                }`}
              >
                {busyAction === "subscriberPriority"
                  ? "Updating..."
                  : selectedSubscriber.priorityBeta
                    ? "Remove from priority"
                    : "Make priority"}
              </button>
            </div>
          </div>

          <div className="mt-4 rounded-[8px] border border-white/10 bg-[#080D12] p-4">
            <label className="block">
              <span className="font-semibold text-text-primary">
                Internal admin notes
              </span>
              <textarea
                value={subscriberNotesDraft}
                onChange={(event) =>
                  setSubscriberNotesDraft(event.target.value)
                }
                rows={5}
                maxLength={4000}
                disabled={isBusy}
                className="mt-2 w-full resize-y rounded-[8px] border border-white/10 bg-[#0D1117] px-4 py-3 text-sm leading-6 text-text-primary outline-none transition focus:border-accent disabled:cursor-not-allowed disabled:opacity-60"
              />
            </label>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-text-muted">
                Notes are internal only and never shown to subscribers.
              </p>
              <button
                type="button"
                onClick={saveSubscriberNotes}
                disabled={isBusy}
                className={primaryButtonClass("teal")}
              >
                {busyAction === "subscriberNotes" ? "Saving..." : "Save notes"}
              </button>
            </div>
          </div>

          {subscriberActionMessage ? (
            <div
              className={`mt-4 rounded-[8px] border p-3 text-sm leading-6 ${
                subscriberActionMessage.tone === "success"
                  ? "border-accent/25 bg-accent/10 text-teal-50"
                  : subscriberActionMessage.tone === "error"
                    ? "border-red-400/25 bg-red-400/10 text-red-100"
                    : "border-white/10 bg-[#080D12] text-text-secondary"
              }`}
            >
              {subscriberActionMessage.text}
            </div>
          ) : null}
        </Modal>
      ) : null}

      {idleWarningOpen ? (
        <Modal
          closeOnBackdrop={false}
          closeOnEscape={false}
          lockScroll={false}
          showCloseButton={false}
          title="Your session is about to expire"
          onClose={() => undefined}
        >
          <p className="text-sm leading-6 text-text-secondary">
            You will be signed out due to inactivity. Unsaved changes may be
            lost.
          </p>
          <div className="mt-4 rounded-[8px] border border-yellow-400/20 bg-yellow-400/10 p-5 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-yellow-100">
              Time remaining
            </p>
            <p className="mt-2 font-headline text-5xl font-bold text-text-primary">
              {idleCountdown}
            </p>
          </div>
          <p className="mt-4 text-sm leading-6 text-text-secondary">
            Move your mouse, type, or scroll to continue your session.
          </p>
        </Modal>
      ) : null}

      {deleteTarget ? (
        <Modal
          title="Delete this draft?"
          onClose={() => {
            if (!isBusy) {
              setDeleteTarget(null);
            }
          }}
        >
          <p className="text-sm leading-6 text-text-secondary">
            This removes it from Recent announcements. Sent or approved
            announcement history cannot be deleted.
          </p>
          <p className="mt-3 rounded-[8px] border border-white/10 bg-[#080D12] p-3 text-sm font-semibold text-text-primary">
            {deleteTarget.subject}
          </p>
          <div className="mt-5 flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              disabled={isBusy}
              className={primaryButtonClass("dark")}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmDeleteDraft}
              disabled={isBusy}
              className={primaryButtonClass("red")}
            >
              {busyAction === "delete" ? "Deleting..." : "Delete draft"}
            </button>
          </div>
        </Modal>
      ) : null}

      {sentHistoryOpen ? (
        <Modal
          maxWidth="max-w-4xl"
          title="Sent announcements"
          onClose={() => {
            if (!isBusy) {
              setSentHistoryOpen(false);
            }
          }}
        >
          <div className="max-h-[70vh] overflow-auto pr-1">
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="text-sm leading-6 text-text-secondary">
                Queued, sending, completed, and failed production history stays
                immutable here.
              </p>
              <SecondaryButton
                disabled={isBusy}
                onClick={() =>
                  refreshSentAnnouncements().catch(() =>
                    setMessage({
                      tone: "error",
                      text: "Could not refresh sent announcements.",
                    }),
                  )
                }
              >
                {busyAction === "sentHistory" ? "Loading..." : "Refresh"}
              </SecondaryButton>
            </div>
            {sentAnnouncements.length ? (
              <div className="space-y-3">
                {sentAnnouncements.map((item) => (
                  <article
                    key={item.id}
                    className="rounded-[8px] border border-white/10 bg-[#080D12] p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-words font-semibold text-text-primary">
                          {item.subject}
                        </p>
                        <p className="mt-1 text-sm text-text-secondary">
                          {messageTypeLabel(item.messageType)}
                        </p>
                      </div>
                      <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-text-secondary">
                        {statusLabel(item.status)}
                      </span>
                    </div>
                    <dl className="mt-3 grid gap-2 text-xs text-text-muted sm:grid-cols-3">
                      <div>
                        <dt className="font-semibold text-text-secondary">
                          Queued
                        </dt>
                        <dd>
                          {item.queuedAt
                            ? new Date(item.queuedAt).toLocaleString()
                            : "Not recorded"}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-text-secondary">
                          Email
                        </dt>
                        <dd>
                          {item.eligibleCount || 0} eligible -{" "}
                          {item.queuedCount || 0} queued -{" "}
                          {item.sentCount || 0} accepted -{" "}
                          {item.deliveredCount || 0} delivered -{" "}
                          {item.failedCount || 0} failed
                        </dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-text-secondary">
                          Text
                        </dt>
                        <dd>
                          {item.smsEligibleCount || 0} eligible -{" "}
                          {item.smsQueuedCount || 0} queued -{" "}
                          {item.smsSentCount || 0} accepted -{" "}
                          {item.smsDeliveredCount || 0} delivered -{" "}
                          {item.smsFailedCount || 0} failed
                        </dd>
                      </div>
                    </dl>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <SecondaryButton
                        disabled={isBusy}
                        onClick={() => {
                          setSentHistoryOpen(false);
                          loadDraft(item.id);
                        }}
                      >
                        Open details
                      </SecondaryButton>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="flex min-h-[136px] items-center justify-center rounded-[8px] border border-white/10 bg-[#080D12] p-6 text-center text-sm font-semibold text-text-secondary">
                No sent announcements yet.
              </div>
            )}
            <div className="mt-5 flex justify-end sm:hidden">
              <button
                type="button"
                onClick={() => setSentHistoryOpen(false)}
                disabled={isBusy}
                className={primaryButtonClass("dark")}
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
