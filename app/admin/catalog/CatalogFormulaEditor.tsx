"use client";

import { useState } from "react";
import { searchCanonicalSupplements } from "./catalog-api";
import {
  CATALOG_APP_DOSE_UNITS,
  CATALOG_TIMING_BLOCKS,
  localDraftId,
  newIngredientDraft,
  type CatalogComponentDraft,
  type CatalogEditorDraft,
  type CatalogGroupDraft,
  type CatalogIngredientDraft,
} from "./catalog-draft";
import type {
  CatalogFollowUpReason,
  CatalogNutritionFactKey,
  CatalogTemplateCanonicalCandidate,
} from "./contracts.generated";

const inputClass = "w-full rounded border border-white/15 bg-[#080D12] px-3 py-2 text-sm text-text-primary outline-none focus:border-accent";
const labelClass = "block text-xs font-semibold uppercase tracking-[0.1em] text-text-muted";

const nutritionKeys: CatalogNutritionFactKey[] = [
  "calories", "total_fat", "saturated_fat", "trans_fat", "cholesterol", "sodium",
  "total_carbohydrate", "dietary_fiber", "total_sugars", "added_sugars", "protein", "custom",
];

const followUpReasons: CatalogFollowUpReason[] = [
  "legacy_pre_web_contract_review",
  "legacy_single_leaf_blend",
  "legacy_missing_source_images",
  "legacy_nutrition_component_candidate",
  "legacy_formula_review",
  "legacy_barcode_review",
  "admin_marked_follow_up",
];

function swap<T>(items: T[], index: number, direction: -1 | 1) {
  const target = index + direction;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function IngredientEditor({
  ingredient,
  onChange,
  onRemove,
}: {
  ingredient: CatalogIngredientDraft;
  onChange: (ingredient: CatalogIngredientDraft) => void;
  onRemove: () => void;
}) {
  const [query, setQuery] = useState(ingredient.labelName);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  async function search() {
    if (!query.trim()) return;
    setSearching(true);
    setSearchError(null);
    try {
      const response = await searchCanonicalSupplements(query.trim());
      const candidates: CatalogTemplateCanonicalCandidate[] = response.results.map((result) => ({
        canonicalKey: result.canonicalKey,
        canonicalName: result.canonicalName,
        matchReason: result.category ? `Library category: ${result.category}` : "Research-library search",
      }));
      onChange({
        ...ingredient,
        candidates,
        resolution: candidates.length === 0 ? "unresolved" : "ambiguous",
        canonicalKey: null,
        canonicalName: null,
      });
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : "Library search failed.");
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="rounded border border-white/10 bg-[#0B1016] p-3">
      <div className="grid gap-3 xl:grid-cols-[1.4fr_0.75fr_1fr_auto] xl:items-end">
        <label className={labelClass}>
          Exact label ingredient
          <input value={ingredient.labelName} onChange={(event) => onChange({ ...ingredient, labelName: event.target.value })} className={`${inputClass} mt-1`} />
        </label>
        <label className={labelClass}>
          Amount status
          <select
            value={ingredient.amountDisclosureStatus}
            onChange={(event) => onChange({
              ...ingredient,
              amountDisclosureStatus: event.target.value as CatalogIngredientDraft["amountDisclosureStatus"],
              amountText: event.target.value === "not_disclosed" ? "" : ingredient.amountText,
            })}
            className={`${inputClass} mt-1`}
          >
            <option value="not_disclosed">Not disclosed</option>
            <option value="disclosed">Disclosed</option>
          </select>
        </label>
        <label className={labelClass}>
          Exact amount text
          <input disabled={ingredient.amountDisclosureStatus === "not_disclosed"} value={ingredient.amountText} onChange={(event) => onChange({ ...ingredient, amountText: event.target.value })} className={`${inputClass} mt-1 disabled:opacity-40`} placeholder="e.g. 250 mg" />
        </label>
        <button type="button" onClick={onRemove} className="rounded border border-white/15 px-3 py-2 text-xs font-semibold text-error">Remove</button>
      </div>

      <div className="mt-3 rounded border border-white/10 bg-[#080D12] p-3">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end">
          <label className={`${labelClass} flex-1`}>
            Research-library identity
            <input value={query} onChange={(event) => setQuery(event.target.value)} className={`${inputClass} mt-1`} placeholder="Search exact name or alias" />
          </label>
          <button type="button" disabled={searching || !query.trim()} onClick={() => void search()} className="rounded-full border border-white/15 px-3 py-2 text-xs font-semibold disabled:opacity-40">
            {searching ? "Searching…" : "Search library"}
          </button>
          <button
            type="button"
            onClick={() => onChange({ ...ingredient, resolution: "not_in_research_library", canonicalKey: null, canonicalName: null, candidates: [] })}
            className="rounded-full border border-white/15 px-3 py-2 text-xs font-semibold"
          >
            Not in library
          </button>
        </div>
        {ingredient.resolution === "matched" ? (
          <p className="mt-2 text-sm text-accent">Matched: {ingredient.canonicalName ?? ingredient.canonicalKey}</p>
        ) : ingredient.resolution === "not_in_research_library" ? (
          <p className="mt-2 text-sm text-warning">Explicitly marked not in the research library.</p>
        ) : (
          <p className="mt-2 text-sm text-warning">Resolve this {ingredient.resolution} match before saving.</p>
        )}
        {searchError ? <p className="mt-2 text-xs text-error">{searchError}</p> : null}
        {ingredient.candidates.length > 0 ? (
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            {ingredient.candidates.map((candidate) => (
              <button
                key={candidate.canonicalKey}
                type="button"
                onClick={() => onChange({
                  ...ingredient,
                  resolution: "matched",
                  canonicalKey: candidate.canonicalKey,
                  canonicalName: candidate.canonicalName,
                })}
                className="rounded border border-white/10 p-2 text-left text-xs hover:border-accent/60"
              >
                <span className="block font-semibold text-text-primary">Use {candidate.canonicalName}</span>
                <span className="mt-1 block text-text-muted">{candidate.matchReason}</span>
              </button>
            ))}
          </div>
        ) : null}
        {ingredient.reviewReasons.length > 0 ? <p className="mt-2 text-xs text-text-muted">Source review: {ingredient.reviewReasons.join(", ")}</p> : null}
      </div>
    </div>
  );
}

function FormulaSection({ draft, onChange }: { draft: CatalogEditorDraft; onChange: (draft: CatalogEditorDraft) => void }) {
  function updateComponent(index: number, component: CatalogComponentDraft) {
    onChange({ ...draft, components: draft.components.map((entry, entryIndex) => entryIndex === index ? component : entry) });
  }
  function removeComponent(index: number) {
    onChange({ ...draft, components: draft.components.filter((_, entryIndex) => entryIndex !== index) });
  }
  return (
    <section className="rounded-[8px] border border-white/10 bg-[#0D1117] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Formula</p>
          <h2 className="mt-1 font-headline text-xl font-bold">Active hierarchy and matching</h2>
          <p className="mt-1 text-xs text-text-muted">Product type and primary canonical identity are derived from active leaves; there is no type selector.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => onChange({ ...draft, components: [...draft.components, newIngredientDraft()] })} className="rounded-full border border-white/15 px-3 py-2 text-xs font-semibold">Add ingredient</button>
          <button
            type="button"
            onClick={() => onChange({
              ...draft,
              components: [...draft.components, {
                id: localDraftId(),
                componentType: "proprietary_blend",
                labelName: "",
                amountText: "",
                children: [newIngredientDraft()],
                reviewReasons: [],
              }],
            })}
            className="rounded-full border border-white/15 px-3 py-2 text-xs font-semibold"
          >
            Add proprietary group
          </button>
        </div>
      </div>
      {draft.hierarchyReviewRequired ? (
        <label className="mt-4 flex gap-3 rounded border border-warning/40 bg-warning/5 p-3 text-sm text-warning">
          <input type="checkbox" checked={draft.hierarchyReviewAcknowledged} onChange={(event) => onChange({ ...draft, hierarchyReviewAcknowledged: event.target.checked })} />
          I reviewed and corrected the proposed ingredient hierarchy.
        </label>
      ) : null}
      {draft.sourceReviewReasons.length > 0 ? <p className="mt-3 text-xs text-text-muted">Template review: {draft.sourceReviewReasons.join(", ")}</p> : null}
      <div className="mt-4 space-y-4">
        {draft.components.map((component, index) => (
          <div key={component.id} className="rounded-[8px] border border-white/10 bg-[#080D12] p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">{component.componentType === "ingredient" ? "Top-level ingredient" : "Proprietary blend group"}</p>
              <div className="flex gap-1">
                <button type="button" aria-label="Move component up" onClick={() => onChange({ ...draft, components: swap(draft.components, index, -1) })} className="rounded border border-white/10 px-2 py-1 text-xs">↑</button>
                <button type="button" aria-label="Move component down" onClick={() => onChange({ ...draft, components: swap(draft.components, index, 1) })} className="rounded border border-white/10 px-2 py-1 text-xs">↓</button>
              </div>
            </div>
            {component.componentType === "ingredient" ? (
              <IngredientEditor ingredient={component} onChange={(ingredient) => updateComponent(index, ingredient)} onRemove={() => removeComponent(index)} />
            ) : (
              <GroupEditor group={component} onChange={(group) => updateComponent(index, group)} onRemove={() => removeComponent(index)} />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function GroupEditor({ group, onChange, onRemove }: { group: CatalogGroupDraft; onChange: (group: CatalogGroupDraft) => void; onRemove: () => void }) {
  return (
    <div>
      <div className="grid gap-3 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
        <label className={labelClass}>Group label<input value={group.labelName} onChange={(event) => onChange({ ...group, labelName: event.target.value })} className={`${inputClass} mt-1`} /></label>
        <label className={labelClass}>Disclosed total text<input value={group.amountText} onChange={(event) => onChange({ ...group, amountText: event.target.value })} className={`${inputClass} mt-1`} placeholder="e.g. 1,250 mg" /></label>
        <button type="button" onClick={onRemove} className="rounded border border-white/15 px-3 py-2 text-xs font-semibold text-error">Remove group</button>
      </div>
      {group.reviewReasons.length > 0 ? <p className="mt-2 text-xs text-text-muted">Source review: {group.reviewReasons.join(", ")}</p> : null}
      <div className="mt-3 space-y-3 border-l border-accent/30 pl-3">
        {group.children.map((child, childIndex) => (
          <div key={child.id}>
            <div className="mb-1 flex justify-end gap-1">
              <button type="button" aria-label="Move child up" onClick={() => onChange({ ...group, children: swap(group.children, childIndex, -1) })} className="rounded border border-white/10 px-2 py-1 text-xs">↑</button>
              <button type="button" aria-label="Move child down" onClick={() => onChange({ ...group, children: swap(group.children, childIndex, 1) })} className="rounded border border-white/10 px-2 py-1 text-xs">↓</button>
            </div>
            <IngredientEditor
              ingredient={child}
              onChange={(ingredient) => onChange({ ...group, children: group.children.map((entry, index) => index === childIndex ? ingredient : entry) })}
              onRemove={() => onChange({ ...group, children: group.children.filter((_, index) => index !== childIndex) })}
            />
          </div>
        ))}
      </div>
      <button type="button" onClick={() => onChange({ ...group, children: [...group.children, newIngredientDraft()] })} className="mt-3 rounded-full border border-white/15 px-3 py-2 text-xs font-semibold">Add child ingredient</button>
    </div>
  );
}

function NutritionSection({ draft, onChange }: { draft: CatalogEditorDraft; onChange: (draft: CatalogEditorDraft) => void }) {
  return (
    <section className="rounded-[8px] border border-white/10 bg-[#0D1117] p-4">
      <div className="flex items-center justify-between gap-3">
        <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Nutrition</p><h2 className="mt-1 font-headline text-xl font-bold">Structured facts</h2></div>
        <button
          type="button"
          onClick={() => onChange({ ...draft, nutritionFacts: [...draft.nutritionFacts, { id: localDraftId(), factKey: "custom", labelName: "", amountText: "", amountValue: "", amountUnit: "", dailyValuePercent: "", reviewReasons: [] }] })}
          className="rounded-full border border-white/15 px-3 py-2 text-xs font-semibold"
        >
          Add nutrition row
        </button>
      </div>
      <div className="mt-4 space-y-3">
        {draft.nutritionFacts.map((fact, index) => (
          <div key={fact.id} className="grid gap-2 rounded border border-white/10 bg-[#080D12] p-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_0.7fr_0.7fr_auto] xl:items-end">
            <label className={labelClass}>Fact key<select value={fact.factKey} onChange={(event) => onChange({ ...draft, nutritionFacts: draft.nutritionFacts.map((entry, entryIndex) => entryIndex === index ? { ...entry, factKey: event.target.value as CatalogNutritionFactKey } : entry) })} className={`${inputClass} mt-1`}>{nutritionKeys.map((key) => <option key={key} value={key}>{key.replaceAll("_", " ")}</option>)}</select></label>
            <label className={labelClass}>Label name<input value={fact.labelName} onChange={(event) => onChange({ ...draft, nutritionFacts: draft.nutritionFacts.map((entry, entryIndex) => entryIndex === index ? { ...entry, labelName: event.target.value } : entry) })} className={`${inputClass} mt-1`} /></label>
            <label className={labelClass}>Exact amount text<input value={fact.amountText} onChange={(event) => onChange({ ...draft, nutritionFacts: draft.nutritionFacts.map((entry, entryIndex) => entryIndex === index ? { ...entry, amountText: event.target.value } : entry) })} className={`${inputClass} mt-1`} /></label>
            <label className={labelClass}>Value<input inputMode="decimal" value={fact.amountValue} onChange={(event) => onChange({ ...draft, nutritionFacts: draft.nutritionFacts.map((entry, entryIndex) => entryIndex === index ? { ...entry, amountValue: event.target.value } : entry) })} className={`${inputClass} mt-1`} /></label>
            <label className={labelClass}>Unit<input value={fact.amountUnit} onChange={(event) => onChange({ ...draft, nutritionFacts: draft.nutritionFacts.map((entry, entryIndex) => entryIndex === index ? { ...entry, amountUnit: event.target.value } : entry) })} className={`${inputClass} mt-1`} /></label>
            <div className="flex items-end gap-2"><label className={labelClass}>DV %<input inputMode="decimal" value={fact.dailyValuePercent} onChange={(event) => onChange({ ...draft, nutritionFacts: draft.nutritionFacts.map((entry, entryIndex) => entryIndex === index ? { ...entry, dailyValuePercent: event.target.value } : entry) })} className={`${inputClass} mt-1`} /></label><button type="button" onClick={() => onChange({ ...draft, nutritionFacts: draft.nutritionFacts.filter((_, entryIndex) => entryIndex !== index) })} className="mb-0 rounded border border-white/15 px-3 py-2 text-error">×</button></div>
            {fact.reviewReasons.length > 0 ? <p className="text-xs text-text-muted md:col-span-2 xl:col-span-6">Source review: {fact.reviewReasons.join(", ")}</p> : null}
          </div>
        ))}
      </div>
    </section>
  );
}

export default function CatalogFormulaEditor({ draft, onChange }: { draft: CatalogEditorDraft; onChange: (draft: CatalogEditorDraft) => void }) {
  return (
    <div className="space-y-4">
      <section className="rounded-[8px] border border-white/10 bg-[#0D1117] p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Product label</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className={labelClass}>Label name<input value={draft.labelName} onChange={(event) => onChange({ ...draft, labelName: event.target.value })} className={`${inputClass} mt-1`} /></label>
          <label className={labelClass}>Brand<input value={draft.brandName} onChange={(event) => onChange({ ...draft, brandName: event.target.value })} className={`${inputClass} mt-1`} /></label>
          <label className={labelClass}>Physical form<input value={draft.physicalForm} onChange={(event) => onChange({ ...draft, physicalForm: event.target.value })} className={`${inputClass} mt-1`} /></label>
          <label className={labelClass}>Variant<input value={draft.variant} onChange={(event) => onChange({ ...draft, variant: event.target.value })} className={`${inputClass} mt-1`} /></label>
          <label className={labelClass}>Market region<input maxLength={2} value={draft.marketRegion} onChange={(event) => onChange({ ...draft, marketRegion: event.target.value.toUpperCase() })} className={`${inputClass} mt-1`} /></label>
          <label className={labelClass}>Serving label text<input value={draft.servingSizeLabelText} onChange={(event) => onChange({ ...draft, servingSizeLabelText: event.target.value })} className={`${inputClass} mt-1`} placeholder="Serving Size 2 Capsules" /></label>
          <label className={labelClass}>Serving amount<input inputMode="decimal" value={draft.servingSizeAmount} onChange={(event) => onChange({ ...draft, servingSizeAmount: event.target.value })} className={`${inputClass} mt-1`} /></label>
          <label className={labelClass}>Serving unit<input value={draft.servingSizeUnit} onChange={(event) => onChange({ ...draft, servingSizeUnit: event.target.value })} className={`${inputClass} mt-1`} /></label>
        </div>
      </section>

      <section className="rounded-[8px] border border-white/10 bg-[#0D1117] p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Label guidance</p>
        <div className="mt-3 grid gap-4 xl:grid-cols-2">
          <div className="grid gap-3 md:grid-cols-3">
            <label className={labelClass}>Dose state<select value={draft.doseGuidanceState} onChange={(event) => onChange({ ...draft, doseGuidanceState: event.target.value as CatalogEditorDraft["doseGuidanceState"] })} className={`${inputClass} mt-1`}><option value="none">None</option><option value="structured">Structured</option><option value="unmappable">Unmappable</option></select></label>
            <label className={`${labelClass} md:col-span-2`}>Exact dose text<input disabled={draft.doseGuidanceState === "none"} value={draft.doseGuidanceText} onChange={(event) => onChange({ ...draft, doseGuidanceText: event.target.value })} className={`${inputClass} mt-1 disabled:opacity-40`} /></label>
            {draft.doseGuidanceState === "structured" ? <><label className={labelClass}>Mapped amount<input inputMode="decimal" value={draft.doseGuidanceAmount} onChange={(event) => onChange({ ...draft, doseGuidanceAmount: event.target.value })} className={`${inputClass} mt-1`} /></label><label className={labelClass}>Mapped unit<select value={draft.doseGuidanceUnit} onChange={(event) => onChange({ ...draft, doseGuidanceUnit: event.target.value as CatalogEditorDraft["doseGuidanceUnit"] })} className={`${inputClass} mt-1`}>{CATALOG_APP_DOSE_UNITS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}</select></label></> : null}
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <label className={labelClass}>Timing state<select value={draft.timingGuidanceState} onChange={(event) => onChange({ ...draft, timingGuidanceState: event.target.value as CatalogEditorDraft["timingGuidanceState"] })} className={`${inputClass} mt-1`}><option value="none">None</option><option value="structured">Structured</option><option value="unmappable">Unmappable</option></select></label>
            <label className={`${labelClass} md:col-span-2`}>Exact timing text<input disabled={draft.timingGuidanceState === "none"} value={draft.timingGuidanceText} onChange={(event) => onChange({ ...draft, timingGuidanceText: event.target.value })} className={`${inputClass} mt-1 disabled:opacity-40`} /></label>
            {draft.timingGuidanceState === "structured" ? <label className={labelClass}>Mapped timing<select value={draft.timingGuidanceBlock} onChange={(event) => onChange({ ...draft, timingGuidanceBlock: event.target.value as CatalogEditorDraft["timingGuidanceBlock"] })} className={`${inputClass} mt-1`}>{CATALOG_TIMING_BLOCKS.map((timing) => <option key={timing} value={timing}>{timing.replaceAll("_", " ")}</option>)}</select></label> : null}
          </div>
        </div>
      </section>

      <FormulaSection draft={draft} onChange={onChange} />
      <NutritionSection draft={draft} onChange={onChange} />

      <section className="rounded-[8px] border border-white/10 bg-[#0D1117] p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Review state</p>
        <label className={`${labelClass} mt-3`}>Admin notes<textarea value={draft.adminNotes} onChange={(event) => onChange({ ...draft, adminNotes: event.target.value })} className={`${inputClass} mt-1 min-h-24`} /></label>
        <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.needsFollowUp} onChange={(event) => onChange({ ...draft, needsFollowUp: event.target.checked, followUpReasons: event.target.checked ? draft.followUpReasons : [] })} /> Needs follow-up</label>
        {draft.needsFollowUp ? <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">{followUpReasons.map((reason) => <label key={reason} className="flex items-center gap-2 rounded border border-white/10 p-2 text-xs"><input type="checkbox" checked={draft.followUpReasons.includes(reason)} onChange={(event) => onChange({ ...draft, followUpReasons: event.target.checked ? [...new Set([...draft.followUpReasons, reason])] : draft.followUpReasons.filter((entry) => entry !== reason) })} />{reason.replaceAll("_", " ")}</label>)}</div> : null}
      </section>
    </div>
  );
}
