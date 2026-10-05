"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Group1LabelPreview } from "./Group1LabelPreview";
import { labelPdfBytes } from "./group1-label-pdf";
import {
  getServingSizeReviewList,
  getServingSizeReviewTask,
  saveServingSizeReviewDecision,
  type DsldIngredientQuantity,
  type ReviewedServingContext,
  type ServingSizeIngredientRow,
  type ServingSizeQuantityOverride,
  type ServingSizeReviewTask,
  type ServingSizeReviewTaskDetail,
  type ServingSizeWarningSeverity,
} from "./serving-size-review-api";

const inputClass = "w-full rounded border border-white/15 bg-[#080D12] px-3 py-2 text-sm text-text-primary outline-none focus:border-accent";
const severityStyle: Record<ServingSizeWarningSeverity, string> = {
  high: "border-red-400/40 bg-red-400/10 text-red-200",
  medium: "border-amber-400/40 bg-amber-400/10 text-amber-100",
  low: "border-sky-400/40 bg-sky-400/10 text-sky-100",
  none: "border-white/15 bg-white/5 text-text-secondary",
};

type EditableContext = {
  contextKey: string;
  householdQuantityMin: string;
  householdQuantityMax: string;
  householdUnit: string;
  metricQuantityMin: string;
  metricQuantityMax: string;
  metricUnit: string;
  contextLabel: string;
  preparationContext: string;
  labelText: string;
};

type Projection = {
  row: ServingSizeIngredientRow;
  status: "selected" | "excluded" | "ambiguous" | "no_quantity";
  selected: DsldIngredientQuantity | null;
  candidates: DsldIngredientQuantity[];
};

function editableContext(context: ReviewedServingContext): EditableContext {
  return {
    contextKey: context.contextKey,
    householdQuantityMin: context.householdQuantityMin == null ? "" : String(context.householdQuantityMin),
    householdQuantityMax: context.householdQuantityMax == null ? "" : String(context.householdQuantityMax),
    householdUnit: context.householdUnit ?? "",
    metricQuantityMin: context.metricQuantityMin == null ? "" : String(context.metricQuantityMin),
    metricQuantityMax: context.metricQuantityMax == null ? "" : String(context.metricQuantityMax),
    metricUnit: context.metricUnit ?? "",
    contextLabel: context.contextLabel ?? "",
    preparationContext: context.preparationContext ?? "",
    labelText: context.labelText ?? "",
  };
}

function optionalNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error("Serving quantities must be greater than zero.");
  return parsed;
}

function reviewedContext(context: EditableContext, selectedOrder: number): ReviewedServingContext {
  return {
    contextKey: context.contextKey.trim(),
    sourceServingOrders: [selectedOrder],
    householdQuantityMin: optionalNumber(context.householdQuantityMin),
    householdQuantityMax: optionalNumber(context.householdQuantityMax),
    householdUnit: context.householdUnit.trim() || null,
    metricQuantityMin: optionalNumber(context.metricQuantityMin),
    metricQuantityMax: optionalNumber(context.metricQuantityMax),
    metricUnit: context.metricUnit.trim() || null,
    contextLabel: context.contextLabel.trim() || null,
    preparationContext: context.preparationContext.trim() || null,
    labelText: context.labelText.trim() || null,
  };
}

function isActionable(task: ServingSizeReviewTask) {
  return task.status === "pending";
}

function pendingSpan(tasks: ServingSizeReviewTask[]) {
  const indexes = tasks.map((task, index) => isActionable(task) ? index : -1).filter((index) => index >= 0);
  return indexes.length ? { first: indexes[0], last: indexes[indexes.length - 1], count: indexes.length } : null;
}

function nextTask(tasks: ServingSizeReviewTask[], afterId: string, first: number, last: number) {
  const current = tasks.findIndex((task) => task.id === afterId);
  for (let index = current < first ? first : current + 1; index <= last; index += 1) {
    if (isActionable(tasks[index])) return tasks[index];
  }
  return undefined;
}

function formatServing(minimum: number | null, maximum: number | null, unit: string | null) {
  if (minimum == null) return "Amount not recorded";
  const amount = maximum != null && maximum !== minimum ? `${minimum}–${maximum}` : String(minimum);
  return `${amount} ${unit ?? ""}`.trim();
}

function formatQuantity(quantity: DsldIngredientQuantity) {
  const operator = quantity.operator && quantity.operator !== "=" ? `${quantity.operator} ` : "";
  const amount = quantity.quantity == null ? "amount not recorded" : `${operator}${quantity.quantity}`;
  return `${amount} ${quantity.unit ?? ""}`.trim();
}

function humanize(value: string) {
  return value.replaceAll("_", " ");
}

function projections(
  rows: ServingSizeIngredientRow[],
  selectedOrder: number | null,
  overrides: Map<string, number | null>,
): Projection[] {
  if (selectedOrder == null) return [];
  return rows.map((row) => {
    if (overrides.has(row.rowPath)) {
      const chosen = overrides.get(row.rowPath);
      return chosen == null
        ? { row, status: "excluded", selected: null, candidates: row.quantities }
        : { row, status: "selected", selected: row.quantities.find((quantity) =>
          quantity.sourceQuantityIndex === chosen) ?? null, candidates: row.quantities };
    }
    const exact = row.quantities.filter((quantity) => quantity.servingSizeOrder === selectedOrder);
    if (exact.length === 1) return { row, status: "selected", selected: exact[0], candidates: exact };
    if (exact.length > 1) return { row, status: "ambiguous", selected: null, candidates: exact };
    if (row.quantities.length === 0) return { row, status: "no_quantity", selected: null, candidates: [] };
    const unlinked = row.quantities.filter((quantity) => quantity.servingSizeOrder == null);
    if (unlinked.length === 1 && row.quantities.length === 1) {
      return { row, status: "selected", selected: unlinked[0], candidates: unlinked };
    }
    if (unlinked.length) return { row, status: "ambiguous", selected: null, candidates: unlinked };
    return { row, status: "excluded", selected: null, candidates: row.quantities };
  });
}

export default function CatalogServingSizeReview({ mode = "selector" }: { mode?: "selector" | "queue" }) {
  const readOnlyPreview = process.env.NEXT_PUBLIC_SERVING_SIZE_REVIEW_READONLY === "1";
  const router = useRouter();
  const productNameRef = useRef<HTMLHeadingElement>(null);
  const [tasks, setTasks] = useState<ServingSizeReviewTask[]>([]);
  const [batchKey, setBatchKey] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [detail, setDetail] = useState<ServingSizeReviewTaskDetail | null>(null);
  const [range, setRange] = useState({ first: 0, last: -1 });
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<number | null>(null);
  const [context, setContext] = useState<EditableContext | null>(null);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [escalated, setEscalated] = useState(false);
  const [quantityOverrides, setQuantityOverrides] = useState<Map<string, number | null>>(new Map());
  const [reviewerNote, setReviewerNote] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const span = pendingSpan(tasks);
  const pending = tasks.filter(isActionable).length;
  const escalations = tasks.filter((task) => task.status === "escalated").length;
  const decided = tasks.length - pending - escalations;
  const currentPosition = tasks.findIndex((task) => task.id === selectedTaskId) + 1;
  const next = useMemo(() => nextTask(tasks, selectedTaskId, range.first, range.last),
    [tasks, selectedTaskId, range]);
  const severityCounts = useMemo(() => tasks.reduce((counts, task) => {
    counts[task.warningSeverity] += 1;
    return counts;
  }, { high: 0, medium: 0, low: 0, none: 0 }), [tasks]);
  const projected = useMemo(() => projections(detail?.sourceIngredientRows ?? [], selectedOrder,
    quantityOverrides), [detail, selectedOrder, quantityOverrides]);
  const projectionCounts = useMemo(() => projected.reduce((counts, row) => {
    counts[row.status] += 1;
    return counts;
  }, { selected: 0, excluded: 0, ambiguous: 0, no_quantity: 0 }), [projected]);

  useEffect(() => {
    let cancelled = false;
    getServingSizeReviewList().then((result) => {
      if (cancelled) return;
      setTasks(result.tasks);
      setBatchKey(result.batchKey);
      const suggested = pendingSpan(result.tasks);
      const stored = window.sessionStorage.getItem(`serving-size-review-range:${result.batchKey}`);
      let selectedRange = suggested ? { first: suggested.first, last: suggested.last }
        : { first: 0, last: Math.max(0, result.tasks.length - 1) };
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as { first: number; last: number };
          if (Number.isSafeInteger(parsed.first) && Number.isSafeInteger(parsed.last)
            && parsed.first >= 0 && parsed.first <= parsed.last && parsed.last < result.tasks.length) {
            selectedRange = parsed;
          }
        } catch { /* Use the pending span. */ }
      }
      setRange(selectedRange);
      if (mode === "selector") {
        setRangeStart(suggested ? String(suggested.first + 1) : "");
        setRangeEnd(suggested ? String(suggested.last + 1) : "");
      } else {
        setRangeStart(String(selectedRange.first + 1));
        setRangeEnd(String(selectedRange.last + 1));
        const openKey = `serving-size-review-open-task:${result.batchKey}`;
        const requestedTaskId = window.sessionStorage.getItem(openKey);
        window.sessionStorage.removeItem(openKey);
        const requested = requestedTaskId
          ? result.tasks.find((task) => task.id === requestedTaskId) : undefined;
        setSelectedTaskId(requested?.id
          ?? nextTask(result.tasks, "", selectedRange.first, selectedRange.last)?.id ?? "");
      }
    }).catch((reason) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : "Unable to load serving-size reviews.");
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [mode]);

  useEffect(() => {
    if (mode !== "queue" || !selectedTaskId) { setDetail(null); return; }
    let cancelled = false;
    setDetail(null);
    setError("");
    getServingSizeReviewTask(selectedTaskId).then((task) => {
      if (!cancelled) setDetail(task);
    }).catch((reason) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : "Unable to load this label.");
    });
    return () => { cancelled = true; };
  }, [mode, selectedTaskId]);

  useEffect(() => {
    if (!detail) return;
    const order = detail.selectedServingOrder ?? detail.policySuggestedServingOrder;
    const sourceContext = order == null ? null : detail.sourceContexts.find((candidate) =>
      candidate.sourceServingOrders.includes(order)) ?? null;
    const effectiveContext = detail.reviewedServingContexts?.[0] ?? sourceContext;
    setSelectedOrder(order);
    setContext(effectiveContext ? editableContext(effectiveContext) : null);
    setCorrectionOpen(detail.status === "canonical_corrected");
    setEscalated(false);
    setQuantityOverrides(new Map((detail.quantityOverrides ?? [])
      .map((override) => [override.rowPath, override.selectedQuantityIndex])));
    setReviewerNote("");
    setNoteOpen(false);
    productNameRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
  }, [detail]);

  useEffect(() => {
    if (mode !== "queue" || !next) return;
    void labelPdfBytes(next.dsldLabelId).catch(() => {});
  }, [mode, next]);

  function selectServing(order: number) {
    if (!detail) return;
    const source = detail.sourceContexts.find((candidate) => candidate.sourceServingOrders.includes(order));
    setSelectedOrder(order);
    setContext(source ? editableContext(source) : null);
    setQuantityOverrides(new Map());
    setEscalated(false);
  }

  function updateContext(update: Partial<EditableContext>) {
    setContext((current) => current ? { ...current, ...update } : current);
  }

  function toggleCorrection() {
    if (!detail || selectedOrder == null) return;
    if (correctionOpen) {
      const source = detail.sourceContexts.find((candidate) =>
        candidate.sourceServingOrders.includes(selectedOrder));
      setContext(source ? editableContext(source) : null);
      setReviewerNote("");
    }
    setCorrectionOpen((open) => !open);
  }

  function updateOverride(rowPath: string, value: string) {
    setQuantityOverrides((current) => {
      const nextMap = new Map(current);
      if (!value) nextMap.delete(rowPath);
      else nextMap.set(rowPath, value === "exclude" ? null : Number(value));
      return nextMap;
    });
  }

  function applyRange() {
    if (!span) return;
    const first = Number(rangeStart);
    const last = Number(rangeEnd);
    if (!Number.isSafeInteger(first) || !Number.isSafeInteger(last)
      || first < span.first + 1 || last > span.last + 1 || first > last) {
      setError(`Choose a range from ${span.first + 1} to ${span.last + 1}.`);
      return;
    }
    const selected = { first: first - 1, last: last - 1 };
    window.sessionStorage.setItem(`serving-size-review-range:${batchKey}`, JSON.stringify(selected));
    router.push("/admin/catalog/serving-size-review");
  }

  async function save() {
    if (!detail) return;
    if (!escalated && (selectedOrder == null || !context)) {
      setError("Choose the one serving size the app should use.");
      return;
    }
    if (!escalated && projectionCounts.ambiguous > 0) {
      setError("Resolve every highlighted ingredient quantity before saving.");
      return;
    }
    if ((escalated || correctionOpen) && !reviewerNote.trim()) {
      setError("Add a reviewer note explaining the escalation or correction.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const overrides: ServingSizeQuantityOverride[] = [...quantityOverrides.entries()]
        .map(([rowPath, selectedQuantityIndex]) => ({ rowPath, selectedQuantityIndex }));
      const body = escalated ? {
        expectedRevision: detail.revision,
        outcome: "escalated",
        reviewedServingContexts: null,
        selectedServingOrder: null,
        quantityOverrides: null,
        reviewerNote: reviewerNote.trim(),
      } : {
        expectedRevision: detail.revision,
        outcome: correctionOpen ? "canonical_corrected" : "canonical_selected",
        reviewedServingContexts: [reviewedContext(context!, selectedOrder!)],
        selectedServingOrder: selectedOrder,
        quantityOverrides: overrides,
        reviewerNote: reviewerNote.trim() || null,
      };
      if (readOnlyPreview) {
        setSelectedTaskId(next?.id ?? "");
        setNotice("Preview only — nothing was recorded. Moved to the next label.");
        return;
      }
      const updated = await saveServingSizeReviewDecision(detail.id, body);
      const nextTasks = tasks.map((task) => task.id === updated.id ? updated : task);
      setTasks(nextTasks);
      setSelectedTaskId(nextTask(nextTasks, updated.id, range.first, range.last)?.id ?? "");
      setNotice("Canonical serving saved. Moved to the next label.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save this decision.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="rounded border border-white/10 bg-[#0D1117] p-6 text-sm">Loading serving-size reviews…</p>;

  if (mode === "selector") return <section aria-label="Serving size review" className="space-y-4">
    <div className="rounded-[8px] border border-white/10 bg-[#0D1117] p-5">
      <h2 className="font-headline text-2xl font-bold">Canonical serving review</h2>
      <p className="mt-2 max-w-4xl text-sm text-text-secondary">
        Choose one serving size per label and verify the ingredient quantities that will remain in the curated catalog.
      </p>
      <p className="mt-3 text-sm text-text-primary">{pending} pending · {decided} decided · {escalations} escalated · {tasks.length} total</p>
      <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
        {(["high", "medium", "low", "none"] as const).map((severity) => <span key={severity}
          className={`rounded-full border px-3 py-1 ${severityStyle[severity]}`}>
          {severity === "none" ? "No warning" : `${severity[0].toUpperCase()}${severity.slice(1)}`} · {severityCounts[severity]}
        </span>)}
      </div>
      <p className="mt-2 text-xs text-text-muted">Queue {batchKey}. High-severity extraction warnings appear first, followed by medium, low, and unflagged labels.</p>
      {readOnlyPreview ? <p className="mt-3 rounded border border-sky-400/35 bg-sky-400/10 p-3 text-sm text-sky-200">
        Read-only local preview: controls advance through the queue, but nothing is saved.
      </p> : null}
      <div className="mt-4 flex flex-wrap items-end gap-3 rounded border border-white/10 bg-[#080D12] p-3">
        <label className="text-xs font-semibold">Start at label<input className={`${inputClass} mt-1 w-28`} type="number"
          value={rangeStart} min={span ? span.first + 1 : undefined} max={span ? span.last + 1 : undefined}
          onChange={(event) => setRangeStart(event.target.value)} /></label>
        <label className="text-xs font-semibold">End at label<input className={`${inputClass} mt-1 w-28`} type="number"
          value={rangeEnd} min={span ? span.first + 1 : undefined} max={span ? span.last + 1 : undefined}
          onChange={(event) => setRangeEnd(event.target.value)} /></label>
        <button type="button" disabled={!span} onClick={applyRange}
          className="rounded-full border border-accent px-4 py-2 text-sm font-semibold text-accent disabled:opacity-40">Start review range</button>
        <p className="text-xs text-text-muted">Use non-overlapping ranges for multiple admins. Completed labels are skipped.</p>
      </div>
      {escalations ? <details className="mt-3 rounded border border-amber-400/25 p-3 text-sm">
        <summary className="cursor-pointer font-semibold text-amber-200">Escalations needing another admin ({escalations})</summary>
        <p className="mt-2 text-xs text-text-secondary">The admin who escalated a label cannot resolve their own escalation.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {tasks.filter((task) => task.status === "escalated").map((task) => <button key={task.id} type="button"
            onClick={() => {
              window.sessionStorage.setItem(`serving-size-review-open-task:${batchKey}`, task.id);
              router.push("/admin/catalog/serving-size-review");
            }} className="rounded border border-white/15 px-3 py-2 text-left text-xs hover:border-accent">
            #{task.queueOrdinal} · {task.labelName}
          </button>)}
        </div>
      </details> : null}
    </div>
    {error ? <p role="alert" className="rounded border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">{error}</p> : null}
  </section>;

  return <section aria-label="Canonical serving review" className="space-y-4">
    <Link href="/admin/catalog?view=serving-size-review"
      className="inline-flex rounded-full border border-white/20 px-4 py-2 text-sm font-semibold hover:border-accent hover:text-accent">
      ← Back to serving-size queue
    </Link>
    {error ? <p role="alert" className="rounded border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">{error}</p> : null}
    {notice ? <p role="status" className="rounded border border-accent/40 bg-accent/10 p-3 text-sm text-accent">{notice}</p> : null}
    <div className="rounded-[8px] border border-white/10 bg-[#0D1117] p-4">
      {readOnlyPreview ? <p className="mb-4 rounded border border-sky-400/35 bg-sky-400/10 p-3 text-sm text-sky-200">
        Read-only local preview — controls advance through the queue, but no decision is recorded.
      </p> : null}
      {selectedTaskId ? <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-accent">
        Label {currentPosition} of {tasks.length} · assigned range {range.first + 1}–{range.last + 1}
      </p> : null}
      {!detail || detail.id !== selectedTaskId ? <p className="text-sm text-text-secondary">
        {selectedTaskId ? "Loading the next label…" : "No pending labels remain in this range."}
      </p> : <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h3 ref={productNameRef} className="scroll-mt-4 font-headline text-xl font-bold">{detail.labelName}</h3>
            <p className="text-sm text-text-secondary">{detail.brandName} · DSLD {detail.dsldLabelId}{detail.offMarket ? " · off market" : ""}</p></div>
          <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase ${severityStyle[detail.warningSeverity]}`}>
            {detail.warningSeverity === "none" ? "No extraction warning" : `${detail.warningSeverity} warning`}
          </span>
        </div>

        <div className="grid items-start gap-4 md:grid-cols-[minmax(0,3fr)_minmax(360px,2fr)]">
          <div className="min-w-0">
            <div className="mb-2 flex items-center justify-between gap-2"><h4 className="font-semibold">Original label</h4>
              <a href={detail.labelPdfUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-accent underline">Open label PDF</a></div>
            <Group1LabelPreview key={detail.id} labelId={detail.dsldLabelId}
              sourceName="Serving Size" suggestedFieldName="Serving Size" />
          </div>

          <div className="space-y-4">
            <section className={`rounded border p-3 ${severityStyle[detail.warningSeverity]}`}>
              <h4 className="font-semibold">Why this label needs review</h4>
              <ul className="mt-2 space-y-1 text-xs">
                {detail.reviewReasonCodes.map((reason) => <li key={reason}>• {humanize(reason)}</li>)}
              </ul>
              {detail.prescreenFlags.length ? <details className="mt-3 text-xs"><summary className="cursor-pointer font-semibold">
                Extraction evidence ({detail.prescreenFlags.length})</summary>
                <div className="mt-2 space-y-2">{detail.prescreenFlags.map((flag, index) => <div key={`${flag.code}-${index}`}
                  className="rounded border border-current/20 bg-black/10 p-2"><p className="font-semibold">{humanize(flag.code)}</p>
                  <p className="mt-1 opacity-80">{flag.summary}</p></div>)}</div>
              </details> : null}
            </section>

            <fieldset className="space-y-2">
              <legend className="font-semibold">1. Choose the one serving size SuppVis should use</legend>
              <p className="text-xs text-text-secondary">Unused variants stay in source history but will not populate the curated catalog.</p>
              {detail.sourceServingSizes.map((serving) => <label key={serving.order}
                className={`block cursor-pointer rounded border p-3 ${selectedOrder === serving.order
                  ? "border-accent bg-accent/10" : "border-white/15 bg-[#080D12] hover:border-accent/50"}`}>
                <div className="flex items-start gap-3"><input type="radio" name="canonical-serving" className="mt-1 accent-emerald-400"
                  checked={selectedOrder === serving.order} onChange={() => selectServing(serving.order)} />
                  <span className="min-w-0"><span className="flex flex-wrap items-center gap-2 font-semibold">
                    {formatServing(serving.minQuantity, serving.maxQuantity, serving.unit)}
                    {detail.policySuggestedServingOrder === serving.order ? <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] uppercase text-accent">precedence suggestion</span> : null}
                  </span><span className="mt-1 block text-sm text-text-secondary">{serving.notes?.trim() || "No additional serving description"}</span>
                    <span className="mt-1 block text-xs text-text-muted">DSLD serving order {serving.order}</span></span></div>
              </label>)}
            </fieldset>

            {selectedOrder != null && context ? <section className="rounded border border-accent/25 bg-accent/5 p-3">
              <div className="flex items-start justify-between gap-3"><div><h4 className="font-semibold">2. Verify the selected serving</h4>
                <p className="mt-1 text-xs text-text-secondary">Correct only the serving that will enter the catalog.</p></div>
                <button type="button" onClick={toggleCorrection} className="shrink-0 text-xs font-semibold text-accent underline">
                  {correctionOpen ? "Use extracted values" : "Correct selected serving"}
                </button></div>
              {!correctionOpen ? <p className="mt-3 rounded border border-white/10 bg-[#080D12] p-3 text-sm">
                {formatServing(detail.sourceServingSizes.find((serving) => serving.order === selectedOrder)?.minQuantity ?? null,
                  detail.sourceServingSizes.find((serving) => serving.order === selectedOrder)?.maxQuantity ?? null,
                  detail.sourceServingSizes.find((serving) => serving.order === selectedOrder)?.unit ?? null)}
                {context.labelText ? ` · ${context.labelText}` : ""}
              </p> : <div className="mt-3 space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <label className="text-xs">Household amount<input className={`${inputClass} mt-1`} type="number" min="0" step="any"
                    value={context.householdQuantityMin} onChange={(event) => updateContext({ householdQuantityMin: event.target.value,
                      householdQuantityMax: event.target.value })} /></label>
                  <label className="text-xs">Household unit<input className={`${inputClass} mt-1`} value={context.householdUnit}
                    onChange={(event) => updateContext({ householdUnit: event.target.value })} /></label>
                  <label className="text-xs">Printed description<input className={`${inputClass} mt-1`} value={context.labelText}
                    onChange={(event) => updateContext({ labelText: event.target.value })} /></label>
                  <label className="text-xs">Metric amount<input className={`${inputClass} mt-1`} type="number" min="0" step="any"
                    value={context.metricQuantityMin} onChange={(event) => updateContext({ metricQuantityMin: event.target.value,
                      metricQuantityMax: event.target.value })} /></label>
                  <label className="text-xs">Metric unit<input className={`${inputClass} mt-1`} value={context.metricUnit}
                    onChange={(event) => updateContext({ metricUnit: event.target.value })} /></label>
                  <label className="text-xs">Context label<input className={`${inputClass} mt-1`} value={context.contextLabel}
                    onChange={(event) => updateContext({ contextLabel: event.target.value })} /></label>
                </div>
              </div>}
            </section> : null}

            {selectedOrder != null ? <section className="rounded border border-white/10 p-3">
              <h4 className="font-semibold">3. Verify the resulting ingredient quantities</h4>
              <p className="mt-1 text-xs text-text-secondary">SuppVis automatically keeps quantities tied to serving order {selectedOrder} and excludes quantities tied only to other servings.</p>
              <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
                <div className="rounded bg-accent/10 p-2"><strong className="block text-lg text-accent">{projectionCounts.selected}</strong>kept</div>
                <div className="rounded bg-white/5 p-2"><strong className="block text-lg">{projectionCounts.excluded}</strong>excluded</div>
                <div className={`rounded p-2 ${projectionCounts.ambiguous ? "bg-red-400/10 text-red-200" : "bg-white/5"}`}><strong className="block text-lg">{projectionCounts.ambiguous}</strong>needs choice</div>
                <div className="rounded bg-white/5 p-2"><strong className="block text-lg">{projectionCounts.no_quantity}</strong>structural rows</div>
              </div>
              {projected.filter((projection) => projection.status === "ambiguous").map((projection) => <div key={projection.row.rowPath}
                className="mt-3 rounded border border-red-400/35 bg-red-400/5 p-3">
                <p className="text-sm font-semibold">{projection.row.name || "Unnamed row"}</p>
                <p className="text-xs text-text-secondary">DSLD contains multiple possible values for the chosen serving.</p>
                <select className={`${inputClass} mt-2`} value={quantityOverrides.has(projection.row.rowPath)
                  ? String(quantityOverrides.get(projection.row.rowPath) ?? "exclude") : ""}
                  onChange={(event) => updateOverride(projection.row.rowPath, event.target.value)}>
                  <option value="">Choose a value…</option>
                  {projection.candidates.map((quantity) => <option key={quantity.sourceQuantityIndex}
                    value={quantity.sourceQuantityIndex}>{formatQuantity(quantity)}</option>)}
                  <option value="exclude">Exclude this row</option>
                </select>
              </div>)}
              {detail.repeatedIngredientNameGroups.length ? <details className="mt-3 rounded border border-amber-400/25 p-3 text-xs">
                <summary className="cursor-pointer font-semibold text-amber-100">Repeated printed ingredient names ({detail.repeatedIngredientNameGroups.length})</summary>
                <p className="mt-2 text-text-secondary">Rows tied only to another serving are excluded automatically. Repeated rows that survive the chosen serving remain visible for duplicate review.</p>
                <ul className="mt-2 space-y-1">{detail.repeatedIngredientNameGroups.slice(0, 30).map((group) =>
                  <li key={group.normalizedName}>• {group.printedNames.join(" / ")} — {group.rowPaths.length} rows</li>)}</ul>
              </details> : null}
              <details className="mt-3 text-xs"><summary className="cursor-pointer font-semibold">Preview projected rows ({projected.length})</summary>
                <div className="mt-2 max-h-80 space-y-1 overflow-y-auto">{projected.map((projection) => <div key={projection.row.rowPath}
                  className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded bg-[#080D12] p-2">
                  <span><span className="font-semibold">{projection.row.name || "Unnamed row"}</span>
                    {projection.row.ancestorNames.length ? <span className="block text-text-muted">under {projection.row.ancestorNames.join(" › ")}</span> : null}</span>
                  <span className={projection.status === "selected" ? "text-accent" : projection.status === "ambiguous" ? "text-red-300" : "text-text-muted"}>
                    {projection.selected ? formatQuantity(projection.selected) : humanize(projection.status)}</span>
                </div>)}</div>
              </details>
            </section> : null}

            <label className="flex cursor-pointer items-start gap-3 rounded border border-white/15 bg-[#080D12] p-3 text-sm">
              <input type="checkbox" className="mt-1 accent-amber-400" checked={escalated}
                onChange={(event) => setEscalated(event.target.checked)} />
              <span><span className="block font-semibold">Escalate — cannot determine the canonical serving</span>
                <span className="block text-xs text-text-secondary">A different admin must resolve an escalation.</span></span>
            </label>

            <div>{escalated || correctionOpen ? <label className="block text-sm font-semibold">Reviewer note (required)</label>
              : <button type="button" onClick={() => setNoteOpen((open) => !open)} className="text-sm font-semibold text-accent underline">
                {noteOpen ? "Hide reviewer note" : "Add reviewer note (optional)"}</button>}
              {escalated || correctionOpen || noteOpen ? <textarea className={`${inputClass} mt-2 min-h-20`} value={reviewerNote}
                onChange={(event) => setReviewerNote(event.target.value)} placeholder="Explain what the printed label shows." /> : null}</div>

            <div className="flex flex-wrap gap-2"><button type="button" disabled={saving || (!escalated && selectedOrder == null)} onClick={save}
              className="rounded-full bg-accent px-5 py-2 text-sm font-bold text-[#03100E] disabled:opacity-40">
              {saving ? "Saving…" : readOnlyPreview ? "Preview decision and continue" : escalated ? "Save escalation" : "Save canonical serving"}</button>
              <button type="button" disabled={saving} onClick={() => setSelectedTaskId(next?.id ?? "")}
                className="rounded-full border border-white/15 px-5 py-2 text-sm font-semibold disabled:opacity-40">Skip for now</button></div>
          </div>
        </div>

        {detail.decisions.length ? <div className="border-t border-white/10 pt-4"><h4 className="mb-2 font-semibold">Decision history</h4>
          {detail.decisions.map((decision) => <p key={decision.id} className="mb-2 text-xs text-text-secondary">
            Rev {decision.taskRevision}: {humanize(decision.outcome)} by {decision.reviewerEmail} · {new Date(decision.decidedAt).toLocaleString()}
            {decision.selectedServingOrder ? ` · serving order ${decision.selectedServingOrder}` : ""}
            {decision.reviewerNote ? ` — ${decision.reviewerNote}` : ""}
          </p>)}</div> : null}
      </div>}
    </div>
  </section>;
}
