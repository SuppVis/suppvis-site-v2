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
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export default function WaitlistClose() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
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

    setFormValues((current) => {
      if (name === "phone" && !value.trim()) {
        return {
          ...current,
          phone: value,
          smsOptIn: false,
        };
      }

      return {
        ...current,
        [name]: type === "checkbox" ? checked : value,
      };
    });
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

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
        <p className="text-text-secondary text-lg mb-10">
          Join the beta. Get founding member access and a direct line to the team
          building it.
        </p>

        {submitted ? (
          <div className="animate-pulse-glow rounded-2xl bg-bg-secondary border border-accent/20 p-10">
            <p className="text-text-primary text-xl font-semibold">
              You&rsquo;re in. We&rsquo;ll send beta testing access details soon.
            </p>
            <p className="mt-3 text-sm text-text-secondary">
              If you opted into texts, we&rsquo;ll only text you about beta
              access and product updates.
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
              <div>
                <label htmlFor="firstName" className="sr-only">
                  First name
                </label>
                <input
                  type="text"
                  id="firstName"
                  name="firstName"
                  required
                  value={formValues.firstName}
                  onChange={handleInputChange}
                  autoComplete="given-name"
                  placeholder="First name"
                  className="w-full rounded-xl bg-bg-secondary border border-white/10 px-5 py-3.5 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30 transition-colors"
                />
              </div>
              <div>
                <label htmlFor="lastName" className="sr-only">
                  Last name
                </label>
                <input
                  type="text"
                  id="lastName"
                  name="lastName"
                  required
                  value={formValues.lastName}
                  onChange={handleInputChange}
                  autoComplete="family-name"
                  placeholder="Last name"
                  className="w-full rounded-xl bg-bg-secondary border border-white/10 px-5 py-3.5 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30 transition-colors"
                />
              </div>
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
                value={formValues.email}
                onChange={handleInputChange}
                autoComplete="email"
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
                value={formValues.phone}
                onChange={handleInputChange}
                placeholder="Phone number for beta texts (optional)"
                autoComplete="tel"
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
                I agree to receive beta access and product update texts from
                SuppVis. Message and data rates may apply. Reply STOP to opt
                out.
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
