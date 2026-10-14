"use client";

import { useState } from "react";

const endpoint = "/api/admin/catalog/serving-size-review/schema/ingest-exclusion?confirmation=serving-review-ingest-exclusion-2026-10-14";

export default function ApplyServingExclusion() {
  const [result, setResult] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function apply() {
    setBusy(true);
    setResult("");
    try {
      const response = await fetch(endpoint, { cache: "no-store", credentials: "same-origin" });
      const body = await response.json();
      setResult(JSON.stringify(body));
    } catch {
      setResult(JSON.stringify({ error: "Unable to apply migration." }));
    } finally {
      setBusy(false);
    }
  }

  return <section className="rounded-[8px] border border-white/10 bg-[#0D1117] p-6">
    <h1 className="font-headline text-3xl font-extrabold">Serving exclusion schema</h1>
    <p className="mt-3 text-sm text-text-secondary">One-time guarded production migration.</p>
    <button type="button" disabled={busy || Boolean(result)} onClick={apply}
      className="mt-6 rounded-full bg-accent px-5 py-3 text-sm font-bold text-[#03100E] disabled:opacity-40">
      {busy ? "Applying…" : "Apply migration"}
    </button>
    {result ? <pre className="mt-5 overflow-x-auto whitespace-pre-wrap rounded border border-white/10 bg-[#080D12] p-4 text-xs">{result}</pre> : null}
  </section>;
}
