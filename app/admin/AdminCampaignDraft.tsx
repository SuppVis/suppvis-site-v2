"use client";

import { useEffect, useMemo, useState } from "react";

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
  testRecipient?: string | null;
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

export default function AdminCampaignDraft({
  adminEmail,
  testSendEnabled,
}: {
  adminEmail: string;
  testSendEnabled: boolean;
}) {
  const [campaign, setCampaign] = useState<CampaignDraft | null>(null);
  const [drafts, setDrafts] = useState<CampaignDraft[]>([]);
  const [form, setForm] = useState<FormValues>(initialForm);
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewMode, setPreviewMode] = useState<"html" | "text">("html");
  const [testSendConfirmed, setTestSendConfirmed] = useState(false);

  const hasCampaign = Boolean(campaign);
  const status = useMemo(() => statusLabel(campaign?.status), [campaign]);

  async function refreshDrafts() {
    const response = await fetch("/api/admin/email-campaigns", {
      cache: "no-store",
    });
    const payload = await parseJsonResponse(response);
    setDrafts(payload.drafts || []);
  }

  useEffect(() => {
    refreshDrafts().catch((error) => {
      setMessage(error instanceof Error ? error.message : "Could not load drafts.");
    });
  }, []);

  useEffect(() => {
    setTestSendConfirmed(false);
  }, [campaign?.id, campaign?.version]);

  function updateField<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function createDraft() {
    setIsBusy(true);
    setMessage("");

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
      setMessage("Draft created.");
      await refreshDrafts();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create draft.");
    } finally {
      setIsBusy(false);
    }
  }

  async function saveDraft() {
    if (!campaign) {
      return createDraft();
    }

    setIsBusy(true);
    setMessage("");

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
      setMessage("Draft saved.");
      await refreshDrafts();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save draft.");
    } finally {
      setIsBusy(false);
    }
  }

  async function loadDraft(id: string) {
    setIsBusy(true);
    setMessage("");

    try {
      const response = await fetch(`/api/admin/email-campaigns/${id}`, {
        cache: "no-store",
      });
      const payload = await parseJsonResponse(response);
      setCampaign(payload.campaign);
      setForm(campaignToForm(payload.campaign));
      setPreview(null);
      setMessage("Draft loaded.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load draft.");
    } finally {
      setIsBusy(false);
    }
  }

  async function generatePreview() {
    setIsBusy(true);
    setMessage("");

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
      setMessage("Preview generated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not generate preview.");
    } finally {
      setIsBusy(false);
    }
  }

  async function requestTestSend() {
    if (!campaign || !testSendEnabled || !testSendConfirmed) {
      return;
    }

    setIsBusy(true);
    setMessage("");

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
      setMessage(
        payload.status === "sent"
          ? "Test email accepted by SES."
          : payload.message || "Test send is disabled.",
      );
      setTestSendConfirmed(false);

      if (payload.campaign) {
        setCampaign((current) =>
          current ? { ...current, ...payload.campaign } : current,
        );
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not send test.");
    } finally {
      setIsBusy(false);
    }
  }

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
              Drafts save to DynamoDB. Preview is server-rendered. Bulk sending
              is not implemented.
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
              className="mt-2 w-full rounded-[8px] border border-white/10 bg-[#080D12] px-4 py-3 text-sm text-text-primary outline-none transition focus:border-accent"
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
            <span className="text-sm font-semibold text-text-primary">
              Body
            </span>
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
                CTA label
              </span>
              <input
                value={form.ctaLabel}
                onChange={(event) => updateField("ctaLabel", event.target.value)}
                maxLength={64}
                className="mt-2 w-full rounded-[8px] border border-white/10 bg-[#080D12] px-4 py-3 text-sm text-text-primary outline-none transition focus:border-accent"
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-text-primary">
                CTA URL
              </span>
              <input
                value={form.ctaUrl}
                onChange={(event) => updateField("ctaUrl", event.target.value)}
                maxLength={300}
                className="mt-2 w-full rounded-[8px] border border-white/10 bg-[#080D12] px-4 py-3 text-sm text-text-primary outline-none transition focus:border-accent"
              />
            </label>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={hasCampaign ? saveDraft : createDraft}
            disabled={isBusy}
            className="rounded-full bg-accent px-5 py-3 text-sm font-bold text-[#03100E] transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {hasCampaign ? "Save draft" : "Create draft"}
          </button>
          <button
            type="button"
            onClick={generatePreview}
            disabled={isBusy}
            className="rounded-full border border-white/15 px-5 py-3 text-sm font-bold text-text-primary transition hover:border-accent/60 hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            Generate preview
          </button>
          <button
            type="button"
            onClick={requestTestSend}
            disabled={!campaign || !testSendEnabled || !testSendConfirmed || isBusy}
            className="rounded-full border border-yellow-400/30 px-5 py-3 text-sm font-bold text-yellow-100 transition hover:border-yellow-300 disabled:cursor-not-allowed disabled:opacity-45"
          >
            Test send
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
        ) : null}

        {!testSendEnabled ? (
          <div className="mt-5 rounded-[8px] border border-yellow-400/20 bg-yellow-400/10 p-4 text-sm leading-6 text-yellow-100">
            Test sending is disabled. It requires
            `ADMIN_EMAIL_CAMPAIGNS_ENABLED=true` and
            `ADMIN_EMAIL_TEST_SEND_ENABLED=true`. Bulk sending has no route.
          </div>
        ) : null}

        {message ? (
          <div className="mt-5 rounded-[8px] border border-white/10 bg-[#080D12] p-4 text-sm leading-6 text-text-secondary">
            {message}
          </div>
        ) : null}
      </div>

      <div className="space-y-5">
        <div className="rounded-[8px] border border-white/10 bg-[#05090D] p-5 shadow-2xl shadow-black/20">
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
            <button
              type="button"
              onClick={() => refreshDrafts().catch(() => setMessage("Could not refresh drafts."))}
              className="rounded-full border border-white/15 px-3 py-2 text-xs font-semibold text-text-secondary hover:border-accent/60 hover:text-accent"
            >
              Refresh
            </button>
          </div>

          <div className="space-y-3">
            {drafts.length ? (
              drafts.map((draft) => (
                <button
                  key={draft.id}
                  type="button"
                  onClick={() => loadDraft(draft.id)}
                  className="block w-full rounded-[8px] border border-white/10 bg-[#080D12] p-4 text-left transition hover:border-accent/50"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-text-primary">
                      {draft.subject}
                    </p>
                    <span className="rounded-full border border-accent/20 px-2 py-1 text-xs capitalize text-accent">
                      {statusLabel(draft.status)}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-1 text-sm text-text-secondary">
                    {draft.heading}
                  </p>
                  <p className="mt-2 text-xs text-text-muted">
                    Updated {new Date(draft.updatedAt).toLocaleString()}
                  </p>
                </button>
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
