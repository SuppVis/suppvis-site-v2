"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

const DEFAULT_BODY =
  "A new SuppVis beta update is ready. Open TestFlight to install the latest build, then reply with anything that feels confusing, broken, or surprisingly useful.";

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
};

type Preview = {
  html: string;
  subject: string;
  text: string;
};

type FormValues = {
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  heading: string;
  messageType: CampaignDraft["messageType"];
  subject: string;
};

type BusyAction =
  | "approve"
  | "audience"
  | "delete"
  | "load"
  | "preview"
  | "refresh"
  | "save"
  | "start"
  | "test"
  | null;

const initialForm: FormValues = {
  body: DEFAULT_BODY,
  ctaLabel: "Open TestFlight",
  ctaUrl: "https://testflight.apple.com/join/nTASgewZ",
  heading: "A new beta build is ready.",
  messageType: "testflight_update",
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
    completed: "Email sent",
    completed_with_failures: "Email completed with issues",
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
    "disabled:cursor-not-allowed disabled:translate-y-0 disabled:scale-100 disabled:bg-white/10 disabled:text-text-muted",
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
  testSendEnabled,
}: {
  adminEmail: string;
  bulkInfraReady: boolean;
  bulkSendEnabled: boolean;
  testSendEnabled: boolean;
}) {
  const previewRef = useRef<HTMLDivElement | null>(null);
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
  const [startPhrase, setStartPhrase] = useState("");
  const [testSendConfirmed, setTestSendConfirmed] = useState(false);
  const [testSendMessageId, setTestSendMessageId] = useState<string | null>(null);

  const hasCampaign = Boolean(campaign);
  const isBusy = Boolean(busyAction);
  const status = useMemo(() => statusLabel(campaign?.status), [campaign]);
  const canApprove = campaign?.status === "tested";
  const canStart = campaign?.status === "approved";
  const canDeleteCurrent = campaign ? canDeleteDraft(campaign) : false;
  const isSendStarted =
    campaign?.status === "queueing" ||
    campaign?.status === "queued" ||
    campaign?.status === "sending" ||
    campaign?.status === "completed" ||
    campaign?.status === "completed_with_failures" ||
    campaign?.status === "failed";

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
  }

  function updateCampaignFromPartial(partial: Partial<CampaignDraft>) {
    setCampaign((current) => (current ? { ...current, ...partial } : current));
  }

  function startAnotherEmail() {
    if (isBusy) {
      return;
    }

    setAudience(null);
    setCampaign(null);
    setForm(initialForm);
    setMessage({
      tone: "info",
      text: "Ready for a new email. Save the draft to begin.",
    });
    setPreview(null);
    setProgress(null);
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
      setMessage({ tone: "success", text: "Draft created and saved." });
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
        text: `Draft saved at ${new Date(
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
      setMessage({ tone: "info", text: "Draft loaded." });
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
        text: `Email approved. ${nextAudience.eligibleCount} eligible subscribers counted.`,
      });
      await refreshDrafts();
    } catch (error) {
      setMessage({
        tone: "error",
        text:
          error instanceof Error ? error.message : "Could not approve email.",
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
        text: `${nextAudience.eligibleCount} eligible subscribers counted.`,
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
          text: "Email queued for delivery.",
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
          error instanceof Error ? error.message : "Could not send email.",
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

  const workflowSteps = [
    {
      label: "Draft saved",
      state: campaign ? "completed" : "ready",
      detail: campaign ? "Saved in DynamoDB." : "Start by saving this draft.",
    },
    {
      label: "Preview generated",
      state: preview ? "completed" : campaign ? "ready" : "blocked",
      detail: preview
        ? "HTML and text preview are ready."
        : campaign
          ? "Generate the exact email preview."
          : "Save the draft first.",
    },
    {
      label: "Test email sent",
      state: campaign?.testedAt ? "completed" : preview ? "ready" : "blocked",
      detail: campaign?.testedAt
        ? `Sent to ${adminEmail}.`
        : preview
          ? "Send one test to yourself."
          : "Preview the email first.",
    },
    {
      label: "Email approved",
      state:
        campaign?.status === "approved" || isSendStarted
          ? "completed"
          : campaign?.status === "tested"
            ? "ready"
            : "blocked",
      detail:
        campaign?.status === "approved" || isSendStarted
          ? "Approved for recipient review."
          : campaign?.status === "tested"
            ? "Approve after reviewing your test."
            : "Send a test email first.",
    },
    {
      label: audience
        ? `${audience.eligibleCount} eligible subscribers confirmed`
        : "Recipients reviewed",
      state: audience ? "completed" : campaign?.status === "approved" ? "ready" : "blocked",
      detail: audience
        ? `${audience.excludedCount} excluded or suppressed.`
        : campaign?.status === "approved"
          ? "Refresh the count before sending."
          : "Approve the email first.",
    },
    {
      label:
        campaign?.status === "completed"
          ? "Email sent"
          : campaign?.status === "completed_with_failures"
            ? "Email completed with issues"
            : "Ready to send",
      state:
        campaign?.status === "completed" ||
        campaign?.status === "completed_with_failures"
          ? "completed"
          : campaign?.status === "queueing" ||
              campaign?.status === "queued" ||
              campaign?.status === "sending"
            ? "completed"
            : audience && bulkInfraReady
              ? "ready"
              : "blocked",
      detail:
        campaign?.status === "queueing" ||
        campaign?.status === "queued" ||
        campaign?.status === "sending"
          ? "The worker continues independently."
          : audience && bulkInfraReady
            ? "Type the confirmation phrase to send."
            : !bulkInfraReady
              ? "Sending is not available while setup is being prepared."
              : "Review recipients first.",
    },
  ] as const;

  const stepTone = {
    blocked: "border-white/10 bg-white/[0.03] text-text-muted",
    completed: "border-accent/25 bg-accent/10 text-teal-50",
    ready: "border-blue-300/25 bg-blue-400/10 text-blue-50",
  };

  return (
    <>
      <section className="mb-5 rounded-[8px] border border-white/10 bg-[#0D1117] p-4 shadow-2xl shadow-black/20">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
              Workflow
            </p>
            <h2 className="mt-2 font-headline text-xl font-bold text-text-primary">
              Draft, test, approve, then send
            </h2>
          </div>
          <button
            type="button"
            onClick={startAnotherEmail}
            disabled={isBusy}
            className={primaryButtonClass("dark")}
          >
            Send another email
          </button>
        </div>
        <ol className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
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
              Draft composer
            </p>
            <h2 className="mt-2 font-headline text-2xl text-text-primary">
              Beta update email
            </h2>
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              Save a draft, preview it, send one admin test, then approve and
              review recipients before sending.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-semibold capitalize text-accent">
              {status}
            </span>
            <button
              type="button"
              onClick={startAnotherEmail}
              disabled={isBusy}
              className="rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-text-secondary transition hover:border-accent/60 hover:text-accent active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              New email
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
                ? "Save draft"
                : "Create draft"}
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

        <div className="mt-6 rounded-[8px] border border-white/10 bg-[#080D12] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
                Subscriber email
              </p>
              <p className="mt-2 text-sm leading-6 text-text-secondary">
                Review the final email and recipient count before sending. You
                will be asked to type a confirmation phrase.
              </p>
            </div>
            <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-text-secondary">
              {bulkInfraReady
                ? isSendStarted
                  ? status
                  : "Ready to send"
                : "Setup incomplete"}
            </span>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={approveCampaign}
              disabled={!campaign || !canApprove || isBusy}
              className={primaryButtonClass("blue")}
            >
              {busyAction === "approve" ? "Approving..." : "Approve email"}
            </button>
            <button
              type="button"
              onClick={calculateAudience}
              disabled={!campaign || isBusy || (campaign.status !== "tested" && campaign.status !== "approved")}
              className={primaryButtonClass("dark")}
            >
              {busyAction === "audience" ? "Counting..." : "Refresh recipient count"}
            </button>
          </div>

          {audience ? (
            <div className="mt-4 rounded-[8px] border border-white/10 bg-[#0D1117] p-4 text-sm leading-6 text-text-secondary">
              <p className="font-semibold text-text-primary">
                {audience.eligibleCount} eligible subscribers
              </p>
              <p>
                {audience.excludedCount} excluded or suppressed records.
                {audience.duplicateCount
                  ? ` ${audience.duplicateCount} duplicate email records skipped.`
                  : ""}
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
                  startPhrase !== audience.confirmationPhrase ||
                  isBusy
                }
                className={`mt-4 ${primaryButtonClass("amber")}`}
              >
                {busyAction === "start" ? "Sending..." : "Send email"}
              </button>
              {!bulkInfraReady ? (
                <p className="mt-3 text-xs leading-5 text-yellow-100">
                  Sending is not available yet because the email delivery system
                  is still being prepared.
                </p>
              ) : null}
            </div>
          ) : null}

          {progress ? (
            <div className="mt-4 rounded-[8px] border border-white/10 bg-[#0D1117] p-4 text-sm leading-6 text-text-secondary">
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
              <dl className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-5">
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
                    className="rounded-[8px] border border-white/10 bg-[#080D12] p-3"
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
                accepted the message. Delivered means SES reports delivery to
                the recipient mail server.
              </p>
            </div>
          ) : null}
        </div>

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

        <div className="rounded-[8px] border border-white/10 bg-[#0D1117] p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-headline text-xl font-bold text-text-primary">
              Recent drafts
            </h2>
            <SecondaryButton
              disabled={isBusy}
              onClick={() =>
                refreshDrafts().catch(() =>
                  setMessage({
                    tone: "error",
                    text: "Could not refresh drafts.",
                  }),
                )
              }
            >
              {busyAction === "refresh" ? "Refreshing..." : "Refresh"}
            </SecondaryButton>
          </div>

          <div className="space-y-3">
            {drafts.length ? (
              drafts.map((draft) => (
                <article
                  key={draft.id}
                  className="rounded-[8px] border border-white/10 bg-[#080D12] p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words font-semibold text-text-primary">
                        {draft.subject}
                      </p>
                      <p className="mt-2 line-clamp-2 text-sm text-text-secondary">
                        {draft.heading}
                      </p>
                    </div>
                    <span className="rounded-full border border-accent/20 px-2 py-1 text-xs capitalize text-accent">
                      {statusLabel(draft.status)}
                    </span>
                  </div>
                  <dl className="mt-3 grid gap-2 text-xs text-text-muted sm:grid-cols-3">
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
                        Tested
                      </dt>
                      <dd>{draft.testedAt ? "Yes" : "No"}</dd>
                    </div>
                  </dl>
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
              ))
            ) : (
              <p className="rounded-[8px] border border-white/10 bg-[#080D12] p-4 text-sm text-text-secondary">
                No drafts loaded yet.
              </p>
            )}
          </div>
        </div>
      </div>
      </section>
    </>
  );
}
