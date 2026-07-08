"use client";

import { useState, FormEvent, ChangeEvent } from "react";
import { useScrollReveal } from "../hooks/useScrollReveal";

type FormValues = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  smsOptIn: boolean;
};

const initialFormValues: FormValues = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  smsOptIn: false,
};

function isValidEmail(email: string) {
  return /^[^\s@]{1,64}@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/.test(
    email.trim(),
  );
}

function sanitizePhoneInput(phone: string) {
  return phone.replace(/[^\d()+\-\s.]/g, "").slice(0, 40);
}

function RequiredMarker() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute right-4 top-2.5 text-sm font-semibold text-accent"
    >
      *
    </span>
  );
}

export default function WaitlistClose() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState(
    "You’re in. We’ll send beta testing access details soon.",
  );
  const [successSupport, setSuccessSupport] = useState(
    "If you opted into texts, we’ll only text you about beta access and product updates.",
  );
  const [duplicateSubmission, setDuplicateSubmission] = useState(false);
  const [formValues, setFormValues] = useState<FormValues>(initialFormValues);
  const sectionRef = useScrollReveal();
  const hasPhone = Boolean(formValues.phone.trim());
  const isFormReady =
    Boolean(formValues.firstName.trim()) &&
    Boolean(formValues.lastName.trim()) &&
    isValidEmail(formValues.email) &&
    (!hasPhone || formValues.smsOptIn);

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, type, value, checked } = event.currentTarget;
    const nextValue = name === "phone" ? sanitizePhoneInput(value) : value;

    setFormValues((current) => {
      if (name === "phone" && !nextValue.trim()) {
        return {
          ...current,
          phone: nextValue,
          smsOptIn: false,
        };
      }

      return {
        ...current,
        [name]: type === "checkbox" ? checked : nextValue,
      };
    });
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setDuplicateSubmission(false);

    const form = e.currentTarget;
    const data = new FormData(form);
    const firstName = formValues.firstName.trim();
    const lastName = formValues.lastName.trim();
    const email = formValues.email.trim();
    const phone = formValues.phone.trim();

    if (!firstName || !lastName) {
      setError("Enter your first and last name.");
      return;
    }

    if (!isValidEmail(email)) {
      setError("Enter a valid email address.");
      return;
    }

    if (phone && !formValues.smsOptIn) {
      setError("Check the SMS consent box or remove the phone number.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/beta-applications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          phone,
          smsOptIn: formValues.smsOptIn,
          sourcePage: `${window.location.pathname}${window.location.hash || "#waitlist"}`,
          botField: data.get("botField"),
        }),
      });

      const result = await response.json().catch(() => null);
      const fieldErrors = result?.fieldErrors as
        | Record<string, string[] | undefined>
        | undefined;
      const firstFieldError = fieldErrors
        ? Object.values(fieldErrors).flat().find(Boolean)
        : null;

      if (!response.ok || !result?.ok) {
        throw new Error(
          firstFieldError || result?.message || "Please try again in a moment.",
        );
      }

      setSuccessMessage(
        typeof result?.message === "string"
          ? result.message
          : "You’re in. We’ll send beta testing access details soon.",
      );
      setSuccessSupport(
        result?.resubscribed
          ? "You’re back on the SuppVis beta email list. You can unsubscribe again anytime."
          : result?.duplicate
            ? "You do not need to submit again."
            : "If you opted into texts, we’ll only text you about beta access and product updates.",
      );
      setDuplicateSubmission(Boolean(result?.duplicate));
      setSubmitted(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "We couldn't save your application right now. Please try again in a moment.",
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
        {!duplicateSubmission && (
          <p className="text-text-secondary text-lg mb-10">
            Join the beta. Get early access and help shape SuppVis before it
            opens to everyone.
          </p>
        )}

        {submitted ? (
          <div className="animate-pulse-glow rounded-2xl bg-bg-secondary border border-accent/20 p-10">
            <p className="text-text-primary text-xl font-semibold">
              {successMessage}
            </p>
            <p className="mt-3 text-sm text-text-secondary">
              {successSupport}
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
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="relative">
                <label htmlFor="firstName" className="sr-only">
                  First name required
                </label>
                <input
                  type="text"
                  id="firstName"
                  name="firstName"
                  required
                  aria-required="true"
                  value={formValues.firstName}
                  onChange={handleInputChange}
                  autoComplete="given-name"
                  placeholder="First name"
                  maxLength={50}
                  className="w-full rounded-xl bg-bg-secondary border border-white/10 px-5 py-3.5 pr-9 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30 transition-colors"
                />
                <RequiredMarker />
              </div>
              <div className="relative">
                <label htmlFor="lastName" className="sr-only">
                  Last name required
                </label>
                <input
                  type="text"
                  id="lastName"
                  name="lastName"
                  required
                  aria-required="true"
                  value={formValues.lastName}
                  onChange={handleInputChange}
                  autoComplete="family-name"
                  placeholder="Last name"
                  maxLength={50}
                  className="w-full rounded-xl bg-bg-secondary border border-white/10 px-5 py-3.5 pr-9 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30 transition-colors"
                />
                <RequiredMarker />
              </div>
            </div>
            <div className="relative">
              <label htmlFor="email" className="sr-only">
                Email address required
              </label>
              <input
                type="email"
                id="email"
                name="email"
                required
                aria-required="true"
                value={formValues.email}
                onChange={handleInputChange}
                autoComplete="email"
                placeholder="Email Address"
                maxLength={254}
                className="w-full rounded-xl bg-bg-secondary border border-white/10 px-5 py-3.5 pr-9 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30 transition-colors"
              />
              <RequiredMarker />
            </div>
            <div>
              <label htmlFor="phone" className="sr-only">
                Phone number optional
              </label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formValues.phone}
                onChange={handleInputChange}
                placeholder="Phone number (optional)"
                autoComplete="tel"
                inputMode="tel"
                maxLength={40}
                className="w-full rounded-xl bg-bg-secondary border border-white/10 px-5 py-3.5 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30 transition-colors"
              />
            </div>
            <label className="flex gap-3 rounded-xl border border-white/10 bg-bg-secondary/60 p-4 text-sm leading-relaxed text-text-muted">
              <input
                type="checkbox"
                name="smsOptIn"
                checked={formValues.smsOptIn}
                onChange={handleInputChange}
                disabled={!hasPhone}
                className="mt-1 h-4 w-4 shrink-0 accent-accent"
              />
              <span>
                I agree to receive SuppVis text messages about beta access and
                product updates. Reply STOP to opt out. Msg &amp; data rates may
                apply.
              </span>
            </label>
            {error && (
              <p className="text-error text-sm text-center" role="alert">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading || !isFormReady}
              className="w-full rounded-xl bg-accent text-bg-primary font-semibold text-lg py-4 hover:bg-accent-hover transition-colors disabled:opacity-60"
            >
              {loading ? "Submitting..." : "Get early access"}
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
