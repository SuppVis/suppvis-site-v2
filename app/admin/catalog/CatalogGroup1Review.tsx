"use client";

import { useEffect, useMemo, useState } from "react";
import { Group1LabelPreview } from "./Group1LabelPreview";
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

type ReviewGroup = { key: string; field: ReviewField; name: string; tasks: ReviewTask[]; pending: number };
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
  const [selectedGroup, setSelectedGroup] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [detail, setDetail] = useState<ReviewTaskDetail | null>(null);
  const [statusFilter, setStatusFilter] = useState<"open" | "all">("open");
  const [outcome, setOutcome] = useState<ReviewOutcome | "">("");
  const [fieldKey, setFieldKey] = useState("");
  const [reviewerNote, setReviewerNote] = useState("");
  const [correctQuantity, setCorrectQuantity] = useState(false);
  const [editedQuantities, setEditedQuantities] = useState<EditableQuantity[]>([]);
  const [correctionReason, setCorrectionReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const groups = useMemo(() => {
    const byKey = new Map<string, ReviewGroup>();
    const byField = new Map(fields.map((field) => [field.fieldKey, field]));
    for (const task of tasks) {
      const field = byField.get(task.suggestedFieldKey);
      if (!field) continue;
      const key = `${field.fieldKey}\0${task.printedName}`;
      let group = byKey.get(key);
      if (!group) {
        group = { key, field, name: task.printedName, tasks: [], pending: 0 };
        byKey.set(key, group);
      }
      group.tasks.push(task);
      if (task.status === "pending" || task.status === "escalated") group.pending++;
    }
    return [...byKey.values()].sort((a, b) =>
      a.field.sortOrder - b.field.sortOrder || a.name.localeCompare(b.name)
    );
  }, [fields, tasks]);
  const activeGroup = groups.find((group) => group.key === selectedGroup) ?? groups[0];
  const visibleGroups = statusFilter === "open" ? groups.filter((group) => group.pending > 0) : groups;
  const openCount = tasks.filter((task) => task.status === "pending" || task.status === "escalated").length;
  const sourceQuantities = Array.isArray(detail?.sourceRow.quantity) ? detail.sourceRow.quantity : [];

  useEffect(() => {
    let cancelled = false;
    getReviewList().then((result) => {
      if (cancelled) return;
      setFields(result.fields);
      setTasks(result.tasks);
      setBatchKey(result.batchKey);
      const first = result.tasks.find((task) => task.status === "pending") ?? result.tasks[0];
      setSelectedTaskId(first?.id ?? "");
      setSelectedGroup(first ? `${first.suggestedFieldKey}\0${first.printedName}` : "");
    }).catch((reason) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : "Unable to load reviews.");
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
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

  function chooseGroup(group: ReviewGroup) {
    setSelectedGroup(group.key);
    const next = group.tasks.find((task) => task.status === "pending" || task.status === "escalated") ?? group.tasks[0];
    setSelectedTaskId(next.id);
    setNotice("");
  }

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
    const next = activeGroup?.tasks.find((task) => task.id !== selectedTaskId && task.status === "pending")
      ?? tasks.find((task) => task.id !== selectedTaskId && task.status === "pending");
    if (next) {
      setSelectedGroup(`${next.suggestedFieldKey}\0${next.printedName}`);
      setSelectedTaskId(next.id);
      setNotice("");
    } else setNotice("No other pending occurrence is available. This one remains unchanged.");
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
      setDetail(updated);
      setTasks((current) => current.map((task) => task.id === updated.id ? updated : task));
      setNotice("Decision saved for this label occurrence.");
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
        <p className="mt-2 text-xs text-text-muted">{openCount} open of {tasks.length} occurrences · {groups.length} extracted names · batch {batchKey}</p>
      </div>
      {error ? <p role="alert" className="rounded border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">{error}</p> : null}
      {notice ? <p role="status" className="rounded border border-accent/40 bg-accent/10 p-3 text-sm text-accent">{notice}</p> : null}
      <div className="grid gap-4 xl:grid-cols-[20rem_20rem_minmax(0,1fr)]">
        <aside className="max-h-[75vh] overflow-y-auto rounded-[8px] border border-white/10 bg-[#0D1117] p-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="font-semibold">Suggested fields & extracted names</h3>
            <select aria-label="Review group filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "open" | "all")}
              className="rounded border border-white/15 bg-[#080D12] px-2 py-1 text-xs">
              <option value="open">Open</option><option value="all">All</option>
            </select>
          </div>
          {fields.map((field) => {
            const fieldGroups = visibleGroups.filter((group) => group.field.fieldKey === field.fieldKey);
            if (!fieldGroups.length) return null;
            return <div key={field.fieldKey} className="mb-4">
              <p className="mb-1 border-b border-white/10 pb-1 text-xs font-bold uppercase tracking-wide text-accent">{field.displayName}</p>
              {fieldGroups.map((group) => <button key={group.key} type="button" onClick={() => chooseGroup(group)}
                aria-current={activeGroup?.key === group.key ? "true" : undefined}
                className={`mb-1 flex w-full justify-between gap-2 rounded px-2 py-2 text-left text-sm ${activeGroup?.key === group.key ? "bg-accent/15 text-accent" : "hover:bg-white/5"}`}>
                <span className="break-words">{group.name}</span><span className="shrink-0 text-xs text-text-muted">{group.pending}/{group.tasks.length}</span>
              </button>)}
            </div>;
          })}
        </aside>
        <aside className="max-h-[75vh] overflow-y-auto rounded-[8px] border border-white/10 bg-[#0D1117] p-3">
          <p className="mb-1 text-xs uppercase tracking-wide text-text-muted">Name extracted by DSLD</p>
          <h3 className="mb-3 font-semibold">{activeGroup ? `“${activeGroup.name}”` : "Occurrences"}</h3>
          {activeGroup?.tasks.map((task) => <button key={task.id} type="button" onClick={() => { setSelectedTaskId(task.id); setNotice(""); }}
            className={`mb-2 w-full rounded border p-3 text-left text-sm ${selectedTaskId === task.id ? "border-accent bg-accent/5" : "border-white/10 hover:border-white/25"}`}>
            <span className="block font-semibold">{task.labelName || `DSLD ${task.dsldLabelId}`}</span>
            <span className="mt-1 block text-xs text-text-muted">{task.brandName} · DSLD {task.dsldLabelId}</span>
            <span className="mt-1 block text-xs capitalize text-text-secondary">{statusLabel(task.status)}</span>
          </button>)}
        </aside>
        <div className="min-w-0 rounded-[8px] border border-white/10 bg-[#0D1117] p-4">
          {!detail ? <p className="text-sm text-text-muted">Select an occurrence to review its label.</p> : <div className="space-y-5">
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
              <Group1LabelPreview key={detail.dsldLabelId} labelId={detail.dsldLabelId} />
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
              <button type="button" onClick={skip} className="rounded-full border border-white/15 px-5 py-2 text-sm font-semibold">Skip for now</button>
            </div>
            {detail.decisions.length ? <div className="border-t border-white/10 pt-4">
              <h4 className="mb-2 font-semibold">Decision history</h4>
              {detail.decisions.map((decision) => <p key={decision.taskRevision} className="mb-2 text-xs text-text-secondary">
                Rev {decision.taskRevision}: {statusLabel(decision.outcome)} by {decision.reviewerEmail} · {new Date(decision.decidedAt).toLocaleString()}
                {decision.reviewerNote ? ` — ${decision.reviewerNote}` : ""}
              </p>)}
            </div> : null}
          </div>}
        </div>
      </div>
    </section>
  );
}
