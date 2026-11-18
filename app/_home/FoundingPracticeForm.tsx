"use client";

import { useState, type FormEvent } from "react";
import { CLINIC_DISPENSING_OPTIONS, CLINIC_PRACTICE_TYPES } from "@/app/lib/clinicOptions";

// Field set fixed by spec section 12. Option labels are UI copy catalogued in
// docs/MOCKUP_COPY.md.

const inputClass =
  "w-full rounded-xl bg-bg-primary border border-white/10 px-5 py-3.5 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30 transition-colors text-sm";
const selectClass = `${inputClass} appearance-none pr-11 bg-no-repeat bg-[right_1.1rem_center] bg-[length:14px] bg-[url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%239BAFBF' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")]`;
const labelClass = "block text-xs font-medium text-text-secondary mb-1.5 pl-1";

export default function FoundingPracticeForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [dispensing, setDispensing] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const get = (k: string) => String(fd.get(k) ?? "").trim();

    setLoading(true);
    try {
      const res = await fetch("/api/clinic-waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          practiceName: get("practiceName"),
          roleCredential: get("roleCredential"),
          email: get("email"),
          practiceType: get("practiceType"),
          dispensing: get("dispensing"),
          dispensingOther: get("dispensingOther"),
          sourcePage: `${window.location.pathname}${window.location.hash}`,
          botField: get("botField"),
        }),
      });
      const result = await res.json().catch(() => null);
      if (!res.ok || !result?.ok) {
        const fieldErrors = result?.fieldErrors as Record<string, string[] | undefined> | undefined;
        const first = fieldErrors ? Object.values(fieldErrors).flat().find(Boolean) : null;
        throw new Error(first || result?.message || "Please try again in a moment.");
      }
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Please try again in a moment.");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="rounded-2xl bg-bg-primary border border-accent/25 p-10 text-center" role="status">
        <p className="font-headline font-bold text-xl text-text-primary">Request received.</p>
        <p className="mt-3 text-text-secondary">
          A member of the SuppVis team will reach out to your practice directly.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-left" noValidate={false}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="fp-practice" className={labelClass}>Practice name</label>
          <input id="fp-practice" name="practiceName" required maxLength={120} className={inputClass} autoComplete="organization" />
        </div>
        <div>
          <label htmlFor="fp-role" className={labelClass}>Role and credential</label>
          <input id="fp-role" name="roleCredential" required maxLength={120} placeholder="e.g. ND, practice owner" className={inputClass} />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="fp-email" className={labelClass}>Email</label>
          <input id="fp-email" name="email" type="email" required maxLength={254} className={inputClass} autoComplete="email" />
        </div>
        <div>
          <label htmlFor="fp-type" className={labelClass}>Practice type</label>
          <select id="fp-type" name="practiceType" required defaultValue="" className={selectClass}>
            <option value="" disabled>Select practice type</option>
            {CLINIC_PRACTICE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="fp-dispense" className={labelClass}>
          Do you currently dispense through Fullscript, Wellevate, or other?
        </label>
        <select
          id="fp-dispense"
          name="dispensing"
          required
          value={dispensing}
          onChange={(e) => setDispensing(e.target.value)}
          className={selectClass}
        >
          <option value="" disabled>Select one</option>
          {CLINIC_DISPENSING_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      {dispensing === "Other" && (
        <div>
          <label htmlFor="fp-dispense-other" className={labelClass}>Which dispensary?</label>
          <input id="fp-dispense-other" name="dispensingOther" maxLength={120} className={inputClass} />
        </div>
      )}

      {/* Honeypot, hidden from people */}
      <div className="absolute -left-[9999px] w-px h-px overflow-hidden" aria-hidden="true">
        <label htmlFor="fp-bot">Company website</label>
        <input id="fp-bot" name="botField" tabIndex={-1} autoComplete="off" />
      </div>

      {error && (
        <p className="text-sm text-error pl-1" role="alert">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-accent text-bg-primary font-semibold text-base py-4 hover:bg-accent-hover transition-colors disabled:opacity-60"
      >
        {loading ? "Sending..." : "Join the founding practices"}
      </button>
    </form>
  );
}
