"use client";

import { useState } from "react";

type UnsubscribeClientProps = {
  subscriberId?: string;
  token?: string;
};

type Status = "idle" | "loading" | "success" | "error";

export default function UnsubscribeClient({
  subscriberId,
  token,
}: UnsubscribeClientProps) {
  const hasValidLink = Boolean(subscriberId && token);
  const [status, setStatus] = useState<Status>(
    hasValidLink ? "idle" : "error",
  );
  const [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState(
    hasValidLink
      ? "Review what changes before confirming your opt-out."
      : "This unsubscribe link is invalid or expired.",
  );

  async function handleUnsubscribe() {
    if (!subscriberId || !token || !confirmed || status !== "idle") {
      return;
    }

    setStatus("loading");

    try {
      const response = await fetch("/api/email-subscribers/unsubscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subscriberId,
          token,
        }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        message?: string;
      };

      if (!response.ok || !payload.ok) {
        setStatus("error");
        setMessage(payload.message || "This unsubscribe link is invalid or expired.");
        return;
      }

      setStatus("success");
      setMessage(payload.message || "You're unsubscribed from SuppVis emails.");
    } catch {
      setStatus("error");
      setMessage("We couldn't update your email preference right now. Please try again in a moment.");
    }
  }

  const canSubmit = status === "idle" && confirmed && hasValidLink;
  const isSuccess = status === "success";
  const isError = status === "error";

  return (
    <main className="min-h-screen bg-bg-primary px-5 py-10 text-text-primary sm:px-6 sm:py-16">
      <section className="mx-auto flex min-h-[74vh] max-w-4xl items-center justify-center">
        <div className="relative w-full overflow-hidden rounded-[28px] border border-accent/20 bg-[linear-gradient(145deg,rgba(13,17,23,0.98),rgba(10,15,20,0.98))] p-6 shadow-[0_28px_90px_rgba(0,0,0,0.42)] sm:p-10 lg:p-12">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/70 to-transparent" />

          <div className="mb-9 flex items-start justify-between gap-5">
            <div>
              <p className="mb-4 inline-flex rounded-full border border-accent/25 px-3 py-1 font-body text-xs font-bold uppercase tracking-[0.18em] text-accent">
                SuppVis Beta
              </p>
              <h1 className="max-w-2xl font-headline text-4xl font-extrabold leading-[1.02] tracking-normal text-text-primary sm:text-5xl lg:text-6xl">
                {isSuccess
                  ? "You're unsubscribed"
                  : "Opt out of beta emails"}
              </h1>
            </div>

            <div
              className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-accent/35 bg-accent/10 shadow-[0_0_32px_rgba(20,184,166,0.16)] sm:size-16"
              aria-label="SuppVis"
              role="img"
            >
              <img
                src="/favicon.svg"
                alt=""
                className="size-full object-cover"
              />
            </div>
          </div>

          <p
            className={`max-w-2xl text-base leading-7 sm:text-lg ${
              isSuccess ? "text-accent" : "text-text-secondary"
            }`}
          >
            {message}
          </p>

          {!isSuccess && !isError ? (
            <>
              <div className="my-8 border-y border-accent/10 py-6">
                <p className="max-w-2xl text-sm leading-6 text-text-secondary sm:text-base">
                  This stops beta announcements, beta access updates, and
                  product information from SuppVis. You can join the list again
                  later from the site.
                </p>
              </div>

              <label
                htmlFor="unsubscribe-confirmation"
                className="mb-6 flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-accent/35 hover:bg-accent/5"
              >
                <input
                  id="unsubscribe-confirmation"
                  type="checkbox"
                  checked={confirmed}
                  onChange={(event) => setConfirmed(event.target.checked)}
                  className="mt-1 size-5 shrink-0 rounded border border-accent/40 bg-bg-primary accent-accent"
                  aria-describedby="unsubscribe-confirmation-help"
                />
                <span className="text-sm leading-6 text-text-secondary">
                  <span className="block font-bold text-text-primary">
                    I understand that I will stop receiving SuppVis beta emails.
                  </span>
                  <span id="unsubscribe-confirmation-help">
                    This only changes SuppVis beta email updates.
                  </span>
                </span>
              </label>

              <button
                type="button"
                onClick={handleUnsubscribe}
                disabled={!canSubmit}
                className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-accent px-6 py-3 font-body text-sm font-bold text-bg-primary transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto"
              >
                {status === "loading" ? "Updating..." : "Unsubscribe"}
              </button>
            </>
          ) : isSuccess ? (
            <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
              <a
                href="/#waitlist"
                className="inline-flex min-h-12 w-full items-center justify-center rounded-full border border-accent/35 px-6 py-3 font-body text-sm font-bold text-accent transition hover:border-accent hover:bg-accent/10 sm:w-auto"
              >
                Back to SuppVis
              </a>
              <p className="text-sm leading-6 text-text-muted">
                You can rejoin the beta list from the site at any time.
              </p>
            </div>
          ) : (
            <div className="mt-8">
              <a
                href="/#waitlist"
                className="inline-flex min-h-12 w-full items-center justify-center rounded-full border border-accent/35 px-6 py-3 font-body text-sm font-bold text-accent transition hover:border-accent hover:bg-accent/10 sm:w-auto"
              >
                Back to SuppVis
              </a>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
