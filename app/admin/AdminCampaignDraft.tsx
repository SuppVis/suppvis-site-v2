"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_ADMIN_EMAIL_BODY,
  DEFAULT_ADMIN_EMAIL_CTA_LABEL,
  DEFAULT_ADMIN_EMAIL_CTA_URL,
  DEFAULT_ADMIN_EMAIL_HEADING,
  DEFAULT_ADMIN_EMAIL_SUBJECT,
  DEFAULT_ADMIN_MESSAGE_TYPE,
  DEFAULT_ADMIN_SMS_BODY,
  isDefaultAdminEmailContent,
  isDefaultAdminSmsContent,
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
  smsSavedAt?: string | null;
  smsTestedAt?: string | null;
  smsCharacterCount?: number;
  smsSegmentCount?: number;
  smsEncoding?: "GSM-7" | "Unicode";
  smsEligibleCount?: number;
  smsExcludedCount?: number;
  smsDuplicateCount?: number;
  smsTestProviderStatus?: string | null;
  smsTestRecipientMasked?: string | null;
  smsTestStatus?: string | null;
  smsTestMessageSid?: string | null;
  isPinned?: boolean;
  pinnedAt?: string | null;
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
  confirmationPhrase: string;
  duplicateCount: number;
  eligibleCount: number;
  excludedCount: number;
  smsDuplicateCount?: number;
  smsEligibleCount?: number;
  smsExcludedCount?: number;
  smsIncluded?: boolean;
  receivingBothCount?: number | null;
};

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
    | "sms_test_disabled"
    | "stale_version"
    | "text_not_saved"
    | "twilio_config_incomplete";
  sessionAuthorized: boolean;
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
  | "smsPreview"
  | "smsTest"
  | "start"
  | "test"
  | null;

type DefaultSaveRequest = {
  channel: "email" | "text";
  sections: string[];
};

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
                      <div style="display:inline-flex;width:42px;height:42px;align-items:center;justify-content:center;border:1px solid rgba(20,184,166,0.42);border-radius:14px;background:rgba(20,184,166,0.10);color:#14B8A6;font-size:20px;font-weight:800;">S</div>
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
  children,
  onClose,
  title,
}: {
  children: ReactNode;
  onClose: () => void;
  title: string;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-modal-title"
    >
      <div className="w-full max-w-lg rounded-[8px] border border-white/10 bg-[#0D1117] p-5 shadow-2xl shadow-black/50">
        <div className="flex items-start justify-between gap-4">
          <h2
            id="admin-modal-title"
            className="font-headline text-2xl font-bold text-text-primary"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 px-3 py-1 text-sm text-text-secondary transition hover:border-accent/50 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
          >
            Close
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

function ContinueCue({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-5 inline-flex items-center gap-2 rounded-full border border-accent/35 bg-accent/10 px-4 py-2 text-xs font-semibold text-accent opacity-95 shadow-[0_0_22px_rgba(36,196,182,0.16)] transition duration-200 hover:border-accent/70 hover:bg-accent/15 hover:shadow-[0_0_28px_rgba(36,196,182,0.24)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 motion-reduce:transition-none"
    >
      {children}
      <svg
        aria-hidden="true"
        className="h-3.5 w-3.5"
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
    </button>
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
  const emailSaveRef = useRef<HTMLButtonElement | null>(null);
  const firstEmailFieldRef = useRef<HTMLInputElement | null>(null);
  const textWorkspaceRef = useRef<HTMLDivElement | null>(null);
  const textHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const textBodyRef = useRef<HTMLTextAreaElement | null>(null);
  const textSaveRef = useRef<HTMLButtonElement | null>(null);
  const deliveryRef = useRef<HTMLElement | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const smsPreviewRef = useRef<HTMLDivElement | null>(null);
  const continueCueTimeoutRef = useRef<number | null>(null);
  const newAnnouncementButtonRef = useRef<HTMLButtonElement | null>(null);
  const [audience, setAudience] = useState<AudienceSummary | null>(null);
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [campaign, setCampaign] = useState<CampaignDraft | null>(null);
  const [continueCue, setContinueCue] = useState<
    "delivery" | "save" | "text" | null
  >(null);
  const [deleteTarget, setDeleteTarget] = useState<CampaignDraft | null>(null);
  const [defaultSaveRequest, setDefaultSaveRequest] =
    useState<DefaultSaveRequest | null>(null);
  const [drafts, setDrafts] = useState<CampaignDraft[]>([]);
  const [emailTestModalOpen, setEmailTestModalOpen] = useState(false);
  const [emailTestModalConfirmed, setEmailTestModalConfirmed] = useState(false);
  const [emailPreviewOutdated, setEmailPreviewOutdated] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof FormValues, string>>
  >({});
  const [form, setForm] = useState<FormValues>(initialForm);
  const [message, setMessage] = useState<{
    tone: "error" | "success" | "info";
    text: string;
  } | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewMode, setPreviewMode] = useState<"html" | "text">("html");
  const [progress, setProgress] = useState<ProgressSummary | null>(null);
  const [smsPreview, setSmsPreview] = useState<SmsPreview | null>(null);
  const [smsPreviewOutdated, setSmsPreviewOutdated] = useState(false);
  const [smsTestMessageSid, setSmsTestMessageSid] = useState<string | null>(null);
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

  const isBusy = Boolean(busyAction);
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
  const emailSaved = Boolean(campaign && !emailChangedSinceSave);
  const textWorkspaceUnlocked = workflowStarted || Boolean(campaign);
  const smsChangedSinceSave = Boolean(
    campaign && (!campaign.smsEnabled || campaign.smsBody !== form.smsBody),
  );
  const hasSavedSmsDraft = Boolean(
    campaign?.smsEnabled &&
      campaign.smsSavedAt &&
      campaign.smsBody &&
      !smsChangedSinceSave,
  );
  const selectedChannelsSaved = Boolean(
    campaign && !emailChangedSinceSave && hasSavedSmsDraft,
  );
  const smsSaved = hasSavedSmsDraft;
  const canApprove =
    campaign?.status === "tested" && selectedChannelsSaved && Boolean(audience);
  const canStart =
    campaign?.status === "approved" && selectedChannelsSaved && Boolean(audience);
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
    () => localEmailPreviewHtml(form),
    [form],
  );
  const defaultSmsPreview = useMemo(
    () => localSmsPreview(form.smsBody),
    [form.smsBody],
  );
  const activeSmsPreview = smsPreview;
  const displaySmsPreview = activeSmsPreview || defaultSmsPreview;
  const smsTestModalPreview =
    smsPreview && !smsPreviewOutdated ? smsPreview : persistedSmsPreview;
  const canUseSmsControls = textWorkspaceUnlocked && !isSendStarted;
  const smsProductionSendConnected = false;
  const canRequestEmailTest =
    Boolean(campaign) &&
    emailSaved &&
    testSendEnabled &&
    !isSendStarted;
  const canRequestSmsTest =
    Boolean(campaign) &&
    smsSaved &&
    Boolean(smsTestReadiness?.ready) &&
    !isSendStarted;
  const smsProductionReady =
    smsBulkSendEnabled && smsBulkInfraReady && smsProductionSendConnected;
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
    Boolean(defaultSaveRequest) ||
    newAnnouncementConfirmOpen ||
    sentHistoryOpen;

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
      const topOffset = options.block === "center" ? window.innerHeight * 0.2 : 24;
      const top = Math.max(0, window.scrollY + rect.top - topOffset);

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

  function scheduleContinueCue(cue: "delivery" | "save" | "text") {
    if (!workflowStarted || anyModalOpen) {
      return;
    }

    if (continueCueTimeoutRef.current) {
      window.clearTimeout(continueCueTimeoutRef.current);
    }

    setContinueCue(null);
    continueCueTimeoutRef.current = window.setTimeout(() => {
      setContinueCue(cue);
      continueCueTimeoutRef.current = null;
    }, usesReducedMotion() ? 0 : 4000);
  }

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

  function emailDefaultSections() {
    return isDefaultAdminEmailContent(form) ? ["Email"] : [];
  }

  function textDefaultSections() {
    return isDefaultAdminSmsContent(form.smsBody) ? ["Text"] : [];
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

  async function refreshDrafts() {
    setBusyAction((current) => current || "refresh");
    try {
      const response = await adminFetch("/api/admin/email-campaigns", {
        cache: "no-store",
      });
      const payload = await parseJsonResponse(response);
      setDrafts(payload.drafts || []);
    } finally {
      setBusyAction((current) => (current === "refresh" ? null : current));
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
    setProgress(payload.progress);
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
  }, []);

  useEffect(() => {
    return () => {
      if (continueCueTimeoutRef.current) {
        window.clearTimeout(continueCueTimeoutRef.current);
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
    setAudience(null);
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
    if (!continueCue) {
      return;
    }

    const target =
      continueCue === "text"
        ? textWorkspaceRef.current
        : continueCue === "save"
          ? textSaveRef.current
          : deliveryRef.current;

    if (!target) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setContinueCue(null);
        }
      },
      {
        threshold: 0.25,
      },
    );

    observer.observe(target);

    return () => observer.disconnect();
  }, [continueCue]);

  function updateField<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setAudience(null);
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
    if (
      key === "body" ||
      key === "ctaLabel" ||
      key === "ctaUrl" ||
      key === "heading" ||
      key === "messageType" ||
      key === "subject"
    ) {
      if (preview) {
        setEmailPreviewOutdated(true);
      }
      setTestSendMessageId(null);
    }
    if (key === "smsBody" || key === "smsEnabled") {
      if (smsPreview) {
        setSmsPreviewOutdated(true);
      }
      setSmsTestMessageSid(null);
      setSmsTestRecipient(null);
      setSmsTestReadiness(null);
    }
  }

  function updateCampaignFromPartial(partial: Partial<CampaignDraft>) {
    setCampaign((current) => (current ? { ...current, ...partial } : current));
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
    setCampaign(null);
    setContinueCue(null);
    setDefaultSaveRequest(null);
    setDeleteTarget(null);
    setEmailTestModalOpen(false);
    setEmailTestModalConfirmed(false);
    setEmailPreviewOutdated(false);
    setFieldErrors({});
    setForm({ ...initialForm, smsEnabled: true });
    setMessage(null);
    setPreview(null);
    setPreviewMode("html");
    setProgress(null);
    setSmsPreview(null);
    setSmsPreviewOutdated(false);
    setSmsTestMessageSid(null);
    setSmsTestModalOpen(false);
    setSmsTestModalConfirmed(false);
    setSmsTestRecipient(null);
    setSmsTestReadiness(null);
    setSaveHighlight(null);
    setSentHistoryOpen(false);
    setStartPhrase("");
    setTestSendMessageId(null);
    setWorkflowStarted(true);
    window.setTimeout(() => {
      scrollToElement(emailWorkspaceRef, { block: "start" });
      window.setTimeout(() => {
        firstEmailFieldRef.current?.focus({ preventScroll: true });
      }, usesReducedMotion() ? 0 : 350);
    }, usesReducedMotion() ? 0 : 350);
  }

  async function createEmailDraft(defaultContentConfirmed = false) {
    if (!validateEmailBeforeSave()) {
      return;
    }

    const defaultSections = emailDefaultSections();

    if (defaultSections.length && !defaultContentConfirmed) {
      setDefaultSaveRequest({ channel: "email", sections: defaultSections });
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
          defaultContentConfirmed,
          heading: form.heading,
          messageType: form.messageType,
          subject: form.subject,
        }),
      });
      const payload = await parseJsonResponse(response);
      setCampaign(payload.campaign);
      setMessage({
        tone: "success",
        text: `Email saved at ${new Date(
          payload.campaign.updatedAt,
        ).toLocaleTimeString()}.`,
      });
      await refreshDrafts();
      delayedScrollToElement(textWorkspaceRef, { block: "start" });
      scheduleContinueCue("text");
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not save email.",
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function saveEmailDraft(defaultContentConfirmed = false) {
    if (!campaign) {
      return createEmailDraft(defaultContentConfirmed);
    }

    if (!validateEmailBeforeSave()) {
      return;
    }

    const defaultSections = emailDefaultSections();

    if (defaultSections.length && !defaultContentConfirmed) {
      setDefaultSaveRequest({ channel: "email", sections: defaultSections });
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
          defaultContentConfirmed,
          expectedVersion: campaign.version,
          heading: form.heading,
          messageType: form.messageType,
          saveChannel: "email",
          subject: form.subject,
        }),
      });
      const payload = await parseJsonResponse(response);
      setCampaign(payload.campaign);
      setMessage({
        tone: "success",
        text: `Email saved at ${new Date(
          payload.campaign.updatedAt,
        ).toLocaleTimeString()}.`,
      });
      await refreshDrafts();
      delayedScrollToElement(textWorkspaceRef, { block: "start" });
      scheduleContinueCue("text");
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not save email.",
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function saveTextDraft(defaultContentConfirmed = false) {
    if (!campaign) {
      setMessage({
        tone: "error",
        text: "Save the email before saving the text message.",
      });
      scrollToElement(emailWorkspaceRef, { block: "start" });
      return;
    }

    if (!validateTextBeforeSave()) {
      return;
    }

    const defaultSections = textDefaultSections();

    if (defaultSections.length && !defaultContentConfirmed) {
      setDefaultSaveRequest({ channel: "text", sections: defaultSections });
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
          defaultContentConfirmed,
          saveChannel: "sms",
          smsBody: form.smsBody,
        }),
      });
      const payload = await parseJsonResponse(response);
      setCampaign(payload.campaign);
      setMessage({
        tone: "success",
        text: `Text saved at ${new Date(
          payload.campaign.updatedAt,
        ).toLocaleTimeString()}.`,
      });
      await refreshDrafts();
      await refreshSmsTestReadiness(payload.campaign);
      delayedScrollToElement(deliveryRef, { block: "start" });
      scheduleContinueCue("delivery");
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
      setCampaign(payload.campaign);
      setForm(campaignToForm(payload.campaign));
      setFieldErrors({});
      setPreview(null);
      setSmsPreview(null);
      setSmsTestReadiness(null);
      setMessage({ tone: "info", text: "Announcement loaded." });
      setWorkflowStarted(true);
      await refreshSmsTestReadiness(payload.campaign);
      delayedScrollToElement(emailWorkspaceRef, { block: "start" });
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
        setCampaign(null);
        setContinueCue(null);
        setEmailPreviewOutdated(false);
        setEmailTestModalConfirmed(false);
        setEmailTestModalOpen(false);
        setFieldErrors({});
        setForm({ ...initialForm, smsEnabled: true });
        setPreview(null);
        setProgress(null);
        setSmsPreview(null);
        setSmsPreviewOutdated(false);
        setSmsTestMessageSid(null);
        setSmsTestModalConfirmed(false);
        setSmsTestModalOpen(false);
        setSmsTestRecipient(null);
        setSmsTestReadiness(null);
        setStartPhrase("");
        setTestSendMessageId(null);
        setWorkflowStarted(false);
      }
      setDeleteTarget(null);
      setMessage({ tone: "success", text: "Draft deleted." });
      if (deletingOpenAnnouncement) {
        delayedScrollToElement(topRef, { block: "start" });
        window.setTimeout(
          () => newAnnouncementButtonRef.current?.focus({ preventScroll: true }),
          usesReducedMotion() ? 0 : 750,
        );
      }
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
      scrollToElement(emailWorkspaceRef, { block: "start" });
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
          ctaLabel: form.ctaLabel,
          ctaUrl: form.ctaUrl,
          heading: form.heading,
          messageType: form.messageType,
          subject: form.subject,
        }),
      });
      const payload = await parseJsonResponse(response);
      setPreview(payload.preview);
      setEmailPreviewOutdated(false);
      setMessage({ tone: "success", text: "Preview generated." });

      if (workflowStarted) {
        delayedScrollToElement(previewRef, { block: "start" });
        scheduleContinueCue("text");
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
      scrollToElement(textWorkspaceRef, { block: "start" });
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
          smsBody: form.smsBody,
          smsEnabled: true,
        }),
      });
      const payload = await parseJsonResponse(response);
      setSmsPreview(payload.preview);
      setSmsPreviewOutdated(false);
      setMessage({ tone: "success", text: "Text preview generated." });

      if (workflowStarted) {
        delayedScrollToElement(smsPreviewRef, { block: "start" });
        scheduleContinueCue("save");
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
          scrollToElement(textWorkspaceRef, { block: "start" });
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
      setMessage({
        tone:
          payload.status === "sent"
            ? "success"
            : payload.status === "failed"
              ? "error"
              : "info",
        text:
          payload.message ||
          (payload.status === "sent"
            ? "Text test accepted by Twilio."
            : "Text testing is not enabled."),
      });
      setSmsTestModalConfirmed(false);
      setSmsTestModalOpen(false);
      setSmsTestRecipient(payload.maskedPhone || null);
      setSmsTestMessageSid(payload.messageSid || null);

      if (payload.campaign) {
        updateCampaignFromPartial(payload.campaign);
        await refreshSmsTestReadiness(payload.campaign);
      }
      await refreshDrafts();
    } catch (error) {
      setMessage({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : "Could not send test text.",
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function approveCampaign() {
    if (!campaign || !canApprove || isBusy) {
      return;
    }

    setBusyAction("approve");
    setMessage(null);

    try {
      const response = await adminFetch(
        `/api/admin/email-campaigns/${campaign.id}/approve`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ expectedVersion: campaign.version }),
        },
      );
      const payload = await parseJsonResponse(response);
      updateCampaignFromPartial(payload.campaign);
      setMessage({
        tone: "success",
        text: "Announcement approved. Type the confirmation phrase when you are ready to queue it.",
      });
      await refreshDrafts();
    } catch (error) {
      setMessage({
        tone: "error",
        text:
          error instanceof Error ? error.message : "Could not approve announcement.",
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
      },
    );
    const payload = await parseJsonResponse(response);
    setAudience(payload.audience);
    setStartPhrase("");
    return payload.audience as AudienceSummary;
  }

  async function calculateAudience() {
    if (!campaign || isBusy || !selectedChannelsSaved || !adminTestsReady) {
      return;
    }

    setBusyAction("audience");
    setMessage(null);

    try {
      const nextAudience = await calculateAudienceForCampaign(campaign.id);
      setMessage({
        tone: "success",
        text: `Email: ${nextAudience.eligibleCount} eligible. Text: ${
          nextAudience.smsEligibleCount || 0
        } eligible.`,
      });
    } catch (error) {
      setMessage({
        tone: "error",
        text:
          error instanceof Error ? error.message : "Could not count recipients.",
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function startCampaign() {
    if (!campaign || !audience || !canStart || isBusy) {
      return;
    }

    setBusyAction("start");
    setMessage(null);

    try {
      const response = await adminFetch(
        `/api/admin/email-campaigns/${campaign.id}/start`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            expectedVersion: campaign.version,
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
          text: "Announcement queued for eligible email and text subscribers.",
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

  const previewsReady = Boolean(
    preview &&
      activeSmsPreview &&
      !emailPreviewOutdated &&
      !smsPreviewOutdated,
  );
  const emailTestReady = Boolean(campaign?.testedAt);
  const smsTestReady = Boolean(campaign?.smsTestedAt);
  const adminTestsReady = Boolean(emailTestReady && smsTestReady);
  const selectedDeliveryReady = bulkInfraReady && smsProductionReady;
  const smsReadinessReason = smsTestReadiness?.reason;
  const currentSmsTestMaskedPhone =
    smsTestReadiness?.maskedPhone || smsTestRecipientMasked;
  const smsTestDisabledCopy = !smsSaved
    ? "Save the text message before sending a test."
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
  const recipientsReviewed =
    Boolean(audience) && (campaign?.status === "approved" || isSendStarted);
  const announcementQueued =
    campaign?.status === "queueing" ||
    campaign?.status === "queued" ||
    campaign?.status === "sending" ||
    campaign?.status === "completed" ||
    campaign?.status === "completed_with_failures";
  const workflowSteps = [
    {
      label: "Draft email & text",
      state: selectedChannelsSaved
        ? "completed"
        : workflowStarted
          ? "active"
          : "blocked",
      detail: selectedChannelsSaved
        ? "Email and text drafts are saved."
        : workflowStarted
          ? emailSaved
            ? "Text still needs to be saved."
            : "Save the email, then save the text."
          : "Click New announcement to begin.",
    },
    {
      label: "Preview email & text",
      state: previewsReady
        ? "completed"
        : selectedChannelsSaved
          ? "active"
          : "blocked",
      detail: previewsReady
        ? "Email and text previews are ready."
        : selectedChannelsSaved
          ? "Generate email and text previews."
          : "Save the draft first.",
    },
    {
      label: "Test email",
      state: emailTestReady
        ? "completed"
        : previewsReady
          ? "active"
          : "blocked",
      detail: emailTestReady
        ? "Email test is complete."
        : previewsReady
          ? "Send one test email to yourself."
          : "Generate both previews first.",
    },
    {
      label: "Test text",
      state: smsTestReady
        ? "completed"
        : emailTestReady
          ? "active"
          : "blocked",
      detail: smsTestReady
        ? "Text test is complete."
        : emailTestReady
          ? smsTestDisabledCopy || "Send one test text to yourself."
          : "Complete the email test first.",
    },
    {
      label: "Approve & review recipients",
      state: recipientsReviewed
        ? "completed"
        : adminTestsReady
          ? "active"
          : "blocked",
      detail: recipientsReviewed && audience
        ? `Email: ${audience.eligibleCount}. Text: ${
            audience.smsEligibleCount || 0
          }.`
        : adminTestsReady
          ? audience
            ? "Approve after reviewing recipient counts."
            : "Refresh recipient counts before approval."
          : "Complete admin tests first.",
    },
    {
      label: "Send announcement",
      state:
        announcementQueued
          ? "completed"
          : campaign?.status === "approved" && audience && selectedDeliveryReady
            ? "active"
            : "blocked",
      detail:
        announcementQueued
          ? "The worker continues independently."
          : campaign?.status === "approved" && audience && selectedDeliveryReady
            ? "Type the confirmation phrase to send."
            : !bulkInfraReady
              ? "Sending is not available while setup is being prepared."
              : "Text delivery jobs are not connected yet.",
    },
  ] as const;

  const stepTone = {
    active:
      "border-accent/70 bg-accent/15 text-teal-50 shadow-[0_0_30px_rgba(36,196,182,0.16)]",
    blocked: "border-white/10 bg-white/[0.03] text-text-muted",
    completed: "border-accent/20 bg-white/[0.04] text-text-secondary",
  };

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
          {!bulkInfraReady || !smsProductionReady
            ? "Setup incomplete"
            : isSendStarted
              ? status
              : "Ready to send"}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={calculateAudience}
          disabled={
            !campaign ||
            isBusy ||
            !selectedChannelsSaved ||
            !adminTestsReady ||
            (campaign.status !== "tested" && campaign.status !== "approved")
          }
          className={primaryButtonClass("dark")}
        >
          {busyAction === "audience" ? "Counting..." : "Refresh recipient count"}
        </button>
        <button
          type="button"
          onClick={approveCampaign}
          disabled={!campaign || !canApprove || isBusy}
          className={primaryButtonClass("blue")}
        >
          {busyAction === "approve" ? "Approving..." : "Approve announcement"}
        </button>
      </div>

      {audience ? (
        <div className="mt-4 rounded-[8px] border border-white/10 bg-[#080D12] p-4 text-sm leading-6 text-text-secondary">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[8px] border border-white/10 bg-[#0D1117] p-3">
              <p className="font-semibold text-text-primary">
                Email recipients
              </p>
              <p className="mt-1">
                {audience.eligibleCount} eligible subscribers.
              </p>
              <p className="text-xs text-text-muted">
                {audience.excludedCount} excluded or suppressed records.
                {audience.duplicateCount
                  ? ` ${audience.duplicateCount} duplicate email records skipped.`
                  : ""}
              </p>
            </div>
            <div className="rounded-[8px] border border-white/10 bg-[#0D1117] p-3">
              <p className="font-semibold text-text-primary">Text recipients</p>
              <p className="mt-1">
                {audience.smsEligibleCount || 0} eligible subscribers.
              </p>
              <p className="text-xs text-text-muted">
                {audience.smsExcludedCount || 0} text records excluded.
                {audience.smsDuplicateCount
                  ? ` ${audience.smsDuplicateCount} duplicate phone records skipped.`
                  : ""}
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs text-text-muted">
            Receiving both is not shown until a future safe email-phone join is
            added.
          </p>
          {campaign?.status === "approved" || isSendStarted ? (
            <>
              <label className="mt-4 block">
                <span className="font-semibold text-text-primary">
                  Type this phrase to send:
                </span>
                <code className="mt-2 block rounded-[8px] border border-white/10 bg-[#05090D] px-3 py-2 text-xs text-accent">
                  {audience.confirmationPhrase}
                </code>
                <input
                  value={startPhrase}
                  onChange={(event) => setStartPhrase(event.target.value)}
                  disabled={isSendStarted}
                  className="mt-2 w-full rounded-[8px] border border-white/10 bg-[#080D12] px-4 py-3 text-sm text-text-primary outline-none transition focus:border-accent disabled:cursor-not-allowed disabled:opacity-60"
                />
              </label>
              <button
                type="button"
                onClick={startCampaign}
                disabled={
                  !campaign ||
                  !canStart ||
                  !bulkSendEnabled ||
                  !bulkInfraReady ||
                  !smsProductionReady ||
                  !audience.eligibleCount ||
                  !audience.smsEligibleCount ||
                  startPhrase !== audience.confirmationPhrase ||
                  isBusy
                }
                className={`mt-4 ${primaryButtonClass("amber")}`}
              >
                {busyAction === "start" ? "Queueing..." : "Send announcement"}
              </button>
            </>
          ) : (
            <p className="mt-4 rounded-[8px] border border-white/10 bg-[#0D1117] p-3 text-xs leading-5 text-text-muted">
              Approve the announcement after reviewing these counts. The send
              confirmation will appear after approval.
            </p>
          )}
          {!smsProductionReady ? (
            <p className="mt-3 text-xs leading-5 text-yellow-100">
              Sending is not available yet because text delivery jobs are not
              connected.
            </p>
          ) : null}
          {!bulkInfraReady ? (
            <p className="mt-3 text-xs leading-5 text-yellow-100">
              Sending is not available while setup is being prepared.
            </p>
          ) : null}
          {audience.eligibleCount === 0 || !audience.smsEligibleCount ? (
            <p className="mt-3 text-xs leading-5 text-yellow-100">
              Both email and text need at least one eligible recipient before
              sending.
            </p>
          ) : null}
        </div>
      ) : null}

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
              ["Accepted by SES", progress.counts.sent],
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
            Queued means ready for the worker. Accepted by SES means AWS
            accepted the message. Delivered means SES reports delivery to the
            recipient mail server.
          </p>
        </div>
      ) : null}
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
                      Email test
                    </dt>
                    <dd>{draft.testedAt ? "Complete" : "Needed"}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-text-secondary">Text</dt>
                    <dd>
                      {draft.smsEnabled && draft.smsSavedAt
                        ? draft.smsTestedAt
                          ? "Saved, tested"
                          : "Saved"
                        : "Needs text"}
                    </dd>
                  </div>
                </dl>
                <div className="mt-3 flex flex-wrap gap-2">
                  {draft.isPinned ? (
                    <span className="rounded-full border border-accent/25 bg-accent/10 px-2 py-1 text-xs text-teal-50">
                      Pinned
                    </span>
                  ) : null}
                  <span className="rounded-full border border-blue-300/20 bg-blue-400/10 px-2 py-1 text-xs text-blue-50">
                    Email
                  </span>
                  <span
                    className={`rounded-full border px-2 py-1 text-xs ${
                      draft.smsEnabled && draft.smsSavedAt
                        ? "border-accent/25 bg-accent/10 text-teal-50"
                        : "border-yellow-400/20 bg-yellow-400/10 text-yellow-50"
                    }`}
                  >
                    {draft.smsEnabled && draft.smsSavedAt
                      ? "Text saved"
                      : "Text needed"}
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
              className="mt-2 w-full rounded-[8px] border border-white/10 bg-[#080D12] px-4 py-3 text-sm text-text-primary outline-none transition focus:border-accent disabled:cursor-not-allowed disabled:opacity-60"
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
              value={form.heading}
              onChange={(event) => updateField("heading", event.target.value)}
              maxLength={160}
              disabled={isSendStarted}
              className="mt-2 w-full rounded-[8px] border border-white/10 bg-[#080D12] px-4 py-3 text-sm text-text-primary outline-none transition focus:border-accent disabled:cursor-not-allowed disabled:opacity-60"
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
              value={form.body}
              onChange={(event) => updateField("body", event.target.value)}
              rows={10}
              maxLength={5000}
              disabled={isSendStarted}
              className="mt-2 w-full resize-y rounded-[8px] border border-white/10 bg-[#080D12] px-4 py-3 text-sm leading-6 text-text-primary outline-none transition focus:border-accent disabled:cursor-not-allowed disabled:opacity-60"
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
                value={form.ctaLabel}
                onChange={(event) => updateField("ctaLabel", event.target.value)}
                maxLength={64}
                disabled={isSendStarted}
                className="mt-2 w-full rounded-[8px] border border-white/10 bg-[#080D12] px-4 py-3 text-sm text-text-primary outline-none transition focus:border-accent disabled:cursor-not-allowed disabled:opacity-60"
              />
              <span className="mt-2 block text-xs leading-5 text-text-muted">
                The words shown on the email button, such as "Open TestFlight."
              </span>
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-text-primary">
                Link URL
              </span>
              <input
                value={form.ctaUrl}
                onChange={(event) => updateField("ctaUrl", event.target.value)}
                maxLength={300}
                disabled={isSendStarted}
                className="mt-2 w-full rounded-[8px] border border-white/10 bg-[#080D12] px-4 py-3 text-sm text-text-primary outline-none transition focus:border-accent disabled:cursor-not-allowed disabled:opacity-60"
              />
              <span className="mt-2 block text-xs leading-5 text-text-muted">
                The secure web address opened by the button.
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
            }`}
          >
            {busyAction === "saveEmail" ? "Saving..." : "Save email"}
          </button>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={generatePreview}
            disabled={!emailSaved || isBusy}
            className={primaryButtonClass("blue")}
          >
            {busyAction === "preview" ? "Generating..." : "Generate preview"}
          </button>
          <button
            type="button"
            onClick={() => {
              setEmailTestModalConfirmed(false);
              setEmailTestModalOpen(true);
            }}
            disabled={!canRequestEmailTest || isBusy}
            className={primaryButtonClass("amber")}
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
                {preview?.subject || form.subject || "Untitled beta update"}
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

          {preview && emailPreviewOutdated ? (
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
                Draft preview - Default content. Generate preview before
                testing or approving.
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
                    form.heading,
                    "",
                    form.body.trim(),
                    "",
                    form.ctaLabel && form.ctaUrl
                      ? `${form.ctaLabel}: ${form.ctaUrl}`
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

      {continueCue === "text" ? (
        <ContinueCue onClick={() => scrollToElement(textWorkspaceRef)}>
          Continue to the text message
        </ContinueCue>
      ) : null}

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
              className="mt-2 w-full resize-y rounded-[8px] border border-white/10 bg-[#080D12] px-4 py-3 text-sm leading-6 text-text-primary outline-none transition focus:border-accent disabled:cursor-not-allowed disabled:opacity-60"
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
                }`}
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
                onClick={generateSmsPreview}
                disabled={!smsSaved || !canUseSmsControls || isBusy}
                className={primaryButtonClass("blue")}
              >
                {busyAction === "smsPreview"
                  ? "Generating..."
                  : "Generate text preview"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSmsTestModalConfirmed(false);
                  setSmsTestModalOpen(true);
                }}
                disabled={!canRequestSmsTest || isBusy}
                className={primaryButtonClass("amber")}
              >
                {busyAction === "smsTest"
                  ? "Sending test..."
                  : "Send test text to myself"}
              </button>
            </div>

            {smsTestDisabledCopy ? (
              <div className="rounded-[8px] border border-yellow-400/20 bg-yellow-400/10 p-4 text-sm leading-6 text-yellow-50">
                {smsTestDisabledCopy}
              </div>
            ) : null}

            {smsTestRecipient ? (
              <div className="rounded-[8px] border border-accent/25 bg-accent/10 p-4 text-sm leading-6 text-teal-50">
                Test text accepted by Twilio for {smsTestRecipient}.
                {smsTestMessageSid ? " Message SID recorded." : ""}
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
                      Draft preview - Default content. Generate preview before
                      testing or approving.
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
            Text sending is not connected yet. No SMS recipients are touched
            while the announcement remains unsent.
          </p>
        </div>
      </section>

      {continueCue === "save" ? (
        <ContinueCue onClick={() => scrollToElement(textSaveRef)}>
          Continue to admin tests
        </ContinueCue>
      ) : null}

      {continueCue === "delivery" ? (
        <ContinueCue onClick={() => scrollToElement(deliveryRef)}>
          Continue to subscriber delivery
        </ContinueCue>
      ) : null}

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

      {defaultSaveRequest ? (
        <Modal
          title="Use the default announcement?"
          onClose={() => {
            if (!isBusy) {
              setDefaultSaveRequest(null);
            }
          }}
        >
          <p className="text-sm leading-6 text-text-secondary">
            This announcement still uses the default example content. You can
            continue, but confirm that you intend to save and use it.
          </p>
          <div className="mt-4 rounded-[8px] border border-white/10 bg-[#080D12] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
              Default content detected
            </p>
            <p className="mt-2 text-sm font-semibold text-text-primary">
              {defaultSaveRequest.sections.join(" and ")}
            </p>
          </div>
          <div className="mt-5 flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={() => setDefaultSaveRequest(null)}
              disabled={isBusy}
              className={primaryButtonClass("dark")}
            >
              Go back
            </button>
            <button
              type="button"
              onClick={() => {
                const request = defaultSaveRequest;
                setDefaultSaveRequest(null);
                if (request.channel === "email") {
                  saveEmailDraft(true);
                } else {
                  saveTextDraft(true);
                }
              }}
              disabled={isBusy}
              className={primaryButtonClass("teal")}
            >
              Save default content
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
              {busyAction === "test" ? "Sending test..." : "Send test email"}
            </button>
          </div>
        </Modal>
      ) : null}

      {smsTestModalOpen ? (
        <Modal
          title="Send test text?"
          onClose={() => {
            if (!isBusy) {
              setSmsTestModalOpen(false);
              setSmsTestModalConfirmed(false);
            }
          }}
        >
          <p className="text-sm leading-6 text-text-secondary">
            This sends exactly one test text to the configured admin test
            number for your signed-in account.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[8px] border border-white/10 bg-[#080D12] p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
                Admin
              </p>
              <p className="mt-1 break-words text-sm font-semibold text-text-primary">
                {adminEmail}
              </p>
            </div>
            <div className="rounded-[8px] border border-white/10 bg-[#080D12] p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
                Test number
              </p>
              <p className="mt-1 text-sm font-semibold text-text-primary">
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
          <div className="mt-5 flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setSmsTestModalOpen(false);
                setSmsTestModalConfirmed(false);
              }}
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
              {busyAction === "smsTest" ? "Sending test..." : "Send test text"}
            </button>
          </div>
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
                          {item.eligibleCount || item.recipientCount || 0} eligible ·{" "}
                          {item.sentCount || 0} accepted ·{" "}
                          {item.deliveredCount || 0} delivered ·{" "}
                          {item.failedCount || 0} failed
                        </dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-text-secondary">
                          Text
                        </dt>
                        <dd>
                          {item.smsEligibleCount || 0} eligible ·{" "}
                          {item.smsExcludedCount || 0} excluded
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
          </div>
        </Modal>
      ) : null}
    </>
  );
}
