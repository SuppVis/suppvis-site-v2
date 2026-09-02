"use client";

import { useState } from "react";
import type { CatalogEditorDraft, CatalogReplacementSelection } from "./catalog-draft";
import type { CatalogFormulaTemplateCandidate, CatalogTemplateDiffResponse } from "./contracts.generated";

export default function CatalogReplacementReview({ candidate, result, draft, onApply, onReject }: {
  candidate: CatalogFormulaTemplateCandidate;
  result: CatalogTemplateDiffResponse;
  draft: CatalogEditorDraft;
  onApply: (selection: CatalogReplacementSelection) => void;
  onReject: () => void;
}) {
  const [selection, setSelection] = useState<CatalogReplacementSelection>({
    labelName: false, brandName: false, servingSize: false, formula: false, nutritionKeys: [],
  });
  const hasSelection = selection.labelName || selection.brandName || selection.servingSize
    || selection.formula || selection.nutritionKeys.length > 0;
  function choice(key: "labelName" | "brandName" | "servingSize" | "formula", label: string) {
    return <label className="flex items-center gap-2 font-semibold"><input type="checkbox" checked={selection[key]} onChange={(event) => setSelection((current) => ({ ...current, [key]: event.target.checked }))} />{label}</label>;
  }
  function comparison(before: unknown, after: unknown) {
    return <div className="mt-2 grid gap-2 md:grid-cols-2"><div><p className="font-semibold">Before</p><pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words">{JSON.stringify(before, null, 2)}</pre></div><div><p className="font-semibold">Proposed</p><pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words">{JSON.stringify(after, null, 2)}</pre></div></div>;
  }
  return <section aria-label="Replacement review" className="space-y-4 rounded-[8px] border border-warning/30 bg-warning/5 p-4 text-xs text-text-secondary">
    <div><p className="font-semibold uppercase tracking-[0.16em] text-warning">Read-only replacement diff</p><h2 className="mt-1 font-headline text-xl font-bold">{candidate.sourceLabel} versus revision {result.comparedRevision}</h2><p className="mt-2">Choose the values to put into the editor. Unchecked fields and local edits stay unchanged. Nothing is written until Save draft.</p></div>
    {candidate.sourceProductName ? <div>{choice("labelName", "Use proposed product label")}{comparison(draft.labelName, candidate.sourceProductName)}</div> : null}
    {candidate.sourceBrandName ? <div>{choice("brandName", "Use proposed brand")}{comparison(draft.brandName, candidate.sourceBrandName)}</div> : null}
    {candidate.servingSize ? <div>{choice("servingSize", "Use proposed serving size")}{comparison(result.servingSize.before, result.servingSize.after)}</div> : <p>No complete proposed serving size; the current basis will be retained.</p>}
    <div>{choice("formula", "Use proposed active hierarchy")}<p className="mt-1">Review the complete hierarchy together so parent/child membership and order remain intact. You can edit individual rows before saving.</p>{result.componentChanges.map((change, index) => <details key={`${change.path}:${index}`} open><summary>{change.kind}: {change.path}</summary>{comparison(change.before, change.after)}</details>)}{result.componentChanges.length === 0 ? <p>No active-component differences.</p> : null}</div>
    {result.nutritionFactChanges.map((change) => <div key={change.factKey}><label className="flex items-center gap-2 font-semibold"><input type="checkbox" checked={selection.nutritionKeys.includes(change.factKey)} onChange={(event) => setSelection((current) => ({ ...current, nutritionKeys: event.target.checked ? [...current.nutritionKeys, change.factKey] : current.nutritionKeys.filter((key) => key !== change.factKey) }))} />Use proposed nutrition: {change.factKey} ({change.kind})</label>{comparison(change.before, change.after)}</div>)}
    {result.reviewReasons.map((reason) => <p key={reason} className="text-warning">Review: {reason}</p>)}
    <div className="flex gap-2"><button type="button" disabled={!hasSelection} onClick={() => onApply(selection)} className="rounded-full bg-accent px-3 py-2 font-bold text-[#03100E] disabled:opacity-40">Apply selected values to editor</button><button type="button" onClick={onReject} className="rounded-full border border-white/15 px-3 py-2 font-semibold">Reject source</button></div>
  </section>;
}
