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
  type ReviewedServingContext,
  type ServingSizeReviewOutcome,
  type ServingSizeReviewTask,
  type ServingSizeReviewTaskDetail,
} from "./serving-size-review-api";

const inputClass = "w-full rounded border border-white/15 bg-[#080D12] px-3 py-2 text-sm text-text-primary outline-none focus:border-accent";
const choiceClass = "flex cursor-pointer items-start gap-3 rounded border border-white/15 bg-[#080D12] p-3 text-sm hover:border-accent/50";

const outcomes: Array<{ value: ServingSizeReviewOutcome; title: string; explanation: string }> = [
  { value: "confirmed_correct", title: "DSLD serving size is correct", explanation: "Keep the structured source serving context exactly as recorded." },
  { value: "corrected", title: "Correct serving size", explanation: "Replace incorrect quantities, units, or printed context with a reviewed snapshot." },
  { value: "multiple_contexts", title: "Add or separate serving contexts", explanation: "Represent multiple ages, preparations, columns, or serving conditions explicitly." },
  { value: "removed_duplicate", title: "Remove an erroneous duplicate context", explanation: "Keep the real context and omit one or more duplicate source serving rows." },
  { value: "escalated", title: "Escalate / cannot determine", explanation: "Leave this label unresolved for a different admin." },
];

type EditableContext = {
  contextKey: string;
  sourceServingOrders: string;
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

function editableContext(context: ReviewedServingContext): EditableContext {
  return {
    contextKey: context.contextKey,
    sourceServingOrders: context.sourceServingOrders.join(", "),
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

function reviewedContext(context: EditableContext): ReviewedServingContext {
  const sourceServingOrders = context.sourceServingOrders.trim() ? context.sourceServingOrders
    .split(",").map((value) => Number(value.trim())) : [];
  if (sourceServingOrders.some((value) => !Number.isSafeInteger(value) || value <= 0)) {
    throw new Error("Source serving orders must be positive whole numbers separated by commas.");
  }
  return {
    contextKey: context.contextKey.trim(),
    sourceServingOrders,
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

function formatQuantity(minimum: number | null, maximum: number | null, unit: string | null) {
  if (minimum == null) return "Not recorded";
  const amount = maximum != null && maximum !== minimum ? `${minimum}–${maximum}` : String(minimum);
  return `${amount} ${unit ?? ""}`.trim();
}

function humanize(value: string) {
  return value.replaceAll("_", " ");
}

function emptyContext(number: number): EditableContext {
  return {
    contextKey: `serving-${number}`,
    sourceServingOrders: "",
    householdQuantityMin: "",
    householdQuantityMax: "",
    householdUnit: "",
    metricQuantityMin: "",
    metricQuantityMax: "",
    metricUnit: "",
    contextLabel: "",
    preparationContext: "",
    labelText: "",
  };
}

export default function CatalogServingSizeReview({ mode = "selector" }: { mode?: "selector" | "queue" }) {
  const router = useRouter();
  const productNameRef = useRef<HTMLHeadingElement>(null);
  const [tasks, setTasks] = useState<ServingSizeReviewTask[]>([]);
  const [batchKey, setBatchKey] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [detail, setDetail] = useState<ServingSizeReviewTaskDetail | null>(null);
  const [range, setRange] = useState({ first: 0, last: -1 });
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [outcome, setOutcome] = useState<ServingSizeReviewOutcome | "">("");
  const [contexts, setContexts] = useState<EditableContext[]>([]);
  const [reviewerNote, setReviewerNote] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const span = pendingSpan(tasks);
  const pending = tasks.filter(isActionable).length;
  const escalated = tasks.filter((task) => task.status === "escalated").length;
  const decided = tasks.length - pending - escalated;
  const currentPosition = tasks.findIndex((task) => task.id === selectedTaskId) + 1;
  const next = useMemo(() => nextTask(tasks, selectedTaskId, range.first, range.last),
    [tasks, selectedTaskId, range]);
  const needsContexts = outcome === "corrected" || outcome === "multiple_contexts"
    || outcome === "removed_duplicate";
  const noteRequired = outcome !== "" && outcome !== "confirmed_correct";

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
    setOutcome(detail.status === "pending" || detail.status === "escalated" ? "" : detail.status);
    setContexts((detail.reviewedServingContexts ?? detail.sourceContexts).map(editableContext));
    setReviewerNote("");
    setNoteOpen(false);
    productNameRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
  }, [detail]);

  useEffect(() => {
    if (mode !== "queue" || !next) return;
    void labelPdfBytes(next.dsldLabelId).catch(() => {});
  }, [mode, next]);

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

  function updateContext(index: number, update: Partial<EditableContext>) {
    setContexts((current) => current.map((context, contextIndex) =>
      contextIndex === index ? { ...context, ...update } : context));
  }

  function addContext() {
    const used = new Set(contexts.map((context) => context.contextKey));
    let number = contexts.length + 1;
    while (used.has(`serving-${number}`)) number += 1;
    setContexts((current) => [...current, emptyContext(number)]);
  }

  function chooseOutcome(value: ServingSizeReviewOutcome) {
    setOutcome(value);
    if (value !== "multiple_contexts") return;
    setContexts((current) => current.length >= 2 ? current : [...current, emptyContext(2)]);
  }

  async function save() {
    if (!detail || !outcome) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const reviewed = needsContexts ? contexts.map(reviewedContext) : null;
      const updated = await saveServingSizeReviewDecision(detail.id, {
        expectedRevision: detail.revision,
        outcome,
        reviewedServingContexts: reviewed,
        reviewerNote: reviewerNote.trim() || null,
      });
      const nextTasks = tasks.map((task) => task.id === updated.id ? updated : task);
      setTasks(nextTasks);
      setSelectedTaskId(nextTask(nextTasks, updated.id, range.first, range.last)?.id ?? "");
      setNotice("Decision saved. Moved to the next label.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save this decision.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="rounded border border-white/10 bg-[#0D1117] p-6 text-sm">Loading serving-size reviews…</p>;

  return <section className="space-y-4" aria-label="Serving size review">
    {mode === "selector" ? <div className="rounded-[8px] border border-white/10 bg-[#0D1117] p-5">
      <h2 className="font-headline text-2xl font-bold">Serving size review</h2>
      <p className="mt-2 max-w-4xl text-sm text-text-secondary">
        Review one DSLD label at a time. This calibration batch contains the 25 strongest high-severity serving-size candidates from the frozen 214,780-label prescreen.
      </p>
      <p className="mt-3 text-sm text-text-primary">{pending} pending · {decided} decided · {escalated} escalated · {tasks.length} total</p>
      <p className="mt-1 text-xs text-text-muted">Queue {batchKey}. Decisions create a reviewed overlay; they never modify the frozen DSLD JSON.</p>
      <div className="mt-4 flex flex-wrap items-end gap-3 rounded border border-white/10 bg-[#080D12] p-3">
        <label className="text-xs font-semibold">Start at label
          <input className={`${inputClass} mt-1 w-28`} type="number" value={rangeStart}
            min={span ? span.first + 1 : undefined} max={span ? span.last + 1 : undefined}
            onChange={(event) => setRangeStart(event.target.value)} />
        </label>
        <label className="text-xs font-semibold">End at label
          <input className={`${inputClass} mt-1 w-28`} type="number" value={rangeEnd}
            min={span ? span.first + 1 : undefined} max={span ? span.last + 1 : undefined}
            onChange={(event) => setRangeEnd(event.target.value)} />
        </label>
        <button type="button" disabled={!span} onClick={applyRange}
          className="rounded-full border border-accent px-4 py-2 text-sm font-semibold text-accent disabled:opacity-40">
          Start review range
        </button>
        <p className="text-xs text-text-muted">Choose non-overlapping ranges if multiple admins work at once. Completed labels inside a range are skipped.</p>
      </div>
      {escalated ? <details className="mt-3 rounded border border-amber-400/25 p-3 text-sm">
        <summary className="cursor-pointer font-semibold text-amber-200">Escalations needing another admin ({escalated})</summary>
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
    </div> : <Link href="/admin/catalog?view=serving-size-review"
      className="inline-flex rounded-full border border-white/20 px-4 py-2 text-sm font-semibold hover:border-accent hover:text-accent">
      ← Back to serving-size queue
    </Link>}

    {error ? <p role="alert" className="rounded border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">{error}</p> : null}
    {notice ? <p role="status" className="rounded border border-accent/40 bg-accent/10 p-3 text-sm text-accent">{notice}</p> : null}

    {mode === "queue" ? <div className="rounded-[8px] border border-white/10 bg-[#0D1117] p-4">
      {selectedTaskId ? <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-accent">
        Label {currentPosition} of {tasks.length} · assigned range {range.first + 1}–{range.last + 1}
      </p> : null}
      {!detail || detail.id !== selectedTaskId ? <p className="text-sm text-text-secondary">
        {selectedTaskId ? "Loading the next label…" : "No pending labels remain in this range."}
      </p> : <div className="space-y-5">
        <div>
          <h3 ref={productNameRef} className="scroll-mt-4 font-headline text-xl font-bold">{detail.labelName}</h3>
          <p className="text-sm text-text-secondary">{detail.brandName} · DSLD {detail.dsldLabelId}{detail.offMarket ? " · off market" : ""}</p>
        </div>

        <div className="grid items-start gap-4 md:grid-cols-[minmax(0,3fr)_minmax(340px,2fr)]">
          <div className="min-w-0">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h4 className="font-semibold">Original label</h4>
              <a href={detail.labelPdfUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-accent underline">Open label PDF</a>
            </div>
            <Group1LabelPreview key={detail.id} labelId={detail.dsldLabelId}
              sourceName="Serving Size" suggestedFieldName="Serving Size" />
          </div>

          <div className="space-y-4">
            <section className="rounded border border-amber-400/30 bg-amber-400/5 p-3">
              <h4 className="font-semibold text-amber-200">DSLD structured serving size</h4>
              <div className="mt-2 space-y-2">
                {detail.sourceServingSizes.map((serving) => <div key={serving.order} className="rounded border border-white/10 bg-[#080D12] p-3 text-sm">
                  <p className="font-semibold">Source row {serving.order}: {formatQuantity(serving.minQuantity, serving.maxQuantity, serving.unit)}</p>
                  <p className="mt-1 text-xs text-text-secondary">Printed/context note: {serving.notes?.trim() || "Not recorded"}</p>
                  <p className="mt-1 text-xs text-text-muted">Facts-panel marker: {serving.inSFB == null ? "not recorded" : serving.inSFB ? "yes" : "no"}</p>
                </div>)}
              </div>
            </section>

            <details className="rounded border border-white/10 p-3 text-sm">
              <summary className="cursor-pointer font-semibold">Why this label was flagged ({detail.prescreenFlags.length})</summary>
              <div className="mt-2 space-y-2">
                {detail.prescreenFlags.map((flag, index) => <div key={`${flag.code}-${index}`} className="rounded bg-[#080D12] p-2">
                  <p><span className={flag.severity === "high" ? "text-red-300" : "text-amber-200"}>{flag.severity.toUpperCase()}</span> · {humanize(flag.code)}</p>
                  <p className="mt-1 text-xs text-text-secondary">{flag.summary}</p>
                </div>)}
              </div>
            </details>

            <fieldset className="space-y-2">
              <legend className="mb-2 font-semibold">Decision for this label</legend>
              {outcomes.map((choice) => <label key={choice.value} className={choiceClass}>
                <input type="radio" name="serving-size-outcome" className="mt-1 accent-emerald-400"
                  value={choice.value} checked={outcome === choice.value}
                  disabled={choice.value === "removed_duplicate" && detail.sourceServingSizes.length < 2}
                  onChange={() => chooseOutcome(choice.value)} />
                <span><span className="block font-semibold">{choice.title}</span>
                  <span className="block text-xs text-text-secondary">{choice.explanation}
                    {choice.value === "removed_duplicate" && detail.sourceServingSizes.length < 2
                      ? " This label has only one structured source row." : ""}</span></span>
              </label>)}
            </fieldset>

            {needsContexts ? <section className="space-y-3 rounded border border-accent/30 bg-accent/5 p-3">
              <div className="flex items-center justify-between gap-3">
                <div><h4 className="font-semibold text-accent">Reviewed serving contexts</h4>
                  <p className="mt-1 text-xs text-text-secondary">Save the complete intended after-state. Source orders omitted under duplicate removal are excluded.</p></div>
                <button type="button" onClick={addContext} className="shrink-0 text-sm font-semibold text-accent underline">Add context</button>
              </div>
              {contexts.map((context, index) => <div key={`${context.contextKey}-${index}`} className="rounded border border-white/10 bg-[#080D12] p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold">Context {index + 1}</p>
                  {contexts.length > 1 ? <button type="button" onClick={() => setContexts((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                    className="text-xs text-red-300 underline">Remove</button> : null}
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <label className="text-xs">Stable context key<input className={`${inputClass} mt-1`} value={context.contextKey}
                    onChange={(event) => updateContext(index, { contextKey: event.target.value })} /></label>
                  <label className="text-xs">Mapped source row orders<input className={`${inputClass} mt-1`} value={context.sourceServingOrders}
                    placeholder="1, 2" onChange={(event) => updateContext(index, { sourceServingOrders: event.target.value })} /></label>
                  <label className="text-xs">Context label<input className={`${inputClass} mt-1`} value={context.contextLabel}
                    placeholder="Adults, children 4+, first column…" onChange={(event) => updateContext(index, { contextLabel: event.target.value })} /></label>
                  <label className="text-xs">Preparation context<input className={`${inputClass} mt-1`} value={context.preparationContext}
                    placeholder="Prepared with water, prepared with milk…" onChange={(event) => updateContext(index, { preparationContext: event.target.value })} /></label>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <label className="text-xs">Household min<input className={`${inputClass} mt-1`} type="number" min="0" step="any" value={context.householdQuantityMin}
                    onChange={(event) => updateContext(index, { householdQuantityMin: event.target.value })} /></label>
                  <label className="text-xs">Household max<input className={`${inputClass} mt-1`} type="number" min="0" step="any" value={context.householdQuantityMax}
                    onChange={(event) => updateContext(index, { householdQuantityMax: event.target.value })} /></label>
                  <label className="text-xs">Household unit<input className={`${inputClass} mt-1`} value={context.householdUnit}
                    placeholder="scoops" onChange={(event) => updateContext(index, { householdUnit: event.target.value })} /></label>
                  <label className="text-xs">Metric min<input className={`${inputClass} mt-1`} type="number" min="0" step="any" value={context.metricQuantityMin}
                    onChange={(event) => updateContext(index, { metricQuantityMin: event.target.value })} /></label>
                  <label className="text-xs">Metric max<input className={`${inputClass} mt-1`} type="number" min="0" step="any" value={context.metricQuantityMax}
                    onChange={(event) => updateContext(index, { metricQuantityMax: event.target.value })} /></label>
                  <label className="text-xs">Metric unit<input className={`${inputClass} mt-1`} value={context.metricUnit}
                    placeholder="g" onChange={(event) => updateContext(index, { metricUnit: event.target.value })} /></label>
                </div>
                <label className="mt-2 block text-xs">Exact printed serving text or source note
                  <input className={`${inputClass} mt-1`} value={context.labelText}
                    onChange={(event) => updateContext(index, { labelText: event.target.value })} />
                </label>
              </div>)}
            </section> : null}

            <div>
              {noteRequired ? <label className="block text-sm font-semibold">Reviewer note (required)</label>
                : <button type="button" onClick={() => setNoteOpen((open) => !open)}
                  className="text-sm font-semibold text-accent underline underline-offset-2">
                  {noteOpen ? "Hide reviewer note" : "Add reviewer note (optional)"}
                </button>}
              {noteRequired || noteOpen ? <textarea className={`${inputClass} mt-2 min-h-20`} value={reviewerNote}
                onChange={(event) => setReviewerNote(event.target.value)}
                placeholder="Explain what the label shows and why this outcome is correct." /> : null}
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={!outcome || saving} onClick={save}
                className="rounded-full bg-accent px-5 py-2 text-sm font-bold text-[#03100E] disabled:opacity-40">
                {saving ? "Saving…" : "Save decision"}
              </button>
              <button type="button" disabled={saving} onClick={() => setSelectedTaskId(next?.id ?? "")}
                className="rounded-full border border-white/15 px-5 py-2 text-sm font-semibold disabled:opacity-40">Skip for now</button>
            </div>
          </div>
        </div>

        {detail.decisions.length ? <div className="border-t border-white/10 pt-4">
          <h4 className="mb-2 font-semibold">Decision history</h4>
          {detail.decisions.map((decision) => <p key={decision.id} className="mb-2 text-xs text-text-secondary">
            Rev {decision.taskRevision}: {humanize(decision.outcome)} by {decision.reviewerEmail} · {new Date(decision.decidedAt).toLocaleString()}
            {decision.reviewedServingContexts ? ` · ${decision.reviewedServingContexts.length} reviewed context${decision.reviewedServingContexts.length === 1 ? "" : "s"}` : ""}
            {decision.reviewerNote ? ` — ${decision.reviewerNote}` : ""}
          </p>)}
        </div> : null}
      </div>}
    </div> : null}
  </section>;
}
