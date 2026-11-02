"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type BatchResponse = {
  manifest: {
    manifestId: string;
    description: string;
    createdAt: string;
    backupSnapshot: string;
    cohortCount: number;
    operationCount: number;
    fileSha256: string;
  };
  state: {
    schemaReady: boolean;
    alreadyApplied: boolean;
    application: null | {
      appliedAt: string;
      appliedBy: string;
      operationCount: number;
    };
    preflight: null | {
      operationCount: number;
      readyCount: number;
      conflictCount: number;
      conflicts: unknown[];
    };
  };
};

function errorMessage(value: unknown) {
  if (value && typeof value === "object" && "error" in value) {
    const error = (value as { error?: { message?: unknown } }).error;
    if (typeof error?.message === "string") return error.message;
  }
  return "The decision batch request failed.";
}

export default function DecisionBatchApplyClient({ manifestId }: { manifestId: string }) {
  const endpoint = `/api/admin/catalog/serving-size-review/decision-batches/${encodeURIComponent(manifestId)}`;
  const [data, setData] = useState<BatchResponse | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      const value = await response.json() as BatchResponse | unknown;
      if (!response.ok) throw new Error(errorMessage(value));
      setData(value as BatchResponse);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load the decision batch.");
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => { void load(); }, [load]);

  const ready = useMemo(() => {
    const preflight = data?.state.preflight;
    return Boolean(
      data?.state.schemaReady
      && !data.state.alreadyApplied
      && preflight
      && preflight.conflictCount === 0
      && preflight.readyCount === data.manifest.operationCount
      && preflight.operationCount === data.manifest.operationCount,
    );
  }, [data]);

  async function applyBatch() {
    if (!data || confirmation !== data.manifest.manifestId || !ready) return;
    setApplying(true);
    setError(null);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmation: `apply:${data.manifest.manifestId}:${data.manifest.fileSha256}`,
          manifestSha256: data.manifest.fileSha256,
          backupSnapshot: data.manifest.backupSnapshot,
        }),
      });
      const value = await response.json() as unknown;
      if (!response.ok) throw new Error(errorMessage(value));
      await load();
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : "Unable to apply the decision batch.");
    } finally {
      setApplying(false);
    }
  }

  if (loading && !data) return <p className="text-text-secondary">Loading guarded batch…</p>;

  return <section className="space-y-6">
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">Guarded decision batch</p>
      <h1 className="mt-2 font-headline text-3xl font-extrabold">{manifestId}</h1>
      {data ? <p className="mt-3 max-w-3xl text-text-secondary">{data.manifest.description}</p> : null}
    </div>

    {error ? <div role="alert" className="rounded-[8px] border border-red-400/40 bg-red-950/30 p-4 text-red-200">{error}</div> : null}

    {data ? <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-[8px] border border-white/10 bg-[#0D1117] p-5">
        <h2 className="text-lg font-bold">Frozen manifest</h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div><dt className="text-text-secondary">Operations</dt><dd className="font-bold">{data.manifest.operationCount}</dd></div>
          <div><dt className="text-text-secondary">Cohorts</dt><dd className="font-bold">{data.manifest.cohortCount}</dd></div>
          <div><dt className="text-text-secondary">Backup snapshot</dt><dd className="break-all font-mono text-xs">{data.manifest.backupSnapshot}</dd></div>
          <div><dt className="text-text-secondary">SHA-256</dt><dd className="break-all font-mono text-xs">{data.manifest.fileSha256}</dd></div>
        </dl>
      </div>
      <div className="rounded-[8px] border border-white/10 bg-[#0D1117] p-5">
        <h2 className="text-lg font-bold">Production preflight</h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div><dt className="text-text-secondary">Schema</dt><dd className="font-bold">{data.state.schemaReady ? "Ready" : "Unavailable"}</dd></div>
          <div><dt className="text-text-secondary">Ready</dt><dd className="font-bold">{data.state.preflight?.readyCount ?? 0} / {data.manifest.operationCount}</dd></div>
          <div><dt className="text-text-secondary">Conflicts</dt><dd className="font-bold">{data.state.preflight?.conflictCount ?? 0}</dd></div>
          <div><dt className="text-text-secondary">Status</dt><dd className="font-bold">{data.state.alreadyApplied ? "Applied" : ready ? "Ready to apply" : "Blocked"}</dd></div>
        </dl>
      </div>
    </div> : null}

    {data?.state.alreadyApplied ? <div className="rounded-[8px] border border-emerald-400/40 bg-emerald-950/30 p-5 text-emerald-100">
      Applied {data.state.application?.operationCount ?? data.manifest.operationCount} operations
      {data.state.application?.appliedAt ? ` at ${data.state.application.appliedAt}` : ""}.
    </div> : data ? <div className="rounded-[8px] border border-amber-400/30 bg-amber-950/20 p-5">
      <label className="block text-sm font-bold" htmlFor="batch-confirmation">Type the exact manifest ID to unlock the apply button</label>
      <input
        id="batch-confirmation"
        className="mt-3 w-full rounded-[6px] border border-white/15 bg-[#080C12] px-4 py-3 font-mono text-sm text-text-primary"
        value={confirmation}
        onChange={(event) => setConfirmation(event.target.value)}
        autoComplete="off"
      />
      <button
        type="button"
        className="mt-4 rounded-full bg-accent px-5 py-3 text-sm font-extrabold text-[#03100E] disabled:cursor-not-allowed disabled:opacity-40"
        disabled={!ready || confirmation !== data.manifest.manifestId || applying}
        onClick={() => void applyBatch()}
      >{applying ? "Applying…" : `Apply ${data.manifest.operationCount} decisions`}</button>
    </div> : null}
  </section>;
}
