"use client";

import { useEffect, useMemo, useState } from "react";
import { Group1LabelPreview } from "./Group1LabelPreview";
import { labelPdfBytes } from "./group1-label-pdf";
import { nextPendingTask, upcomingPendingTasks } from "./group1-review-queue";
import {
  getReviewList,
  getReviewTask,
  saveReviewDecision,
  type ReviewField,
  type ReviewOutcome,
  type ReviewTask,
  type ReviewTaskDetail,
  type SourceQuantity,
} from "./group1-review-api";

const inputClass = "w-full rounded border border-white/15 bg-[#080D12] px-3 py-2 text-sm text-text-primary outline-none focus:border-accent";
const choiceClass = "flex cursor-pointer items-start gap-3 rounded border border-white/15 bg-[#080D12] p-3 text-sm hover:border-accent/50";

const decisions: Array<{ value: ReviewOutcome; title: string; explanation: string }> = [
  { value: "accepted", title: "Group 1 field", explanation: "Accept the proposed field or choose another of the 19 fields." },
  { value: "not_group1", title: "Not Group 1", explanation: "Keep this row for the later Group 2/3 pass." },
  { value: "not_real_data_row", title: "Not a real data row", explanation: "Exclude this occurrence from all later candidate passes." },
  { value: "escalated", title: "Escalate", explanation: "Leave unresolved for a different admin to decide." },
];

type EditableQuantity = { amount: string; unit: string; dailyValuePercents: string[] };

function numberOrNull(value: string): number | null {
  if (value.trim() === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new Error("Corrected amounts and Daily Values must be zero or greater.");
  }
  return number;
}

function quantitySummary(quantity: SourceQuantity) {
  const amount = quantity.quantity;
  const value = amount === null || amount === undefined ? "No amount" : `${quantity.operator ?? ""}${amount}`;
  const serving = quantity.servingSizeQuantity != null
    ? ` per ${quantity.servingSizeQuantity} ${quantity.servingSizeUnit ?? ""}` : "";
  const dv = quantity.dailyValueTargetGroup?.map((target) =>
    target.percent == null ? null : `${target.percent}% DV (${target.name ?? "target group"})`
  ).filter(Boolean).join(", ");
  return `${value} ${quantity.unit ?? ""}${serving}${dv ? ` · ${dv}` : ""}`;
}

function statusLabel(status: ReviewTask["status"]) {
  return status.replaceAll("_", " ");
}

function editableSourceQuantities(quantities: SourceQuantity[]): EditableQuantity[] {
  return (quantities.length ? quantities : [{}]).map((quantity) => ({
    amount: quantity.quantity == null ? "" : String(quantity.quantity),
    unit: quantity.unit ?? "",
    dailyValuePercents: quantity.dailyValueTargetGroup?.length
      ? quantity.dailyValueTargetGroup.map((target) => target.percent == null ? "" : String(target.percent))
      : [""],
  }));
}

export default function CatalogGroup1Review() {
  const [fields, setFields] = useState<ReviewField[]>([]);
  const [tasks, setTasks] = useState<ReviewTask[]>([]);
  const [batchKey, setBatchKey] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [range, setRange] = useState({ first: 0, last: -1 });
  const [rangeStartInput, setRangeStartInput] = useState("1");
  const [rangeEndInput, setRangeEndInput] = useState("345");
  const [detail, setDetail] = useState<ReviewTaskDetail | null>(null);
  const [skippedIds, setSkippedIds] = useState<Set<string>>(() => new Set());
  const [scanReadyFor, setScanReadyFor] = useState("");
  const [preloadStep, setPreloadStep] = useState(0);
  const [outcome, setOutcome] = useState<ReviewOutcome | "">("");
  const [fieldKey, setFieldKey] = useState("");
  const [reviewerNote, setReviewerNote] = useState("");
  const [correctQuantity, setCorrectQuantity] = useState(false);
  const [editedQuantities, setEditedQuantities] = useState<EditableQuantity[]>([]);
  const [correctionReason, setCorrectionReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [rangeLoading, setRangeLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const pendingCount = tasks.filter((task) => task.status === "pending").length;
  const rangePendingCount = tasks.slice(range.first, range.last + 1).filter((task) => task.status === "pending").length;
  const escalatedCount = tasks.filter((task) => task.status === "escalated").length;
  const skippedCount = tasks.slice(range.first, range.last + 1).filter((task) => task.status === "pending" && skippedIds.has(task.id)).length;
  const currentPosition = tasks.findIndex((task) => task.id === selectedTaskId) + 1;
  const upcoming = useMemo(() => upcomingPendingTasks(tasks, selectedTaskId, skippedIds, range.first, range.last),
    [tasks, selectedTaskId, skippedIds, range]);
  const prefetchTask = detail?.id === selectedTaskId && scanReadyFor === selectedTaskId
    ? upcoming[preloadStep] : undefined;
  const sourceQuantities = Array.isArray(detail?.sourceRow.quantity) ? detail.sourceRow.quantity : [];

  useEffect(() => {
    // Download the next two labels immediately; OCR them sequentially after the visible scan settles.
    for (const task of upcoming) void labelPdfBytes(task.dsldLabelId).catch(() => {});
  }, [upcoming]);

  useEffect(() => {
    let cancelled = false;
    getReviewList().then((result) => {
      if (cancelled) return;
      setFields(result.fields);
      setTasks(result.tasks);
      setBatchKey(result.batchKey);
      const stored = window.localStorage.getItem(`group1-review-range:${result.batchKey}`);
      let selectedRange = { first: 0, last: result.tasks.length - 1 };
      if (stored) {
        try {
          const value = JSON.parse(stored) as { first: number; last: number };
          if (Number.isSafeInteger(value.first) && Number.isSafeInteger(value.last)
            && value.first >= 0 && value.first <= value.last && value.last < result.tasks.length) {
            selectedRange = value;
          }
        } catch { /* Old or malformed local preference: use the full queue. */ }
      }
      setRange(selectedRange);
      setRangeStartInput(String(selectedRange.first + 1));
      setRangeEndInput(String(selectedRange.last + 1));
      const first = nextPendingTask(result.tasks, "", new Set(), selectedRange.first, selectedRange.last);
      setSelectedTaskId(first?.id ?? "");
    }).catch((reason) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : "Unable to load reviews.");
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    setScanReadyFor("");
    setPreloadStep(0);
    if (!selectedTaskId) { setDetail(null); return; }
    let cancelled = false;
    setDetail(null);
    setError("");
    getReviewTask(selectedTaskId).then((next) => {
      if (!cancelled) setDetail(next);
    }).catch((reason) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : "Unable to load this label.");
    });
    return () => { cancelled = true; };
  }, [selectedTaskId]);

  useEffect(() => {
    if (!detail) return;
    const last = detail.decisions[0];
    setOutcome(detail.status === "pending" ? "" : detail.status);
    setFieldKey(detail.selectedFieldKey ?? detail.suggestedFieldKey);
    // A new revision needs its own explanation; never copy an earlier reviewer's note.
    setReviewerNote("");
    setCorrectQuantity(Boolean(last?.correctedValues));
    const quantities = Array.isArray(detail.sourceRow.quantity) ? detail.sourceRow.quantity : [];
    const edited = editableSourceQuantities(quantities);
    for (const correction of last?.correctedValues ?? []) {
      if (!edited[correction.quantityIndex]) continue;
      edited[correction.quantityIndex] = {
        amount: correction.amount == null ? "" : String(correction.amount),
        unit: correction.unit ?? "",
        dailyValuePercents: correction.dailyValuePercents.map((percent) =>
          percent == null ? "" : String(percent)),
      };
    }
    setEditedQuantities(edited);
    setCorrectionReason(last?.correctionReason ?? "");
  }, [detail]);

  function editQuantity(index: number, update: Partial<EditableQuantity>) {
    setEditedQuantities((current) => current.map((item, itemIndex) =>
      itemIndex === index ? { ...item, ...update } : item));
  }

  function editDailyValue(quantity: number, target: number, value: string) {
    setEditedQuantities((current) => current.map((item, index) => {
      if (index !== quantity) return item;
      const dailyValuePercents = [...item.dailyValuePercents];
      dailyValuePercents[target] = value;
      return { ...item, dailyValuePercents };
    }));
  }

  function skip() {
    if (!selectedTaskId || saving) return;
    if (detail?.status === "escalated") {
      setSelectedTaskId(nextPendingTask(tasks, "", skippedIds, range.first, range.last)?.id ?? "");
      setNotice("Escalation left unresolved. Returned to your pending range.");
      return;
    }
    const skipped = new Set(skippedIds);
    skipped.add(selectedTaskId);
    setSkippedIds(skipped);
    setSelectedTaskId(nextPendingTask(tasks, selectedTaskId, skipped, range.first, range.last)?.id ?? "");
    setNotice("Skipped for this pass. The occurrence remains pending.");
  }

  function revisitSkipped() {
    setSkippedIds(new Set());
    setSelectedTaskId(nextPendingTask(tasks, "", new Set(), range.first, range.last)?.id ?? "");
    setNotice("Returning to pending occurrences.");
  }

  async function applyRange() {
    const first = Number(rangeStartInput);
    const last = Number(rangeEndInput);
    if (!Number.isSafeInteger(first) || !Number.isSafeInteger(last)
      || first < 1 || last > tasks.length || first > last) {
      setError(`Choose a range from 1 to ${tasks.length}, with the start before the end.`);
      return;
    }
    setRangeLoading(true);
    setError("");
    try {
      const refreshed = await getReviewList();
      if (refreshed.batchKey !== batchKey || refreshed.tasks.length !== tasks.length) {
        throw new Error("The review batch changed. Reload the page before choosing a range.");
      }
      const selectedRange = { first: first - 1, last: last - 1 };
      setTasks(refreshed.tasks);
      setNotice(`Showing assigned occurrences ${first}–${last}.`);
      setRange(selectedRange);
      window.localStorage.setItem(`group1-review-range:${batchKey}`, JSON.stringify(selectedRange));
      setSkippedIds(new Set());
      setSelectedTaskId(nextPendingTask(refreshed.tasks, "", new Set(), selectedRange.first, selectedRange.last)?.id ?? "");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to refresh the review queue.");
    } finally {
      setRangeLoading(false);
    }
  }

  async function save() {
    if (!detail || !outcome) return;
    setError("");
    setNotice("");
    setSaving(true);
    try {
      const correction = correctQuantity && outcome === "accepted" ? editedQuantities.map((item, index) => ({
        quantityIndex: index,
        amount: numberOrNull(item.amount),
        unit: item.unit.trim() || null,
        dailyValuePercents: item.dailyValuePercents.map(numberOrNull),
      })) : null;
      const updated = await saveReviewDecision(detail.id, {
        expectedRevision: detail.revision,
        outcome,
        selectedFieldKey: outcome === "accepted" ? fieldKey : null,
        correctedValues: correction,
        correctionReason: correction ? correctionReason.trim() : null,
        reviewerNote: reviewerNote.trim() || null,
      });
      const nextTasks = tasks.map((task) => task.id === updated.id ? updated : task);
      setTasks(nextTasks);
      setSelectedTaskId(nextPendingTask(nextTasks, detail.status === "escalated" ? "" : updated.id,
        skippedIds, range.first, range.last)?.id ?? "");
      setNotice("Decision saved. Moved to the next occurrence.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save this decision.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="rounded border border-white/10 bg-[#0D1117] p-6 text-sm">Loading nutrition reviews…</p>;

  return (
    <section className="space-y-4" aria-label="Group 1 nutrition review">
      <div className="rounded-[8px] border border-white/10 bg-[#0D1117] p-5">
        <h2 className="font-headline text-2xl font-bold">General nutrition review</h2>
        <p className="mt-2 text-sm text-text-secondary">
          Review one DSLD label occurrence at a time. These decisions do not approve a name globally or write catalog nutrition facts yet.
        </p>
        <p className="mt-2 text-xs text-text-muted">{pendingCount} pending of {tasks.length} occurrences · {escalatedCount} escalated · batch {batchKey}</p>
        <div className="mt-4 flex flex-wrap items-end gap-3 rounded border border-white/10 bg-[#080D12] p-3">
          <label className="text-xs font-semibold">Start at occurrence
            <input type="number" min="1" max={tasks.length} value={rangeStartInput} onChange={(event) => setRangeStartInput(event.target.value)}
              className={`${inputClass} mt-1 w-28`} />
          </label>
          <label className="text-xs font-semibold">End at occurrence
            <input type="number" min="1" max={tasks.length} value={rangeEndInput} onChange={(event) => setRangeEndInput(event.target.value)}
              className={`${inputClass} mt-1 w-28`} />
          </label>
          <button type="button" onClick={applyRange} disabled={rangeLoading || saving}
            className="rounded-full border border-accent px-4 py-2 text-sm font-semibold text-accent disabled:opacity-40">
            {rangeLoading ? "Refreshing…" : "Start / refresh range"}
          </button>
          <p className="text-xs text-text-muted">Agree on non-overlapping ranges with other admins. Your range is saved only in this browser and stops at the end number; this button refreshes completed tasks. An overlapping decision is blocked at save.</p>
        </div>
        {escalatedCount ? <details className="mt-3 rounded border border-amber-400/25 p-3 text-sm">
          <summary className="cursor-pointer font-semibold text-amber-200">Escalations needing another admin ({escalatedCount})</summary>
          <p className="mt-2 text-xs text-text-secondary">These remain outside the automatic pending queue. An admin other than the one who escalated each row can open it here.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {tasks.filter((task) => task.status === "escalated").map((task) => <button key={task.id} type="button"
              onClick={() => { setSelectedTaskId(task.id); setNotice(""); }}
              className="rounded border border-white/15 px-3 py-2 text-left text-xs hover:border-accent">
              #{tasks.indexOf(task) + 1} · {task.suggestedFieldName} · {task.printedName}
            </button>)}
          </div>
        </details> : null}
      </div>
      {error ? <p role="alert" className="rounded border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">{error}</p> : null}
      {notice ? <p role="status" className="rounded border border-accent/40 bg-accent/10 p-3 text-sm text-accent">{notice}</p> : null}
      <div className="rounded-[8px] border border-white/10 bg-[#0D1117] p-4">
        {selectedTaskId ? <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-accent">
          {detail?.status === "escalated" ? "Escalation" : "Occurrence"} {currentPosition} of {tasks.length}
          {detail?.status !== "escalated" ? ` · assigned range ${range.first + 1}–${range.last + 1} · ${skippedCount} skipped this pass` : " · a different admin must resolve this"}
        </p> : null}
          {!detail || detail.id !== selectedTaskId ? <div className="space-y-3 text-sm text-text-secondary">
            <p>{selectedTaskId ? "Loading the next label…" : rangePendingCount === 0 ? "No pending occurrences remain in your assigned range." : "You reached the end of your assigned range for this pass."}</p>
            {rangePendingCount > 0 && skippedCount > 0 ? <button type="button" onClick={revisitSkipped}
              className="rounded-full border border-accent px-5 py-2 font-semibold text-accent">Revisit skipped occurrences ({skippedCount})</button> : null}
            {escalatedCount ? <p>{escalatedCount} escalated occurrence{escalatedCount === 1 ? "" : "s"} still need a different admin’s decision.</p> : null}
          </div> : <div className="space-y-5">
            <div>
              <h3 className="font-headline text-xl font-bold">{detail.labelName || `DSLD ${detail.dsldLabelId}`}</h3>
              <p className="text-sm text-text-secondary">{detail.brandName} · DSLD {detail.dsldLabelId}</p>
              <div className="mt-4 grid items-stretch gap-3 sm:grid-cols-[1fr_auto_1fr]">
                <div className="rounded border border-amber-400/35 bg-amber-400/5 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-200">Name extracted by DSLD</p>
                  <p className="mt-2 break-words text-xl font-bold text-text-primary">“{detail.printedName}”</p>
                  <p className="mt-2 text-xs text-text-secondary">Source wording to check against the label image.</p>
                </div>
                <span aria-hidden="true" className="self-center text-center text-xl text-text-muted">→</span>
                <div className="rounded border border-accent/40 bg-accent/5 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-accent">Our suggested field</p>
                  <p className="mt-2 break-words text-xl font-bold text-text-primary">{detail.suggestedFieldName}</p>
                  <p className="mt-2 text-xs text-text-secondary">Canonical nutrition field proposed for this row.</p>
                </div>
              </div>
              <p className="mt-2 text-xs text-text-muted">DSLD wording may differ from the printed image.</p>
              {detail.sourceAncestorNames.length ? <p className="mt-1 text-xs text-text-muted">Source parents: {detail.sourceAncestorNames.join(" → ")}</p> : null}
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h4 className="font-semibold">Original label</h4>
                <a href={detail.labelPdfUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-accent underline">Open label PDF</a>
              </div>
              <Group1LabelPreview key={detail.id} labelId={detail.dsldLabelId}
                sourceName={detail.printedName} suggestedFieldName={detail.suggestedFieldName}
                onScanSettled={() => setScanReadyFor(detail.id)} />
            </div>
            <div className="rounded border border-white/10 bg-[#080D12] p-3 text-sm">
              <h4 className="font-semibold">DSLD source values</h4>
              {sourceQuantities.length ? sourceQuantities.map((quantity, index) =>
                <p key={index} className="mt-1 text-text-secondary">{index + 1}. {quantitySummary(quantity)}</p>
              ) : <p className="mt-1 text-text-muted">No source quantity or Daily Value.</p>}
              {detail.sourceRow.notes ? <p className="mt-2 text-xs text-text-muted">Source note: {detail.sourceRow.notes}</p> : null}
            </div>
            <fieldset className="space-y-2">
              <legend className="mb-2 font-semibold">Decision for this occurrence</legend>
              {decisions.map((choice) => <label key={choice.value} className={choiceClass}>
                <input type="radio" name="group1-outcome" value={choice.value} checked={outcome === choice.value}
                  onChange={() => setOutcome(choice.value)} className="mt-1 accent-emerald-400" />
                <span><span className="block font-semibold">{choice.title}</span><span className="block text-xs text-text-secondary">{choice.explanation}</span></span>
              </label>)}
            </fieldset>
            {outcome === "accepted" ? <div className="space-y-3 rounded border border-accent/25 p-3">
              <label className="block text-sm font-semibold">Group 1 field
                <select value={fieldKey} onChange={(event) => setFieldKey(event.target.value)} className={`${inputClass} mt-1`}>
                  {fields.map((field) => <option key={field.fieldKey} value={field.fieldKey}>{field.displayName}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={correctQuantity} onChange={(event) => {
                  setCorrectQuantity(event.target.checked);
                }} className="accent-emerald-400" /> Correct amount, unit, or % Daily Value from the label
              </label>
              {correctQuantity ? <div className="space-y-2">
                {editedQuantities.map((item, index) => <div key={index} className="rounded border border-white/10 p-2">
                  <p className="mb-2 text-xs text-text-secondary">Quantity {index + 1}{sourceQuantities[index]?.servingSizeQuantity != null
                    ? ` · serving ${sourceQuantities[index].servingSizeQuantity} ${sourceQuantities[index].servingSizeUnit ?? ""}` : ""}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-xs">Amount<input className={`${inputClass} mt-1`} type="number" min="0" step="any" value={item.amount}
                      onChange={(event) => editQuantity(index, { amount: event.target.value })} /></label>
                    <label className="text-xs">Unit<input className={`${inputClass} mt-1`} value={item.unit}
                      onChange={(event) => editQuantity(index, { unit: event.target.value })} /></label>
                  </div>
                  {item.dailyValuePercents.map((percent, targetIndex) => <label key={targetIndex} className="mt-2 block text-xs">
                    % DV · {sourceQuantities[index]?.dailyValueTargetGroup?.[targetIndex]?.name ?? "label target group unspecified"}
                    <input className={`${inputClass} mt-1`} type="number" min="0" step="any" value={percent}
                      onChange={(event) => editDailyValue(index, targetIndex, event.target.value)} />
                  </label>)}
                </div>)}
                <label className="block text-xs">Reason for correction<input className={`${inputClass} mt-1`} value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} /></label>
              </div> : null}
            </div> : null}
            <label className="block text-sm font-semibold">Reviewer note {outcome === "escalated" || outcome === "not_real_data_row"
              || (outcome === "accepted" && fieldKey !== detail.suggestedFieldKey) ? "(required)" : "(optional)"}
              <textarea className={`${inputClass} mt-1 min-h-20`} value={reviewerNote} onChange={(event) => setReviewerNote(event.target.value)} />
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={save} disabled={!outcome || saving}
                className="rounded-full bg-accent px-5 py-2 text-sm font-bold text-[#03100E] disabled:opacity-40">{saving ? "Saving…" : "Save decision"}</button>
              <button type="button" onClick={skip} disabled={saving} className="rounded-full border border-white/15 px-5 py-2 text-sm font-semibold disabled:opacity-40">Skip for now</button>
            </div>
            {detail.decisions.length ? <div className="border-t border-white/10 pt-4">
              <h4 className="mb-2 font-semibold">Decision history</h4>
              {detail.decisions.map((decision) => <p key={decision.taskRevision} className="mb-2 text-xs text-text-secondary">
                Rev {decision.taskRevision}: {statusLabel(decision.outcome)} by {decision.reviewerEmail} · {new Date(decision.decidedAt).toLocaleString()}
                {decision.reviewerNote ? ` — ${decision.reviewerNote}` : ""}
              </p>)}
            </div> : null}
          </div>}
        {prefetchTask ? <Group1LabelPreview key={`preload-${prefetchTask.id}`} prefetchOnly
          labelId={prefetchTask.dsldLabelId} sourceName={prefetchTask.printedName}
          suggestedFieldName={prefetchTask.suggestedFieldName} onScanSettled={() => setPreloadStep((current) => current + 1)} /> : null}
      </div>
    </section>
  );
}
