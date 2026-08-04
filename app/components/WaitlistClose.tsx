"use client";

import { useState, FormEvent } from "react";
import { useScrollReveal } from "../hooks/useScrollReveal";

export default function WaitlistClose() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const sectionRef = useScrollReveal();

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const form = e.currentTarget;
    const data = new FormData(form);

    try {
      await fetch("https://formspree.io/f/placeholder", {
        method: "POST",
        body: data,
        headers: { Accept: "application/json" },
      });
    } catch {
      // Still show success state for now
    }

    setLoading(false);
    setSubmitted(true);
  };

  return (
    <section id="waitlist" className="py-24 md:py-32 px-6">
      <div ref={sectionRef} className="scroll-reveal max-w-[600px] mx-auto text-center">
        <h2 className="font-headline font-extrabold text-3xl sm:text-4xl md:text-5xl text-text-primary mb-6 leading-tight">
          You&rsquo;re already spending on your protocol. Every month you
          don&rsquo;t track is money spent on guesses.
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
