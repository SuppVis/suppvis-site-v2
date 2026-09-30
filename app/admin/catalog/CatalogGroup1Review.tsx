"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Group1LabelPreview } from "./Group1LabelPreview";
import { labelPdfBytes } from "./group1-label-pdf";
import { actionableReviewSpan, isActionableReview, nextPendingTask, upcomingPendingTasks } from "./group1-review-queue";
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
  { value: "accepted", title: "Group 1 field", explanation: "Accept the proposed field or choose another available field." },
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

function nonEqualityOperator(operator?: string | null) {
  const value = operator?.trim();
  return value && value !== "=" ? value : null;
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

export default function CatalogGroup1Review({ mode = "selector" }: { mode?: "selector" | "queue" }) {
  const router = useRouter();
  const [fields, setFields] = useState<ReviewField[]>([]);
  const [tasks, setTasks] = useState<ReviewTask[]>([]);
  const [batchKey, setBatchKey] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [range, setRange] = useState({ first: 0, last: -1 });
  const [rangeStartInput, setRangeStartInput] = useState("");
  const [rangeEndInput, setRangeEndInput] = useState("");
  const [detail, setDetail] = useState<ReviewTaskDetail | null>(null);
  const [skippedIds, setSkippedIds] = useState<Set<string>>(() => new Set());
  const [scanReadyFor, setScanReadyFor] = useState("");
  const [preloadStep, setPreloadStep] = useState(0);
  const [outcome, setOutcome] = useState<ReviewOutcome | "">("");
  const [fieldKey, setFieldKey] = useState("");
  const [fieldEditorOpen, setFieldEditorOpen] = useState(false);
  const [reviewerNote, setReviewerNote] = useState("");
  const [noteEditorOpen, setNoteEditorOpen] = useState(false);
  const [correctQuantity, setCorrectQuantity] = useState(false);
  const [editedQuantities, setEditedQuantities] = useState<EditableQuantity[]>([]);
  const [correctionReason, setCorrectionReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [rangeLoading, setRangeLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const actionableSpan = actionableReviewSpan(tasks);
  const pendingCount = actionableSpan?.count ?? 0;
  const rangePendingCount = tasks.slice(range.first, range.last + 1).filter(isActionableReview).length;
  const recheckCount = tasks.filter((task) => task.needsRecheck).length;
  const escalatedCount = tasks.filter((task) => task.status === "escalated").length;
  const skippedCount = tasks.slice(range.first, range.last + 1).filter((task) => isActionableReview(task) && skippedIds.has(task.id)).length;
  const currentPosition = tasks.findIndex((task) => task.id === selectedTaskId) + 1;
  const upcoming = useMemo(() => upcomingPendingTasks(tasks, selectedTaskId, skippedIds, range.first, range.last),
    [tasks, selectedTaskId, skippedIds, range]);
  const prefetchTask = detail?.id === selectedTaskId && scanReadyFor === selectedTaskId
    ? upcoming[preloadStep] : undefined;
  const sourceQuantities = Array.isArray(detail?.sourceRow.quantity) ? detail.sourceRow.quantity : [];
  const reviewerNoteRequired = Boolean(detail?.needsRecheck || outcome === "escalated" || outcome === "not_real_data_row"
    || (outcome === "accepted" && detail && fieldKey !== detail.suggestedFieldKey));

  useEffect(() => {
    if (mode !== "queue") return;
    // Download the next two labels immediately; fetch their saved OCR positions after the visible label settles.
    for (const task of upcoming) void labelPdfBytes(task.dsldLabelId).catch(() => {});
  }, [mode, upcoming]);

  useEffect(() => {
    let cancelled = false;
    getReviewList().then((result) => {
      if (cancelled) return;
      setFields(result.fields);
      setTasks(result.tasks);
      setBatchKey(result.batchKey);
      const rangeKey = `group1-review-range:${result.batchKey}`;
      // Migrate the previous browser-wide choice once, then keep each review tab independent.
      const stored = window.sessionStorage.getItem(rangeKey) ?? window.localStorage.getItem(rangeKey);
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
      window.sessionStorage.setItem(rangeKey, JSON.stringify(selectedRange));
      // Suggest the remaining span on each selector load without changing an active tab's assigned range.
      const suggestedSpan = actionableReviewSpan(result.tasks);
      setRangeStartInput(mode === "selector" ? (suggestedSpan ? String(suggestedSpan.first + 1) : "")
        : String(selectedRange.first + 1));
      setRangeEndInput(mode === "selector" ? (suggestedSpan ? String(suggestedSpan.last + 1) : "")
        : String(selectedRange.last + 1));
      if (mode === "queue") {
        const openTaskKey = `group1-review-open-task:${result.batchKey}`;
        const requestedTaskId = window.sessionStorage.getItem(openTaskKey);
        window.sessionStorage.removeItem(openTaskKey);
        const first = requestedTaskId && result.tasks.some((task) => task.id === requestedTaskId)
          ? result.tasks.find((task) => task.id === requestedTaskId)
          : nextPendingTask(result.tasks, "", new Set(), selectedRange.first, selectedRange.last);
        setSelectedTaskId(first?.id ?? "");
      }
    }).catch((reason) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : "Unable to load reviews.");
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [mode]);

  useEffect(() => {
    if (mode !== "queue") return;
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
  }, [mode, selectedTaskId]);

  useEffect(() => {
    if (mode === "queue" && selectedTaskId) window.scrollTo({ top: 0, behavior: "auto" });
  }, [mode, selectedTaskId]);

  useEffect(() => {
    if (!detail) return;
    const last = detail.decisions[0];
    setOutcome(detail.status === "pending" || detail.needsRecheck ? "" : detail.status);
    setFieldKey(detail.needsRecheck ? detail.suggestedFieldKey : (detail.selectedFieldKey ?? detail.suggestedFieldKey));
    setFieldEditorOpen(!detail.needsRecheck && Boolean(detail.selectedFieldKey && detail.selectedFieldKey !== detail.suggestedFieldKey));
    // A new revision needs its own explanation; never copy an earlier reviewer's note.
    setReviewerNote("");
    setNoteEditorOpen(false);
    setCorrectQuantity(!detail.needsRecheck && Boolean(last?.correctedValues));
    const quantities = Array.isArray(detail.sourceRow.quantity) ? detail.sourceRow.quantity : [];
    const edited = editableSourceQuantities(quantities);
    for (const correction of detail.needsRecheck ? [] : (last?.correctedValues ?? [])) {
      if (!edited[correction.quantityIndex]) continue;
      edited[correction.quantityIndex] = {
        amount: correction.amount == null ? "" : String(correction.amount),
        unit: correction.unit ?? "",
        dailyValuePercents: correction.dailyValuePercents.map((percent) =>
          percent == null ? "" : String(percent)),
      };
    }
    setEditedQuantities(edited);
    setCorrectionReason(detail.needsRecheck ? "" : (last?.correctionReason ?? ""));
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
    if (!actionableSpan) {
      setError("No review occurrences remain. Refresh the selector if another admin has added work.");
      return;
    }
    if (!Number.isSafeInteger(first) || !Number.isSafeInteger(last)
      || first < actionableSpan.first + 1 || last > actionableSpan.last + 1 || first > last) {
      setError(`Choose a range from ${actionableSpan.first + 1} to ${actionableSpan.last + 1}, with the start before the end.`);
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
      window.sessionStorage.setItem(`group1-review-range:${batchKey}`, JSON.stringify(selectedRange));
      setSkippedIds(new Set());
      router.push("/admin/catalog/group1-review");
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
      {mode === "selector" ? <>
      <div className="rounded-[8px] border border-white/10 bg-[#0D1117] p-5">
        <h2 className="font-headline text-2xl font-bold">General nutrition review</h2>
        <p className="mt-2 text-sm text-text-secondary">
          Review one DSLD label occurrence at a time. These decisions do not approve a name globally or write catalog nutrition facts yet.
        </p>
        <p className="mt-2 text-xs text-text-muted">{actionableSpan
          ? `${pendingCount} to review, spanning occurrences #${actionableSpan.first + 1}–#${actionableSpan.last + 1} of ${tasks.length}`
          : `0 to review of ${tasks.length} occurrences`} · {recheckCount} rechecks · {escalatedCount} escalated · queue {batchKey}</p>
        <div className="mt-4 flex flex-wrap items-end gap-3 rounded border border-white/10 bg-[#080D12] p-3">
          <label className="text-xs font-semibold">Start at occurrence
            <input type="number" min={actionableSpan ? actionableSpan.first + 1 : undefined} max={actionableSpan ? actionableSpan.last + 1 : undefined}
              value={rangeStartInput} onChange={(event) => setRangeStartInput(event.target.value)}
              className={`${inputClass} mt-1 w-28`} />
          </label>
          <label className="text-xs font-semibold">End at occurrence
            <input type="number" min={actionableSpan ? actionableSpan.first + 1 : undefined} max={actionableSpan ? actionableSpan.last + 1 : undefined}
              value={rangeEndInput} onChange={(event) => setRangeEndInput(event.target.value)}
              className={`${inputClass} mt-1 w-28`} />
          </label>
          <button type="button" onClick={applyRange} disabled={rangeLoading || saving || !actionableSpan}
            className="rounded-full border border-accent px-4 py-2 text-sm font-semibold text-accent disabled:opacity-40">
            {rangeLoading ? "Refreshing…" : "Start / refresh range"}
          </button>
          <p className="text-xs text-text-muted">Agree on non-overlapping ranges with other admins. Your chosen range stays fixed during review; returning here refreshes the suggested remaining span. Completed rows within your range are skipped, and overlapping decisions are blocked at save.</p>
        </div>
        {escalatedCount ? <details className="mt-3 rounded border border-amber-400/25 p-3 text-sm">
          <summary className="cursor-pointer font-semibold text-amber-200">Escalations needing another admin ({escalatedCount})</summary>
          <p className="mt-2 text-xs text-text-secondary">These remain outside the automatic pending queue. An admin other than the one who escalated each row can open it here.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {tasks.filter((task) => task.status === "escalated").map((task) => <button key={task.id} type="button"
              onClick={() => {
                window.sessionStorage.setItem(`group1-review-open-task:${batchKey}`, task.id);
                router.push("/admin/catalog/group1-review");
              }}
              className="rounded border border-white/15 px-3 py-2 text-left text-xs hover:border-accent">
              #{tasks.indexOf(task) + 1} · {task.suggestedFieldName} · {task.printedName}
            </button>)}
          </div>
        </details> : null}
      </div>
      </> : <Link href="/admin/catalog?view=group1-review"
        className="inline-flex rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-text-primary hover:border-accent hover:text-accent">
        ← Back to range selector
      </Link>}
      {error ? <p role="alert" className="rounded border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">{error}</p> : null}
      {notice ? <p role="status" className="rounded border border-accent/40 bg-accent/10 p-3 text-sm text-accent">{notice}</p> : null}
      {mode === "queue" ?
      <div className="rounded-[8px] border border-white/10 bg-[#0D1117] p-4">
        {selectedTaskId ? <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-accent">
          {detail?.status === "escalated" ? "Escalation" : "Occurrence"} {currentPosition} of {tasks.length}
          {detail?.status !== "escalated" ? ` · assigned range ${range.first + 1}–${range.last + 1} · ${skippedCount} skipped this pass` : " · a different admin must resolve this"}
        </p> : null}
          {!detail || detail.id !== selectedTaskId ? <div className="space-y-3 text-sm text-text-secondary">
            <p>{selectedTaskId ? "Loading the next label…" : rangePendingCount === 0 ? "No review occurrences remain in your assigned range." : "You reached the end of your assigned range for this pass."}</p>
            {rangePendingCount > 0 && skippedCount > 0 ? <button type="button" onClick={revisitSkipped}
              className="rounded-full border border-accent px-5 py-2 font-semibold text-accent">Revisit skipped occurrences ({skippedCount})</button> : null}
            {escalatedCount ? <p>{escalatedCount} escalated occurrence{escalatedCount === 1 ? "" : "s"} still need a different admin’s decision.</p> : null}
          </div> : <div className="space-y-5">
            {detail.needsRecheck ? <div className="rounded border border-amber-400/45 bg-amber-400/10 p-3 text-sm">
              <p className="font-semibold text-amber-200">Recheck requested — previous decision remains in history</p>
              <p className="mt-1 text-text-secondary">{detail.recheckReason}</p>
              <p className="mt-1 text-xs text-text-secondary">Choose a new outcome and explain it in a reviewer note. Amount edits were reset to the DSLD source for safety; compare any previous correction with this exact label before re-entering it.</p>
            </div> : null}
            <div>
              <h3 className="font-headline text-xl font-bold">{detail.labelName || `DSLD ${detail.dsldLabelId}`}</h3>
              <p className="text-sm text-text-secondary">{detail.brandName} · DSLD {detail.dsldLabelId}</p>
              <div className="mt-4 grid items-start gap-3 sm:grid-cols-[1fr_auto_1fr]">
                <div className="rounded border border-amber-400/35 bg-amber-400/5 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-200">Name extracted by DSLD</p>
                  <p className="mt-1 break-words text-xl font-bold text-text-primary">“{detail.printedName}”</p>
                </div>
                <span aria-hidden="true" className="hidden self-center text-center text-xl text-text-muted sm:block">→</span>
                <div className="rounded border border-accent/40 bg-accent/5 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-accent">Our suggested field</p>
                      <p className="mt-1 break-words text-xl font-bold text-text-primary">{detail.suggestedFieldName}</p>
                    </div>
                    <button type="button" aria-label={fieldEditorOpen ? "Hide Group 1 field choices" : "Change to a different Group 1 field"}
                      aria-expanded={fieldEditorOpen} aria-controls="group1-field-editor"
                      onClick={() => setFieldEditorOpen((open) => !open)}
                      className="shrink-0 whitespace-nowrap text-right text-xs font-semibold text-accent underline underline-offset-2 hover:text-accent/80">
                      {fieldEditorOpen ? "Hide choices" : "Change field"}
                    </button>
                  </div>
                  {outcome === "accepted" && fieldKey !== detail.suggestedFieldKey ? <p className="mt-2 text-sm text-text-primary">
                    Selected instead: <span className="font-semibold">{fields.find((field) => field.fieldKey === fieldKey)?.displayName ?? fieldKey}</span>
                  </p> : null}
                  {fieldEditorOpen ? <div id="group1-field-editor" className="mt-3">
                    <label className="block text-sm font-semibold">Group 1 field
                      <select value={fieldKey} onChange={(event) => { setFieldKey(event.target.value); setOutcome("accepted"); }} className={`${inputClass} mt-1`}>
                        {fields.map((field) => <option key={field.fieldKey} value={field.fieldKey}>{field.displayName}</option>)}
                      </select>
                    </label>
                    <p className="mt-2 text-xs text-text-secondary">Choosing a field selects “Group 1 field” as the decision below.</p>
                  </div> : null}
                </div>
              </div>
              <p className="mt-2 text-xs text-text-muted">DSLD wording may differ from the printed image.</p>
              {detail.sourceAncestorNames.length ? <p className="mt-1 text-xs text-text-muted">Source parents: {detail.sourceAncestorNames.join(" → ")}</p> : null}
            </div>
            <div className="grid items-start gap-4 md:grid-cols-[minmax(0,3fr)_minmax(300px,2fr)]">
              <div className="min-w-0">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h4 className="font-semibold">Original label</h4>
                  <a href={detail.labelPdfUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-accent underline">Open label PDF</a>
                </div>
                <Group1LabelPreview key={detail.id} labelId={detail.dsldLabelId}
                  sourceName={detail.printedName} suggestedFieldName={detail.suggestedFieldName}
                  onScanSettled={() => setScanReadyFor(detail.id)} />
              </div>
              <div className="space-y-4">
                <div className="rounded border border-amber-400/30 bg-amber-400/5 p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="font-semibold text-amber-200">Verify amount, unit &amp; % DV</h4>
                      <p className="mt-0.5 text-xs text-text-secondary">Check the label. “Not recorded” is not zero.</p>
                    </div>
                    {sourceQuantities.length === 1 ? <p className="shrink-0 text-right text-xs font-medium text-text-primary">
                      {sourceQuantities[0].servingSizeQuantity == null
                        ? "Serving size not recorded"
                        : `Based on serving size of ${sourceQuantities[0].servingSizeQuantity} ${sourceQuantities[0].servingSizeUnit ?? ""}`.trim()}
                    </p> : null}
                  </div>
                  {sourceQuantities.length ? sourceQuantities.map((quantity, index) =>
                    <div key={index} className="mt-3">
                      {sourceQuantities.length > 1 ? <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-2 text-xs">
                        <span className="text-text-muted">DSLD value {index + 1} of {sourceQuantities.length}</span>
                        <span className="text-right font-medium text-text-primary">{quantity.servingSizeQuantity == null
                          ? "Serving size not recorded"
                          : `Based on serving size of ${quantity.servingSizeQuantity} ${quantity.servingSizeUnit ?? ""}`.trim()}</span>
                      </div> : null}
                      <dl className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.5fr)] divide-x divide-white/10 rounded border border-white/10 bg-[#080D12]">
                        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 px-2 py-2">
                          <dt className="text-xs text-text-muted">Amount</dt>
                          <dd className="break-words font-semibold text-text-primary">
                            {nonEqualityOperator(quantity.operator) ? <span aria-label="Amount operator" className="mr-1">{nonEqualityOperator(quantity.operator)}</span> : null}
                            {quantity.quantity == null ? "Not recorded" : quantity.quantity}
                          </dd>
                        </div>
                        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 px-2 py-2">
                          <dt className="text-xs text-text-muted">Unit</dt>
                          <dd className="break-words font-semibold text-text-primary">{quantity.unit?.trim() || "Not recorded"}</dd>
                        </div>
                        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 px-2 py-2">
                          <dt className="text-xs text-text-muted">% DV</dt>
                          <dd className="min-w-0 break-words font-semibold text-text-primary">
                            {quantity.dailyValueTargetGroup?.length ? quantity.dailyValueTargetGroup.map((target, targetIndex) =>
                              <div key={targetIndex}>
                                {target.name ? <span className="mr-1 text-xs font-normal text-text-secondary">{target.name}:</span> : null}
                                <span>{target.percent == null ? target.footnote?.trim() || "Not recorded" : `${target.percent}%`}</span>
                                {nonEqualityOperator(target.operator) ? <span className="ml-2 text-xs font-normal text-text-secondary">DV operator: {nonEqualityOperator(target.operator)}</span> : null}
                              </div>
                            ) : "Not recorded"}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  ) : <p className="mt-2 text-text-muted">No source quantity or Daily Value.</p>}
                  {detail.sourceRow.notes ? <p className="mt-2 text-xs text-text-muted">Source note: {detail.sourceRow.notes}</p> : null}
                  <button type="button" aria-expanded={correctQuantity} aria-controls="group1-quantity-editor"
                    onClick={() => { setCorrectQuantity((open) => !open); if (!correctQuantity) setOutcome("accepted"); }}
                    className="mt-3 text-left text-sm font-semibold text-amber-200 underline underline-offset-2 hover:text-amber-100">
                    {correctQuantity ? "Hide value corrections" : "Edit printed amount, unit, or % DV"}
                  </button>
                  {correctQuantity ? <div id="group1-quantity-editor" className="mt-3 space-y-3">
                    <p className="text-xs text-text-secondary">Editing values selects “Group 1 field” as the decision below. Leave % DV blank if the label does not state one; enter 0 only when it says 0%.</p>
                    {editedQuantities.map((item, index) => <div key={index} className="rounded border border-amber-400/25 bg-[#080D12] p-3">
                      <p className="mb-2 text-xs font-semibold text-amber-200">Corrected value {index + 1}{sourceQuantities[index]?.servingSizeQuantity != null
                        ? ` · per ${sourceQuantities[index].servingSizeQuantity} ${sourceQuantities[index].servingSizeUnit ?? ""}` : ""}</p>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="text-xs">Amount<input className={`${inputClass} mt-1`} type="number" min="0" step="any" value={item.amount}
                          onChange={(event) => editQuantity(index, { amount: event.target.value })} /></label>
                        <label className="text-xs">Unit<input className={`${inputClass} mt-1`} value={item.unit}
                          onChange={(event) => editQuantity(index, { unit: event.target.value })} /></label>
                      </div>
                      {item.dailyValuePercents.map((percent, targetIndex) => <label key={targetIndex} className="mt-2 block text-xs">
                        % Daily Value · {sourceQuantities[index]?.dailyValueTargetGroup?.[targetIndex]?.name ?? "label target group unspecified"}
                        <input className={`${inputClass} mt-1`} type="number" min="0" step="any" value={percent}
                          onChange={(event) => editDailyValue(index, targetIndex, event.target.value)} />
                      </label>)}
                    </div>)}
                    <label className="block text-xs font-semibold">Reason for correction (required)
                      <input className={`${inputClass} mt-1`} value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)}
                        placeholder="What differs on the printed label?" />
                    </label>
                  </div> : null}
                </div>
                <fieldset className="space-y-2">
                  <legend className="mb-2 font-semibold">Decision for this occurrence</legend>
                  {decisions.map((choice) => <label key={choice.value} className={choiceClass}>
                    <input type="radio" name="group1-outcome" value={choice.value} checked={outcome === choice.value}
                      onChange={() => {
                        setOutcome(choice.value);
                        if (choice.value !== "accepted") { setFieldEditorOpen(false); setCorrectQuantity(false); }
                      }} className="mt-1 accent-emerald-400" />
                    <span><span className="block font-semibold">{choice.title}</span><span className="block text-xs text-text-secondary">{choice.explanation}</span></span>
                  </label>)}
                </fieldset>
                <div>
                  {reviewerNoteRequired ? <label htmlFor="group1-reviewer-note" className="block text-sm font-semibold">Reviewer note (required)</label>
                    : <button type="button" aria-expanded={noteEditorOpen} aria-controls="group1-reviewer-note-editor"
                      onClick={() => setNoteEditorOpen((open) => !open)}
                      className="text-left text-sm font-semibold text-accent underline underline-offset-2 hover:text-accent/80">
                      {noteEditorOpen ? "Hide reviewer note" : reviewerNote.trim() ? "Edit reviewer note (optional)" : "Add reviewer note (optional)"}
                    </button>}
                  {reviewerNoteRequired || noteEditorOpen ? <div id="group1-reviewer-note-editor" className="mt-2">
                    <textarea id="group1-reviewer-note" aria-label="Reviewer note" className={`${inputClass} min-h-20`}
                      value={reviewerNote} onChange={(event) => setReviewerNote(event.target.value)} />
                  </div> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={save} disabled={!outcome || saving}
                    className="rounded-full bg-accent px-5 py-2 text-sm font-bold text-[#03100E] disabled:opacity-40">{saving ? "Saving…" : "Save decision"}</button>
                  <button type="button" onClick={skip} disabled={saving} className="rounded-full border border-white/15 px-5 py-2 text-sm font-semibold disabled:opacity-40">Skip for now</button>
                </div>
              </div>
            </div>
            {detail.decisions.length ? <div className="border-t border-white/10 pt-4">
              <h4 className="mb-2 font-semibold">Decision history</h4>
              {detail.decisions.map((decision) => <p key={decision.taskRevision} className="mb-2 text-xs text-text-secondary">
                Rev {decision.taskRevision}: {statusLabel(decision.outcome)} by {decision.reviewerEmail} · {new Date(decision.decidedAt).toLocaleString()}
                {decision.selectedFieldKey ? ` · field ${fields.find((field) => field.fieldKey === decision.selectedFieldKey)?.displayName ?? decision.selectedFieldKey}` : ""}
                {decision.reviewerNote ? ` — ${decision.reviewerNote}` : ""}
                {decision.correctedValues ? ` · corrected values: ${decision.correctedValues.map((value) => `${value.amount ?? "blank"} ${value.unit ?? ""}; DV ${value.dailyValuePercents.map((percent) => percent == null ? "blank" : `${percent}%`).join("/")}`).join(" | ")}` : ""}
                {decision.correctionReason ? ` · correction reason: ${decision.correctionReason}` : ""}
              </p>)}
            </div> : null}
          </div>}
        {prefetchTask ? <Group1LabelPreview key={`preload-${prefetchTask.id}`} prefetchOnly
          labelId={prefetchTask.dsldLabelId} sourceName={prefetchTask.printedName}
          suggestedFieldName={prefetchTask.suggestedFieldName} onScanSettled={() => setPreloadStep((current) => current + 1)} /> : null}
      </div> : null}
    </section>
  );
}
