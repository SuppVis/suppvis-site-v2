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
  const [status, setStatus] = useState<Status>(
    subscriberId && token ? "idle" : "error",
  );
  const [message, setMessage] = useState(
    subscriberId && token
      ? "Confirm that you want to stop receiving SuppVis beta emails."
      : "This unsubscribe link is invalid or expired.",
  );

  async function handleUnsubscribe() {
    if (!subscriberId || !token) {
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
      setMessage("We couldn't update your email preference right now.");
    }
  }

  const canSubmit = status === "idle";

  return (
    <main className="min-h-screen bg-bg-primary px-6 py-16 text-text-primary">
      <section className="mx-auto flex min-h-[70vh] max-w-xl items-center justify-center">
        <div className="w-full rounded-[28px] border border-accent/20 bg-bg-secondary p-8 shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:p-10">
          <div className="mb-8">
            <p className="mb-3 font-headline text-2xl font-extrabold tracking-normal text-text-primary">
              SuppVis
            </p>
            <h1 className="font-headline text-4xl font-extrabold tracking-normal text-text-primary sm:text-5xl">
              Email preferences
            </h1>
          </div>

          <p
            className={`mb-8 text-base leading-7 ${
              status === "success" ? "text-accent" : "text-text-secondary"
            }`}
          >
            {message}
          </p>

          {status !== "success" ? (
            <button
              type="button"
              onClick={handleUnsubscribe}
              disabled={!canSubmit}
              className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-accent px-6 py-3 font-body text-sm font-bold text-bg-primary transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-55 sm:w-auto"
            >
              {status === "loading" ? "Updating..." : "Unsubscribe"}
            </button>
          ) : (
            <a
              href="/#waitlist"
              className="inline-flex min-h-12 w-full items-center justify-center rounded-full border border-accent/35 px-6 py-3 font-body text-sm font-bold text-accent transition hover:border-accent hover:bg-accent/10 sm:w-auto"
            >
              Back to SuppVis
            </a>
          )}
        </div>
      </section>
    </main>
  );
}
