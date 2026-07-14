"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

const DEFAULT_BODY =
  "A new SuppVis beta update is ready. Open TestFlight to install the latest build, then reply with anything that feels confusing, broken, or surprisingly useful.";

type CampaignDraft = {
  id: string;
  messageType: "beta_update" | "testflight_update" | "feedback_request";
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

  return status.replace(/_/g, " ");
}

function messageTypeLabel(messageType?: string) {
  if (messageType === "testflight_update") {
    return "TestFlight update";
  }

  if (messageType === "feedback_request") {
    return "Feedback request";
  }

  return "Beta update";
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
  const [startPhrase, setStartPhrase] = useState("");
  const [testSendConfirmed, setTestSendConfirmed] = useState(false);
  const [testSendMessageId, setTestSendMessageId] = useState<string | null>(null);

  const hasCampaign = Boolean(campaign);
  const isBusy = Boolean(busyAction);
  const status = useMemo(() => statusLabel(campaign?.status), [campaign]);
  const canApprove = campaign?.status === "tested";
  const canStart = campaign?.status === "approved";
  const canDeleteCurrent = campaign ? canDeleteDraft(campaign) : false;

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
  }, [campaign?.id, campaign?.version]);

  function updateField<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setAudience(null);
  }

  function updateCampaignFromPartial(partial: Partial<CampaignDraft>) {
    setCampaign((current) => (current ? { ...current, ...partial } : current));
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
        text: "This campaign can no longer be deleted.",
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
          text: payload.message || "Test send is disabled.",
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
      setMessage({ tone: "success", text: "Campaign approved." });
      await refreshDrafts();
    } catch (error) {
      setMessage({
        tone: "error",
        text:
          error instanceof Error ? error.message : "Could not approve campaign.",
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function calculateAudience() {
    if (!campaign || isBusy) {
      return;
    }

    setBusyAction("audience");
    setMessage(null);

    try {
      const response = await fetch(
        `/api/admin/email-campaigns/${campaign.id}/audience`,
        {
          method: "POST",
        },
      );
      const payload = await parseJsonResponse(response);
      setAudience(payload.audience);
      setStartPhrase("");
      setMessage({
        tone: "success",
        text: `${payload.audience.eligibleCount} eligible subscribers counted.`,
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
          text: payload.message || "Production sending is disabled.",
        });
      } else {
        setMessage({
          tone: "success",
          text: "Campaign queued for delivery.",
        });
      }

      if (payload.campaign) {
        updateCampaignFromPartial(payload.campaign);
      }
      await refreshDrafts();
    } catch (error) {
      setMessage({
        tone: "error",
        text:
          error instanceof Error ? error.message : "Could not start campaign.",
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

  return (
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
              Save a draft, preview it, send one admin test, then approve before
              any production queueing.
            </p>
          </div>
          <span className="rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-semibold capitalize text-accent">
            {status}
          </span>
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
              disabled={campaign?.status === "queueing" || campaign?.status === "queued" || campaign?.status === "sending"}
              className="mt-2 w-full rounded-[8px] border border-white/10 bg-[#080D12] px-4 py-3 text-sm text-text-primary outline-none transition focus:border-accent disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="beta_update">Beta update</option>
              <option value="testflight_update">TestFlight update</option>
              <option value="feedback_request">Feedback request</option>
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
              className="mt-2 w-full rounded-[8px] border border-white/10 bg-[#080D12] px-4 py-3 text-sm text-text-primary outline-none transition focus:border-accent"
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
              className="mt-2 w-full rounded-[8px] border border-white/10 bg-[#080D12] px-4 py-3 text-sm text-text-primary outline-none transition focus:border-accent"
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-text-primary">Body</span>
            <textarea
              value={form.body}
              onChange={(event) => updateField("body", event.target.value)}
              rows={10}
              maxLength={5000}
              className="mt-2 w-full resize-y rounded-[8px] border border-white/10 bg-[#080D12] px-4 py-3 text-sm leading-6 text-text-primary outline-none transition focus:border-accent"
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
                className="mt-2 w-full rounded-[8px] border border-white/10 bg-[#080D12] px-4 py-3 text-sm text-text-primary outline-none transition focus:border-accent"
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
                className="mt-2 w-full rounded-[8px] border border-white/10 bg-[#080D12] px-4 py-3 text-sm text-text-primary outline-none transition focus:border-accent"
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
            disabled={isBusy || !canDeleteCurrent && hasCampaign}
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
            {busyAction === "test" ? "Sending test..." : "Test send"}
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
                Production controls
              </p>
              <p className="mt-2 text-sm leading-6 text-text-secondary">
                Approve only after a successful test. Production send requires a
                fresh count and exact typed confirmation.
              </p>
            </div>
            <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-text-secondary">
              {bulkInfraReady ? "Queue ready" : "Queue blocked"}
            </span>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={approveCampaign}
              disabled={!campaign || !canApprove || isBusy}
              className={primaryButtonClass("blue")}
            >
              {busyAction === "approve" ? "Approving..." : "Approve campaign"}
            </button>
            <button
              type="button"
              onClick={calculateAudience}
              disabled={!campaign || isBusy || (campaign.status !== "tested" && campaign.status !== "approved")}
              className={primaryButtonClass("dark")}
            >
              {busyAction === "audience" ? "Counting..." : "Count recipients"}
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
                  Type this phrase to start:
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
                {busyAction === "start" ? "Starting campaign..." : "Start campaign"}
              </button>
              {!bulkInfraReady ? (
                <p className="mt-3 text-xs leading-5 text-yellow-100">
                  Subscriber sending is blocked by the infrastructure readiness
                  gate. Counting and approval are safe; queueing is not live.
                </p>
              ) : null}
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
  );
}
