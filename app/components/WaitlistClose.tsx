"use client";

import { useState, FormEvent } from "react";
import { useScrollReveal } from "../hooks/useScrollReveal";

export default function WaitlistClose() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const sectionRef = useScrollReveal();

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const form = e.currentTarget;
    const data = new FormData(form);

    try {
      const response = await fetch("/api/beta-applications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          email: data.get("email"),
          phone: data.get("phone"),
          smsOptIn: data.get("smsOptIn") === "on",
          sourcePage: `${window.location.pathname}${window.location.hash || "#waitlist"}`,
          botField: data.get("botField"),
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.ok) {
        throw new Error(result?.message || "Please try again in a moment.");
      }

      setSubmitted(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "We could not save your application right now. Please try again in a moment.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="waitlist" className="py-24 md:py-32 px-6">
      <div ref={sectionRef} className="scroll-reveal max-w-[600px] mx-auto text-center">
        <h2 className="font-headline font-extrabold text-3xl sm:text-4xl md:text-5xl text-text-primary mb-6 leading-tight">
          Your stack is already costing you. Find out if it&rsquo;s paying off.
        </h2>
        <p className="text-text-secondary text-lg mb-10">
          Join the beta. Get founding member access and a direct line to the team
          building it.
        </p>

        {submitted ? (
          <div className="animate-pulse-glow rounded-2xl bg-bg-secondary border border-accent/20 p-10">
            <p className="text-text-primary text-xl font-semibold">
              You&rsquo;re in. We&rsquo;ll reach out with beta access details soon.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-left">
            <div
              className="absolute left-[-9999px] h-0 w-0 overflow-hidden"
              aria-hidden="true"
            >
              <label htmlFor="beta-bot-field">Company website</label>
              <input
                type="text"
                id="beta-bot-field"
                name="botField"
                tabIndex={-1}
                autoComplete="off"
              />
            </div>
            <div>
              <label htmlFor="email" className="sr-only">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                name="email"
                required
                placeholder="Email Address"
                className="w-full rounded-xl bg-bg-secondary border border-white/10 px-5 py-3.5 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30 transition-colors"
              />
            </div>
            <div>
              <label htmlFor="phone" className="sr-only">
                Phone Number
              </label>
              <input
                type="tel"
                id="phone"
                name="phone"
                placeholder="Phone number for beta texts (optional)"
                autoComplete="tel"
                className="w-full rounded-xl bg-bg-secondary border border-white/10 px-5 py-3.5 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30 transition-colors"
              />
            </div>
            <label className="flex gap-3 rounded-xl border border-white/10 bg-bg-secondary/60 p-4 text-sm leading-relaxed text-text-muted">
              <input
                type="checkbox"
                name="smsOptIn"
                className="mt-1 h-4 w-4 shrink-0 accent-accent"
              />
              <span>
                I agree to receive beta access and product update texts from
                SuppVis. Consent is not required to apply. Message and data
                rates may apply. Reply STOP to opt out.
              </span>
            </label>
            {error && (
              <p className="text-error text-sm text-center" role="alert">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-accent text-bg-primary font-semibold text-lg py-4 hover:bg-accent-hover transition-colors disabled:opacity-60"
            >
              {loading ? "Submitting..." : "Get Early Access"}
            </button>
            <p className="text-text-muted text-xs text-center pt-1">
              No spam, ever. Unsubscribe anytime.
            </p>
          </form>
        )}

        {/* Value props */}
        <div className="mt-12 flex flex-col items-center gap-3 text-[15px] text-text-secondary">
          <span>Free during beta</span>
          <span>Founding pricing locked forever</span>
          <span>Your feedback shapes the product</span>
        </div>
      </div>
    </section>
  );
}
