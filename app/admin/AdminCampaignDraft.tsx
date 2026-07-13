"use client";

import { useMemo, useState } from "react";

const DEFAULT_BODY =
  "A new SuppVis beta update is ready. Open TestFlight to install the latest build, then reply with anything that feels confusing, broken, or surprisingly useful.";

function paragraphsFromBody(body: string) {
  return body
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

export default function AdminCampaignDraft() {
  const [subject, setSubject] = useState("New SuppVis beta update");
  const [heading, setHeading] = useState("A new beta build is ready.");
  const [body, setBody] = useState(DEFAULT_BODY);
  const [ctaLabel, setCtaLabel] = useState("Open TestFlight");
  const [ctaUrl, setCtaUrl] = useState(
    "https://testflight.apple.com/join/nTASgewZ",
  );

  const paragraphs = useMemo(() => paragraphsFromBody(body), [body]);

  return (
    <section className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div className="rounded-[8px] border border-white/10 bg-[#0D1117] p-5 shadow-2xl shadow-black/20">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            Draft composer
          </p>
          <h2 className="mt-2 font-headline text-2xl text-text-primary">
            Beta update email
          </h2>
          <p className="mt-2 text-sm leading-6 text-text-secondary">
            This formats a future beta update in the SuppVis email style. Test
            and bulk sending are disabled in this phase.
          </p>
        </div>

        <div className="space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-text-primary">
              Subject
            </span>
            <input
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              maxLength={120}
              className="mt-2 w-full rounded-[8px] border border-white/10 bg-[#080D12] px-4 py-3 text-sm text-text-primary outline-none transition focus:border-accent"
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-text-primary">
              Heading
            </span>
            <input
              value={heading}
              onChange={(event) => setHeading(event.target.value)}
              maxLength={120}
              className="mt-2 w-full rounded-[8px] border border-white/10 bg-[#080D12] px-4 py-3 text-sm text-text-primary outline-none transition focus:border-accent"
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-text-primary">
              Body
            </span>
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={9}
              maxLength={2200}
              className="mt-2 w-full resize-y rounded-[8px] border border-white/10 bg-[#080D12] px-4 py-3 text-sm leading-6 text-text-primary outline-none transition focus:border-accent"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-[0.8fr_1.2fr]">
            <label className="block">
              <span className="text-sm font-semibold text-text-primary">
                CTA label
              </span>
              <input
                value={ctaLabel}
                onChange={(event) => setCtaLabel(event.target.value)}
                maxLength={48}
                className="mt-2 w-full rounded-[8px] border border-white/10 bg-[#080D12] px-4 py-3 text-sm text-text-primary outline-none transition focus:border-accent"
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-text-primary">
                CTA URL
              </span>
              <input
                value={ctaUrl}
                onChange={(event) => setCtaUrl(event.target.value)}
                maxLength={300}
                className="mt-2 w-full rounded-[8px] border border-white/10 bg-[#080D12] px-4 py-3 text-sm text-text-primary outline-none transition focus:border-accent"
              />
            </label>
          </div>
        </div>

        <div className="mt-5 rounded-[8px] border border-yellow-400/20 bg-yellow-400/10 p-4 text-sm leading-6 text-yellow-100">
          Sending is locked. The next phase should add one-recipient test sends
          first, then an approved queued campaign sender.
        </div>
      </div>

      <div className="rounded-[8px] border border-white/10 bg-[#05090D] p-5 shadow-2xl shadow-black/20">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
              Preview
            </p>
            <h2 className="mt-1 text-sm font-semibold text-text-primary">
              {subject || "Untitled beta update"}
            </h2>
          </div>
          <span className="rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
            No send path
          </span>
        </div>

        <article className="mx-auto max-w-xl rounded-[8px] border border-accent/20 bg-[#0D1117] p-6">
          <div className="mb-6 flex items-center gap-3">
            <img
              src="/favicon.svg"
              alt=""
              className="h-9 w-9 rounded-full border border-accent/30 bg-accent/10 p-1"
            />
            <div>
              <p className="font-headline text-xl font-extrabold text-text-primary">
                SuppVis
              </p>
              <p className="text-xs text-text-muted">Beta update</p>
            </div>
          </div>

          <h1 className="font-headline text-3xl font-extrabold leading-tight text-text-primary">
            {heading || "Beta update"}
          </h1>

          <div className="mt-5 space-y-4 text-sm leading-7 text-text-secondary">
            {paragraphs.length > 0 ? (
              paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)
            ) : (
              <p>Add body copy to preview the email.</p>
            )}
          </div>

          {ctaLabel && ctaUrl ? (
            <a
              href={ctaUrl}
              className="mt-7 inline-flex rounded-full bg-accent px-5 py-3 text-sm font-bold text-[#03100E]"
            >
              {ctaLabel}
            </a>
          ) : null}

          <p className="mt-8 border-t border-white/10 pt-5 text-xs leading-5 text-text-muted">
            You are receiving this because you joined the SuppVis beta. Every
            production email must include the unsubscribe link and suppression
            checks.
          </p>
        </article>
      </div>
    </section>
  );
}
