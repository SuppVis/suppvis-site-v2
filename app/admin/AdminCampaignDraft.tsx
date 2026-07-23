"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

const DEFAULT_BODY =
  "A new SuppVis beta update is ready. Open TestFlight to install the latest build, then reply with anything that feels confusing, broken, or surprisingly useful.";
const DEFAULT_SMS_BODY =
  "Your beta update is ready. Open TestFlight to install the latest build: https://testflight.apple.com/join/nTASgewZ";

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
  updatedAt: string;
  version: number;
  testedAt?: string | null;
  approvedAt?: string | null;
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
  | "save"
  | "smsPreview"
  | "smsTest"
  | "start"
  | "test"
  | null;

const initialForm: FormValues = {
  body: DEFAULT_BODY,
  ctaLabel: "Open TestFlight",
  ctaUrl: "https://testflight.apple.com/join/nTASgewZ",
  heading: "A new beta build is ready.",
  messageType: "testflight_update",
  smsBody: DEFAULT_SMS_BODY,
  smsEnabled: false,
  subject: "New SuppVis beta update",
};

async function parseJsonResponse(response: Response) {
  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.ok) {
    const message =
      payload?.message ||
      payload?.code ||
      "The admin action could not be completed.";
    throw new Error(message);
  }

  return payload;
}

function campaignToForm(campaign: CampaignDraft): FormValues {
  return {
    body: campaign.body,
    ctaLabel: campaign.ctaLabel,
    ctaUrl: campaign.ctaUrl,
    heading: campaign.heading,
    messageType: campaign.messageType,
    smsBody: campaign.smsBody || DEFAULT_SMS_BODY,
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

function canDeleteDraft(campaign: CampaignDraft) {
  return (
    !campaign.approvedAt &&
    (campaign.status === "draft" ||
      campaign.status === "test_ready" ||
      campaign.status === "tested")
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
      <path d="M14 4l6 6" />
      <path d="M12 6l6 6-4 4-6-6 4-4z" />
      <path d="M8 14l-4 4" />
      <path d="M9 15l-3 5" />
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
      onClick={onClick}
      disabled={disabled}
      className="rounded-full border border-white/15 px-3 py-2 text-xs font-semibold text-text-secondary transition hover:border-accent/60 hover:text-accent active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
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
  testSendEnabled,
}: {
  adminEmail: string;
  bulkInfraReady: boolean;
  bulkSendEnabled: boolean;
  smsBulkInfraReady: boolean;
  smsBulkSendEnabled: boolean;
  smsTestSendEnabled: boolean;
  testSendEnabled: boolean;
}) {
  const previewRef = useRef<HTMLDivElement | null>(null);
  const smsPreviewRef = useRef<HTMLDivElement | null>(null);
  const [audience, setAudience] = useState<AudienceSummary | null>(null);
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [campaign, setCampaign] = useState<CampaignDraft | null>(null);
  const [drafts, setDrafts] = useState<CampaignDraft[]>([]);
  const [form, setForm] = useState<FormValues>(initialForm);
  const [message, setMessage] = useState<{
    tone: "error" | "success" | "info";
    text: string;
  } | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewMode, setPreviewMode] = useState<"html" | "text">("html");
  const [progress, setProgress] = useState<ProgressSummary | null>(null);
  const [smsPreview, setSmsPreview] = useState<SmsPreview | null>(null);
  const [smsTestConfirmed, setSmsTestConfirmed] = useState(false);
  const [startPhrase, setStartPhrase] = useState("");
  const [testSendConfirmed, setTestSendConfirmed] = useState(false);
  const [testSendMessageId, setTestSendMessageId] = useState<string | null>(null);
  const [pinningId, setPinningId] = useState<string | null>(null);

  const hasCampaign = Boolean(campaign);
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
  const textWorkspaceUnlocked = Boolean(campaign);
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
  const canApprove = campaign?.status === "tested" && selectedChannelsSaved;
  const canStart = campaign?.status === "approved" && selectedChannelsSaved;
  const canDeleteCurrent = campaign ? canDeleteDraft(campaign) : false;
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
  const activeSmsPreview = smsPreview || persistedSmsPreview;
  const canUseSmsControls = textWorkspaceUnlocked && !isSendStarted;
  const smsProductionSendConnected = false;
  const smsTestNumberConfigured = false;
  const canRequestSmsTest = smsTestSendEnabled && smsTestNumberConfigured;
  const smsProductionReady =
    smsBulkSendEnabled && smsBulkInfraReady && smsProductionSendConnected;

  async function refreshDrafts() {
    setBusyAction((current) => current || "refresh");
    try {
      const response = await fetch("/api/admin/email-campaigns", {
        cache: "no-store",
      });
      const payload = await parseJsonResponse(response);
      setDrafts(payload.drafts || []);
    } finally {
      setBusyAction((current) => (current === "refresh" ? null : current));
    }
  }

  async function fetchProgress(campaignId: string) {
    const response = await fetch(
      `/api/admin/email-campaigns/${campaignId}/progress`,
      { cache: "no-store" },
    );
    const payload = await parseJsonResponse(response);
    setProgress(payload.progress);
    return payload.progress as ProgressSummary;
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
    setTestSendConfirmed(false);
    setTestSendMessageId(null);
    setSmsPreview(null);
    setSmsTestConfirmed(false);
    setAudience(null);
    setStartPhrase("");
    setProgress(null);
  }, [campaign?.id, campaign?.version]);

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

  function updateField<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setAudience(null);
    if (key === "smsBody" || key === "smsEnabled") {
      setSmsPreview(null);
      setSmsTestConfirmed(false);
    }
  }

  function updateCampaignFromPartial(partial: Partial<CampaignDraft>) {
    setCampaign((current) => (current ? { ...current, ...partial } : current));
  }

  function startAnotherAnnouncement() {
    if (isBusy) {
      return;
    }

    setAudience(null);
    setCampaign(null);
    setForm(initialForm);
    setMessage({
      tone: "info",
      text: "Ready for a new announcement. Save the draft to begin.",
    });
    setPreview(null);
    setProgress(null);
    setSmsPreview(null);
    setSmsTestConfirmed(false);
    setStartPhrase("");
    setTestSendConfirmed(false);
    setTestSendMessageId(null);
  }

  async function createDraft() {
    setBusyAction("save");
    setMessage(null);

    try {
      const response = await fetch("/api/admin/email-campaigns", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });
      const payload = await parseJsonResponse(response);
      setCampaign(payload.campaign);
      setForm((current) => ({ ...current, smsEnabled: true }));
      setMessage({
        tone: "success",
        text: "Email draft created and saved. Add and save the text message next.",
      });
      await refreshDrafts();
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not create draft.",
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function saveDraft() {
    if (!campaign) {
      return createDraft();
    }

    setBusyAction("save");
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/email-campaigns/${campaign.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...form,
          expectedVersion: campaign.version,
        }),
      });
      const payload = await parseJsonResponse(response);
      setCampaign(payload.campaign);
      setMessage({
        tone: "success",
        text: `Email and text saved at ${new Date(
          payload.campaign.updatedAt,
        ).toLocaleTimeString()}.`,
      });
      await refreshDrafts();
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not save draft.",
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function loadDraft(id: string) {
    setBusyAction("load");
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/email-campaigns/${id}`, {
        cache: "no-store",
      });
      const payload = await parseJsonResponse(response);
      setCampaign(payload.campaign);
      setForm(campaignToForm(payload.campaign));
      setPreview(null);
      setSmsPreview(null);
      setMessage({ tone: "info", text: "Announcement loaded." });
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

    const confirmed = window.confirm(
      `Delete draft "${target.subject}"? This removes it from Recent drafts but keeps an audit trail.`,
    );

    if (!confirmed) {
      return;
    }

    setBusyAction("delete");
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/email-campaigns/${target.id}`, {
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
      if (campaign?.id === target.id) {
        setCampaign(null);
        setForm(initialForm);
        setPreview(null);
        setSmsPreview(null);
      }
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
      const response = await fetch(
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
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }

  async function generatePreview() {
    setBusyAction("preview");
    setMessage(null);

    try {
      const response = await fetch("/api/admin/email-campaigns/preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });
      const payload = await parseJsonResponse(response);
      setPreview(payload.preview);
      setMessage({ tone: "success", text: "Preview generated." });

      window.setTimeout(() => {
        previewRef.current?.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "auto"
            : "smooth",
          block: "start",
        });
      }, 50);
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
    if (!canUseSmsControls || isBusy) {
      return;
    }

    setBusyAction("smsPreview");
    setMessage(null);

    try {
      const response = await fetch("/api/admin/email-campaigns/sms-preview", {
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
      setMessage({ tone: "success", text: "Text preview generated." });

      window.setTimeout(() => {
        smsPreviewRef.current?.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "auto"
            : "smooth",
          block: "start",
        });
      }, 50);
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
    if (!campaign || !testSendEnabled || !testSendConfirmed || isBusy) {
      return;
    }

    setBusyAction("test");
    setMessage(null);

    try {
      const response = await fetch(
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
      } else {
        setMessage({
          tone: "info",
          text: payload.message || "Test email sending is disabled.",
        });
      }

      setTestSendConfirmed(false);

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
      !smsTestConfirmed ||
      isBusy
    ) {
      return;
    }

    setBusyAction("smsTest");
    setMessage(null);

    try {
      const response = await fetch(
        `/api/admin/email-campaigns/${campaign.id}/sms-test-send`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        },
      );
      const payload = await parseJsonResponse(response);
      setMessage({
        tone: payload.status === "sent" ? "success" : "info",
        text:
          payload.message ||
          "Text testing is disabled until a verified admin test number is configured.",
      });
      setSmsTestConfirmed(false);

      if (payload.campaign) {
        updateCampaignFromPartial(payload.campaign);
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
      const response = await fetch(
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
      const nextAudience = await calculateAudienceForCampaign(campaign.id);
      setMessage({
        tone: "success",
        text: `Announcement approved. Email: ${
          nextAudience.eligibleCount
        } eligible. Text: ${nextAudience.smsEligibleCount || 0} eligible.`,
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
    const response = await fetch(
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
    if (!campaign || isBusy) {
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
      const response = await fetch(
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
          text: "Announcement queued for delivery.",
        });
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

  const previewsReady = Boolean(preview && activeSmsPreview);
  const adminTestsReady = Boolean(
    campaign?.testedAt && (!smsTestSendEnabled || campaign.smsTestedAt),
  );
  const selectedDeliveryReady = bulkInfraReady && smsProductionReady;
  const workflowSteps = [
    {
      label: "Email saved",
      state: selectedChannelsSaved ? "completed" : campaign ? "ready" : "ready",
      detail: campaign
        ? emailChangedSinceSave
          ? "Save the latest email changes."
          : "Email draft is saved."
        : "Start by saving this announcement.",
    },
    {
      label: "Text saved",
      state: smsSaved ? "completed" : textWorkspaceUnlocked ? "ready" : "blocked",
      detail: smsSaved
        ? "Text draft is saved."
        : textWorkspaceUnlocked
          ? "Add and save the text message."
          : "Save the email draft first.",
    },
    {
      label: "Previews reviewed",
      state: previewsReady
        ? "completed"
        : selectedChannelsSaved
          ? "ready"
          : "blocked",
      detail: previewsReady
        ? "Email and text previews are ready."
        : selectedChannelsSaved
          ? "Generate email and text previews."
          : "Save the draft first.",
    },
    {
      label: "Admin tests completed",
      state: adminTestsReady
        ? "completed"
        : preview
          ? "ready"
          : "blocked",
      detail: adminTestsReady
        ? "Email test complete. Text testing is not enabled here."
        : preview
          ? "Send one email test to yourself."
          : "Preview the email first.",
    },
    {
      label: "Announcement approved",
      state:
        campaign?.status === "approved" || isSendStarted
          ? "completed"
          : canApprove
            ? "ready"
            : "blocked",
      detail:
        campaign?.status === "approved" || isSendStarted
          ? "Approved for recipient review."
          : canApprove
            ? "Approve after reviewing email and text."
            : "Complete the saved draft and admin test first.",
    },
    {
      label: "Recipients reviewed",
      state: audience
        ? "completed"
        : campaign?.status === "approved"
          ? "ready"
          : "blocked",
      detail: audience
        ? `Email: ${audience.eligibleCount}. Text: ${
            audience.smsEligibleCount || 0
          }.`
        : campaign?.status === "approved"
          ? "Refresh the count before sending."
          : "Approve the announcement first.",
    },
    {
      label:
        campaign?.status === "completed"
          ? "Announcement sent"
          : campaign?.status === "completed_with_failures"
            ? "Announcement completed with issues"
            : "Ready to send",
      state:
        campaign?.status === "completed" ||
        campaign?.status === "completed_with_failures"
          ? "completed"
          : campaign?.status === "queueing" ||
              campaign?.status === "queued" ||
              campaign?.status === "sending"
            ? "completed"
            : audience && selectedDeliveryReady
              ? "ready"
              : "blocked",
      detail:
        campaign?.status === "queueing" ||
        campaign?.status === "queued" ||
        campaign?.status === "sending"
          ? "The worker continues independently."
          : audience && selectedDeliveryReady
            ? "Type the confirmation phrase to send."
            : !bulkInfraReady
              ? "Sending is not available while setup is being prepared."
              : "Text delivery jobs are not connected yet.",
    },
  ] as const;

  const stepTone = {
    blocked: "border-white/10 bg-white/[0.03] text-text-muted",
    completed: "border-accent/25 bg-accent/10 text-teal-50",
    ready: "border-blue-300/25 bg-blue-400/10 text-blue-50",
  };

  const subscriberDeliverySection = (
    <section className="rounded-[8px] border border-white/10 bg-[#0D1117] p-5 shadow-2xl shadow-black/20">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
            Subscriber delivery
          </p>
          <p className="mt-2 text-sm leading-6 text-text-secondary">
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
          onClick={approveCampaign}
          disabled={!campaign || !canApprove || isBusy}
          className={primaryButtonClass("blue")}
        >
          {busyAction === "approve" ? "Approving..." : "Approve announcement"}
        </button>
        <button
          type="button"
          onClick={calculateAudience}
          disabled={
            !campaign ||
            isBusy ||
            campaign.status !== "approved"
          }
          className={primaryButtonClass("dark")}
        >
          {busyAction === "audience" ? "Counting..." : "Refresh recipient count"}
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
              className="mt-2 w-full rounded-[8px] border border-white/10 bg-[#080D12] px-4 py-3 text-sm text-text-primary outline-none transition focus:border-accent"
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
            {busyAction === "start" ? "Sending..." : "Send announcement"}
          </button>
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
        <h2 className="font-headline text-xl font-bold text-text-primary">
          Recent announcements
        </h2>
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
                      onClick={() => togglePin(draft)}
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
          <p className="rounded-[8px] border border-white/10 bg-[#080D12] p-4 text-sm text-text-secondary">
            No announcements loaded yet.
          </p>
        )}
      </div>
    </section>
  );

  return (
    <>
      <section className="mb-5 rounded-[8px] border border-white/10 bg-[#0D1117] p-4 shadow-2xl shadow-black/20">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
              Workflow
            </p>
            <h2 className="mt-2 font-headline text-xl font-bold text-text-primary">
              Draft, preview, test, approve, then send
            </h2>
          </div>
          <button
            type="button"
            onClick={startAnotherAnnouncement}
            disabled={isBusy}
            className={primaryButtonClass("dark")}
          >
            New announcement
          </button>
        </div>
        <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7">
          {workflowSteps.map((step, index) => (
            <li
              key={step.label}
              className={`min-h-[118px] rounded-[8px] border p-3 text-sm ${stepTone[step.state]}`}
            >
              <div className="flex items-center gap-2">
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-current/30 text-xs font-bold">
                  {index + 1}
                </span>
                <span className="font-semibold leading-5">{step.label}</span>
              </div>
              <p className="mt-2 text-xs leading-5 opacity-85">{step.detail}</p>
              <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.12em] opacity-70">
                {step.state}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
      <div className="rounded-[8px] border border-white/10 bg-[#0D1117] p-5 shadow-2xl shadow-black/20">
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
            <button
              type="button"
              onClick={startAnotherAnnouncement}
              disabled={isBusy}
              className="inline-flex min-h-8 items-center justify-center rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-text-secondary transition duration-150 ease-out hover:-translate-y-0.5 hover:border-accent/60 hover:text-accent active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0D1117] disabled:pointer-events-none disabled:cursor-not-allowed disabled:translate-y-0 disabled:scale-100 disabled:border-white/10 disabled:text-text-muted disabled:opacity-55"
            >
              New announcement
            </button>
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
              value={form.subject}
              onChange={(event) => updateField("subject", event.target.value)}
              maxLength={120}
              disabled={isSendStarted}
              className="mt-2 w-full rounded-[8px] border border-white/10 bg-[#080D12] px-4 py-3 text-sm text-text-primary outline-none transition focus:border-accent disabled:cursor-not-allowed disabled:opacity-60"
            />
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

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={hasCampaign ? saveDraft : createDraft}
            disabled={isBusy || (!canDeleteCurrent && hasCampaign)}
            className={primaryButtonClass("teal")}
          >
            {busyAction === "save"
              ? "Saving..."
              : hasCampaign
                ? "Save email & text"
                : "Save email"}
          </button>
          <button
            type="button"
            onClick={generatePreview}
            disabled={isBusy}
            className={primaryButtonClass("blue")}
          >
            {busyAction === "preview" ? "Generating..." : "Generate preview"}
          </button>
          <button
            type="button"
            onClick={requestTestSend}
            disabled={!campaign || !testSendEnabled || !testSendConfirmed || isBusy}
            className={primaryButtonClass("amber")}
          >
            {busyAction === "test" ? "Sending test..." : "Send test to myself"}
          </button>
        </div>

        {testSendEnabled ? (
          <label className="mt-5 flex gap-3 rounded-[8px] border border-yellow-400/20 bg-yellow-400/10 p-4 text-sm leading-6 text-yellow-50">
            <input
              type="checkbox"
              checked={testSendConfirmed}
              onChange={(event) => setTestSendConfirmed(event.target.checked)}
              disabled={!campaign || isBusy}
              className="mt-1 h-4 w-4 shrink-0 accent-accent disabled:cursor-not-allowed"
            />
            <span>
              I understand this sends one test email only to my signed-in admin
              address, <strong>{adminEmail}</strong>. It will not send to beta
              subscribers.
            </span>
          </label>
        ) : (
          <div className="mt-5 rounded-[8px] border border-yellow-400/20 bg-yellow-400/10 p-4 text-sm leading-6 text-yellow-100">
            Test sending is disabled.
          </div>
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
                Server preview
              </p>
              <h2 className="mt-1 text-sm font-semibold text-text-primary">
                {preview?.subject || form.subject || "Untitled beta update"}
              </h2>
            </div>
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
            <div className="rounded-[8px] border border-white/10 bg-[#0D1117] p-6 text-sm leading-6 text-text-secondary">
              Generate a server preview to see the exact sanitized HTML and
              plain-text email that future sends would use.
            </div>
          )}
        </div>
      </div>
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <div
          className={`relative overflow-hidden rounded-[8px] border border-white/10 bg-[#0D1117] p-5 shadow-2xl shadow-black/20 transition duration-300 ${
            textWorkspaceUnlocked ? "" : "opacity-75"
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
                Text workspace
              </p>
              <h2 className="mt-2 font-headline text-2xl text-text-primary">
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
              Save the email draft before adding a text message.
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
                value={form.smsBody}
                onChange={(event) => updateField("smsBody", event.target.value)}
                rows={6}
                maxLength={260}
                disabled={!canUseSmsControls}
                className="mt-2 w-full resize-y rounded-[8px] border border-white/10 bg-[#080D12] px-4 py-3 text-sm leading-6 text-text-primary outline-none transition focus:border-accent disabled:cursor-not-allowed disabled:opacity-60"
              />
              <span className="mt-2 block text-xs leading-5 text-text-muted">
                Type only the update itself. The SuppVis prefix and rates notice
                are added automatically.
              </span>
            </label>

            {smsChangedSinceSave || emailChangedSinceSave ? (
              <div className="rounded-[8px] border border-yellow-400/20 bg-yellow-400/10 p-3 text-xs leading-5 text-yellow-50">
                Save the latest email and text changes before approval or
                subscriber sending.
              </div>
            ) : null}

            <div className="rounded-[8px] border border-white/10 bg-[#080D12] p-3 text-xs leading-5 text-text-muted">
              {activeSmsPreview ? (
                <span>
                  {activeSmsPreview.characterCount} characters -{" "}
                  {activeSmsPreview.segmentCount}{" "}
                  {activeSmsPreview.segmentCount === 1 ? "segment" : "segments"}{" "}
                  - {activeSmsPreview.encoding}
                </span>
              ) : (
                <span>Generate a preview to check characters and segments.</span>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={generateSmsPreview}
                disabled={!canUseSmsControls || isBusy}
                className={primaryButtonClass("blue")}
              >
                {busyAction === "smsPreview"
                  ? "Generating..."
                  : "Generate text preview"}
              </button>
              <button
                type="button"
                onClick={requestSmsTestSend}
                disabled={
                  !campaign ||
                  !canRequestSmsTest ||
                  !smsTestConfirmed ||
                  isBusy
                }
                className={primaryButtonClass("amber")}
              >
                {busyAction === "smsTest"
                  ? "Sending test..."
                  : "Send test text to myself"}
              </button>
            </div>

            <label className="flex gap-3 rounded-[8px] border border-yellow-400/20 bg-yellow-400/10 p-4 text-sm leading-6 text-yellow-50">
              <input
                type="checkbox"
                checked={smsTestConfirmed}
                onChange={(event) => setSmsTestConfirmed(event.target.checked)}
                disabled={!canRequestSmsTest || isBusy}
                className="mt-1 h-4 w-4 shrink-0 accent-accent disabled:cursor-not-allowed"
              />
              <span>
                Text testing requires a verified admin test number. It is not
                available in this workspace yet.
              </span>
            </label>
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
              {activeSmsPreview ? "Previewed" : "Not started"}
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
              {activeSmsPreview ? (
                <div className="rounded-[18px] bg-accent/15 p-4 text-sm leading-6 text-teal-50">
                  <p className="whitespace-pre-wrap">{activeSmsPreview.body}</p>
                </div>
              ) : (
                <div className="rounded-[18px] border border-white/10 bg-white/[0.03] p-4 text-sm leading-6 text-text-secondary">
                  Generate a server preview to see the exact text message.
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

      <section className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        {subscriberDeliverySection}
        {recentAnnouncementsSection}
      </section>

      <div className="mt-6 flex justify-center">
        <button
          type="button"
          onClick={scrollToTop}
          className="inline-flex w-full max-w-3xl items-center justify-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-5 py-4 text-sm font-bold text-accent transition duration-150 ease-out hover:-translate-y-0.5 hover:border-accent/70 hover:bg-accent/15 active:translate-y-0 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary"
        >
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
            <path d="M12 19V5" />
            <path d="M5 12l7-7 7 7" />
          </svg>
          Back to top
        </button>
      </div>
    </>
  );
}
