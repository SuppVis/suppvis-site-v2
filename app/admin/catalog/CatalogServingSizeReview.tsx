"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
  type ServingSizeExclusionReason,
  type ServingSizeProfileVariantRule,
  type ServingSizeQuantityOverride,
  type ServingSizeReviewCategory,
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

const categoryOrder: ServingSizeReviewCategory[] = [
  "label_column_review",
  "canonical_choice_review",
  "unreferenced_serving_mapping_review",
  "composite_review",
  "profile_variant_review",
  "exclusion_review",
];

const categoryCopy: Record<ServingSizeReviewCategory, {
  title: string;
  short: string;
  instructions: string;
  style: string;
}> = {
  label_column_review: {
    title: "Choose the correct value column",
    short: "The serving is known, but DSLD attached multiple value columns to it.",
    instructions: "Compare the printed columns and choose the one column that belongs to the canonical serving. The choice applies across the whole label.",
    style: "border-cyan-400/35 bg-cyan-400/5",
  },
  canonical_choice_review: {
    title: "Choose a canonical serving",
    short: "The precedence rules could not safely choose one serving.",
    instructions: "Choose the adult, full, standard prepared-with-water serving that SuppVis should use by default.",
    style: "border-emerald-400/35 bg-emerald-400/5",
  },
  unreferenced_serving_mapping_review: {
    title: "Map values to an unreferenced serving",
    short: "The preferred serving exists, but ingredient values point somewhere else.",
    instructions: "Confirm the canonical serving, then choose which printed value column should populate its ingredient amounts.",
    style: "border-blue-400/35 bg-blue-400/5",
  },
  composite_review: {
    title: "Combine a package",
    short: "Several component rows together represent one packet, pack, or regimen.",
    instructions: "Confirm that the components belong together and define the single combined serving SuppVis should display.",
    style: "border-violet-400/35 bg-violet-400/5",
  },
  profile_variant_review: {
    title: "Retain profile-based variants",
    short: "The printed serving changes by sex or adult age group.",
    instructions: "Confirm every retained variant, its profile selector, and which one should be the fallback default.",
    style: "border-sky-400/35 bg-sky-400/5",
  },
  exclusion_review: {
    title: "Decide possible exclusions",
    short: "The label may describe an unsupported multi-day or changing regimen.",
    instructions: "Exclude the product only if one stable catalog serving cannot represent it; otherwise choose a canonical serving.",
    style: "border-red-400/35 bg-red-400/5",
  },
};

const exclusionReasons: Array<{ value: ServingSizeExclusionReason; label: string }> = [
  { value: "incomplete_packet_extraction", label: "Packet or component data is incomplete" },
  { value: "unsupported_multi_day_regimen", label: "Multi-day regimen is not supported" },
  { value: "label_dsld_mismatch", label: "Label and DSLD data cannot be reconciled" },
  { value: "unsupported_product_format", label: "Product format is not supported" },
  { value: "other", label: "Other" },
];

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

type MappingOption = {
  key: string;
  servingOrder: number | null;
  columnPosition: number;
  coverage: number;
  examples: string[];
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

function reviewedContext(context: EditableContext, sourceServingOrders: number[]): ReviewedServingContext {
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

function isActionable(task: ServingSizeReviewTask | undefined) {
  return task?.status === "pending";
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

function nextEscalation(tasks: ServingSizeReviewTask[], afterId: string,
  resolutionKind: ServingSizeReviewTask["resolutionKind"]) {
  const current = tasks.findIndex((task) => task.id === afterId);
  for (let index = current + 1; index < tasks.length; index += 1) {
    const task = tasks[index];
    if (task.status === "escalated" && task.resolutionKind === resolutionKind) return task;
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

function isReviewCategory(value: string | null): value is ServingSizeReviewCategory {
  return Boolean(value && categoryOrder.includes(value as ServingSizeReviewCategory));
}

function categoryTasks(tasks: ServingSizeReviewTask[], category: ServingSizeReviewCategory | null) {
  return category ? tasks.filter((task) => task.reviewCategory === category) : [];
}

function mappingOptions(rows: ServingSizeIngredientRow[], selectedOrder: number | null): MappingOption[] {
  const groups = new Map<string, MappingOption>();
  for (const row of rows) {
    const positions = new Map<string, number>();
    for (const quantity of row.quantities) {
      if (quantity.servingSizeOrder === selectedOrder) continue;
      const orderKey = quantity.servingSizeOrder == null ? "unlinked" : String(quantity.servingSizeOrder);
      const position = positions.get(orderKey) ?? 0;
      positions.set(orderKey, position + 1);
      const key = `${orderKey}:${position}`;
      const current = groups.get(key) ?? {
        key,
        servingOrder: quantity.servingSizeOrder,
        columnPosition: position,
        coverage: 0,
        examples: [],
      };
      current.coverage += 1;
      if (current.examples.length < 4) current.examples.push(`${row.name}: ${formatQuantity(quantity)}`);
      groups.set(key, current);
    }
  }
  return [...groups.values()].sort((left, right) => right.coverage - left.coverage
    || (left.servingOrder ?? Number.MAX_SAFE_INTEGER) - (right.servingOrder ?? Number.MAX_SAFE_INTEGER)
    || left.columnPosition - right.columnPosition);
}

function inferProfileRules(detail: ServingSizeReviewTaskDetail): ServingSizeProfileVariantRule[] {
  const dimension = detail.reviewReasonCodes.includes("profile_variant_adult_age_50") ? "age" : "sex";
  return detail.sourceContexts.map((context, index) => {
    const serving = detail.sourceServingSizes.find((candidate) =>
      context.sourceServingOrders.includes(candidate.order));
    const note = serving?.notes?.toLowerCase() ?? "";
    const value = dimension === "sex"
      ? /\bwomen\b|\bfemale/.test(note) ? "female" : /\bmen\b|\bmale/.test(note) ? "male" : `variant_${index + 1}`
      : /\bunder\s*50|\bbelow\s*50|\byounger\s+than\s*50/.test(note) ? "under_50"
        : /\bover\s*50|\babove\s*50|\bolder\s+than\s*50|\b50\s*(?:and|or)?\s*(?:older|over|above|up|\+)/.test(note)
          ? "50_and_over" : `variant_${index + 1}`;
    return { contextKey: context.contextKey, dimension, value, isDefault: index === 0 };
  });
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
  const searchParams = useSearchParams();
  const requestedCategory = isReviewCategory(searchParams.get("category"))
    ? searchParams.get("category") as ServingSizeReviewCategory : null;
  const productNameRef = useRef<HTMLHeadingElement>(null);
  const [tasks, setTasks] = useState<ServingSizeReviewTask[]>([]);
  const [batchKey, setBatchKey] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<ServingSizeReviewCategory | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [detail, setDetail] = useState<ServingSizeReviewTaskDetail | null>(null);
  const [range, setRange] = useState({ first: 0, last: -1 });
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<number | null>(null);
  const [context, setContext] = useState<EditableContext | null>(null);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [escalated, setEscalated] = useState(false);
  const [excludeFromIngest, setExcludeFromIngest] = useState(false);
  const [exclusionReason, setExclusionReason] = useState<ServingSizeExclusionReason | "">("");
  const [quantityOverrides, setQuantityOverrides] = useState<Map<string, number | null>>(new Map());
  const [globalColumn, setGlobalColumn] = useState<number | null>(null);
  const [globalMapping, setGlobalMapping] = useState("");
  const [profileRules, setProfileRules] = useState<ServingSizeProfileVariantRule[]>([]);
  const [profileQuantityOverrides, setProfileQuantityOverrides] = useState<Map<string, number | null>>(new Map());
  const [profileColumns, setProfileColumns] = useState<Map<string, number>>(new Map());
  const [reviewerNote, setReviewerNote] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const activeCategory = mode === "queue" ? requestedCategory : selectedCategory;
  const scopedTasks = useMemo(() => categoryTasks(tasks, activeCategory), [tasks, activeCategory]);
  const span = pendingSpan(scopedTasks);
  const pending = tasks.filter(isActionable).length;
  const escalations = tasks.filter((task) => task.status === "escalated").length;
  const exclusions = tasks.filter((task) => task.status === "excluded_from_ingest").length;
  const decided = tasks.length - pending - escalations;
  const currentPosition = scopedTasks.findIndex((task) => task.id === selectedTaskId) + 1;
  const next = useMemo(() => {
    const selected = scopedTasks.find((task) => task.id === selectedTaskId);
    return selected?.status === "escalated"
      ? nextEscalation(scopedTasks, selectedTaskId, selected.resolutionKind)
      : nextTask(scopedTasks, selectedTaskId, range.first, range.last);
  },
    [scopedTasks, selectedTaskId, range]);
  const projected = useMemo(() => projections(detail?.sourceIngredientRows ?? [], selectedOrder,
    quantityOverrides), [detail, selectedOrder, quantityOverrides]);
  const projectionCounts = useMemo(() => projected.reduce((counts, row) => {
    counts[row.status] += 1;
    return counts;
  }, { selected: 0, excluded: 0, ambiguous: 0, no_quantity: 0 }), [projected]);
  const categoryCounts = useMemo(() => Object.fromEntries(categoryOrder.map((category) => {
    const categoryRows = tasks.filter((task) => task.reviewCategory === category);
    return [category, {
      total: categoryRows.length,
      pending: categoryRows.filter(isActionable).length,
      escalated: categoryRows.filter((task) => task.status === "escalated").length,
    }];
  })) as Record<ServingSizeReviewCategory, { total: number; pending: number; escalated: number }>, [tasks]);
  const unreferencedOptions = useMemo(() => detail?.reviewCategory === "unreferenced_serving_mapping_review"
    ? mappingOptions(detail.sourceIngredientRows, selectedOrder) : [], [detail, selectedOrder]);
  const labelColumnCount = useMemo(() => {
    if (!detail || selectedOrder == null || detail.reviewCategory !== "label_column_review") return 0;
    return detail.sourceIngredientRows.reduce((maximum, row) => Math.max(maximum,
      row.quantities.filter((quantity) => quantity.servingSizeOrder === selectedOrder).length), 0);
  }, [detail, selectedOrder]);

  useEffect(() => {
    let cancelled = false;
    getServingSizeReviewList().then((result) => {
      if (cancelled) return;
      setTasks(result.tasks);
      setBatchKey(result.batchKey);
      const category = mode === "queue" ? requestedCategory
        : categoryOrder.find((candidate) => result.tasks.some((task) =>
          task.reviewCategory === candidate && isActionable(task))) ?? categoryOrder[0];
      setSelectedCategory(category);
      const filtered = categoryTasks(result.tasks, category);
      const suggested = pendingSpan(filtered);
      const storageKey = `serving-size-review-range:${result.batchKey}:${category ?? "none"}`;
      const stored = window.sessionStorage.getItem(storageKey);
      let selectedRange = suggested ? { first: suggested.first, last: suggested.last }
        : { first: 0, last: Math.max(0, filtered.length - 1) };
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as { first: number; last: number };
          if (Number.isSafeInteger(parsed.first) && Number.isSafeInteger(parsed.last)
            && parsed.first >= 0 && parsed.first <= parsed.last && parsed.last < filtered.length) {
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
        if (!category) {
          setError("Choose a review category before starting the queue.");
          return;
        }
        const openKey = `serving-size-review-open-task:${result.batchKey}:${category}`;
        const requestedTaskId = window.sessionStorage.getItem(openKey);
        window.sessionStorage.removeItem(openKey);
        const requested = requestedTaskId
          ? filtered.find((task) => task.id === requestedTaskId) : undefined;
        setSelectedTaskId(requested?.id
          ?? nextTask(filtered, "", selectedRange.first, selectedRange.last)?.id ?? "");
      }
    }).catch((reason) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : "Unable to load serving-size reviews.");
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [mode, requestedCategory]);

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
    setGlobalColumn(null);
    setGlobalMapping("");
    setProfileColumns(new Map());
    if (detail.resolutionKind === "profile_variants") {
      setSelectedOrder(null);
      setContext(null);
      setCorrectionOpen(false);
      setEscalated(false);
      setExcludeFromIngest(false);
      setExclusionReason("");
      setQuantityOverrides(new Map());
      setProfileRules(detail.profileVariantRules ?? inferProfileRules(detail));
      setProfileQuantityOverrides(new Map((detail.quantityOverrides ?? [])
        .filter((override) => override.contextKey)
        .map((override) => [`${override.contextKey}\u0000${override.rowPath}`, override.selectedQuantityIndex])));
      setReviewerNote("");
      setNoteOpen(false);
      productNameRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
      return;
    }
    if (detail.resolutionKind === "composite") {
      const sourceOrders = detail.sourceServingSizes.map((serving) => serving.order);
      const effectiveContext = detail.reviewedServingContexts?.[0] ?? {
        contextKey: "composite-serving",
        sourceServingOrders: sourceOrders,
        householdQuantityMin: 1,
        householdQuantityMax: 1,
        householdUnit: "packet",
        metricQuantityMin: null,
        metricQuantityMax: null,
        metricUnit: null,
        contextLabel: "Composite package",
        preparationContext: null,
        labelText: "1 packet",
      };
      setSelectedOrder(null);
      setContext(editableContext(effectiveContext));
      setCorrectionOpen(false);
      setEscalated(false);
      setExcludeFromIngest(false);
      setExclusionReason("");
      setQuantityOverrides(new Map());
      setProfileRules([]);
      setProfileQuantityOverrides(new Map());
      setReviewerNote("");
      setNoteOpen(true);
      productNameRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
      return;
    }
    const order = detail.selectedServingOrder ?? detail.policySuggestedServingOrder;
    const sourceContext = order == null ? null : detail.sourceContexts.find((candidate) =>
      candidate.sourceServingOrders.includes(order)) ?? null;
    const effectiveContext = detail.reviewedServingContexts?.[0] ?? sourceContext;
    setSelectedOrder(order);
    setContext(effectiveContext ? editableContext(effectiveContext) : null);
    setCorrectionOpen(detail.status === "canonical_corrected");
    setEscalated(false);
    setExcludeFromIngest(false);
    setExclusionReason("");
    setQuantityOverrides(new Map((detail.quantityOverrides ?? [])
      .filter((override) => override.contextKey === null)
      .map((override) => [override.rowPath, override.selectedQuantityIndex])));
    setProfileRules([]);
    setProfileQuantityOverrides(new Map());
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
    setGlobalColumn(null);
    setGlobalMapping("");
    setEscalated(false);
    setExcludeFromIngest(false);
    setExclusionReason("");
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

  function chooseCategory(category: ServingSizeReviewCategory) {
    setSelectedCategory(category);
    const filtered = categoryTasks(tasks, category);
    const suggested = pendingSpan(filtered);
    setRangeStart(suggested ? String(suggested.first + 1) : "");
    setRangeEnd(suggested ? String(suggested.last + 1) : "");
    setError("");
  }

  function applyGlobalColumnChoice(position: number) {
    if (!detail || selectedOrder == null) return;
    const nextMap = new Map<string, number | null>();
    for (const row of detail.sourceIngredientRows) {
      const candidates = row.quantities.filter((quantity) => quantity.servingSizeOrder === selectedOrder);
      if (candidates.length > 1 && candidates[position]) {
        nextMap.set(row.rowPath, candidates[position].sourceQuantityIndex);
      }
    }
    setQuantityOverrides(nextMap);
    setGlobalColumn(position);
  }

  function applyUnreferencedMapping(option: MappingOption) {
    if (!detail) return;
    const nextMap = new Map<string, number | null>();
    for (const row of detail.sourceIngredientRows) {
      if (!row.quantities.length) continue;
      const candidates = row.quantities.filter((quantity) =>
        quantity.servingSizeOrder === option.servingOrder);
      nextMap.set(row.rowPath, candidates[option.columnPosition]?.sourceQuantityIndex ?? null);
    }
    setQuantityOverrides(nextMap);
    setGlobalMapping(option.key);
  }

  function chooseProfileDefault(contextKey: string) {
    setProfileRules((current) => current.map((rule) => ({
      ...rule,
      isDefault: rule.contextKey === contextKey,
    })));
  }

  function applyProfileColumn(contextKey: string, servingOrder: number, position: number) {
    if (!detail) return;
    setProfileQuantityOverrides((current) => {
      const nextMap = new Map(current);
      for (const row of detail.sourceIngredientRows) {
        const candidates = row.quantities.filter((quantity) =>
          quantity.servingSizeOrder === servingOrder);
        if (candidates.length > 1 && candidates[position]) {
          nextMap.set(`${contextKey}\u0000${row.rowPath}`, candidates[position].sourceQuantityIndex);
        }
      }
      return nextMap;
    });
    setProfileColumns((current) => new Map(current).set(contextKey, position));
  }

  function applyRange() {
    if (!span || !selectedCategory) return;
    const first = Number(rangeStart);
    const last = Number(rangeEnd);
    if (!Number.isSafeInteger(first) || !Number.isSafeInteger(last)
      || first < span.first + 1 || last > span.last + 1 || first > last) {
      setError(`Choose a range from ${span.first + 1} to ${span.last + 1}.`);
      return;
    }
    const selected = { first: first - 1, last: last - 1 };
    window.sessionStorage.setItem(
      `serving-size-review-range:${batchKey}:${selectedCategory}`,
      JSON.stringify(selected),
    );
    router.push(`/admin/catalog/serving-size-review?category=${selectedCategory}`);
  }

  async function save() {
    if (!detail) return;
    const composite = detail.resolutionKind === "composite";
    const profileVariants = detail.resolutionKind === "profile_variants";
    if (!excludeFromIngest && composite && !context) {
      setError("Define the one combined serving SuppVis should use.");
      return;
    }
    if (!excludeFromIngest && !composite && !profileVariants && !escalated
      && (selectedOrder == null || !context)) {
      setError("Choose the one serving size the app should use.");
      return;
    }
    if (!excludeFromIngest && !composite && !profileVariants && !escalated
      && detail.reviewCategory === "label_column_review" && globalColumn == null) {
      setError("Choose the printed value column that belongs to this serving.");
      return;
    }
    if (!excludeFromIngest && !composite && !profileVariants && !escalated
      && detail.reviewCategory === "unreferenced_serving_mapping_review" && !globalMapping) {
      setError("Choose which ingredient-value column should populate the canonical serving.");
      return;
    }
    if (!excludeFromIngest && !composite && !profileVariants && !escalated
      && projectionCounts.ambiguous > 0) {
      setError("Resolve every highlighted ingredient quantity before saving.");
      return;
    }
    if (!excludeFromIngest && profileVariants && !escalated) {
      if (profileRules.length !== detail.sourceContexts.length
        || profileRules.filter((rule) => rule.isDefault).length !== 1) {
        setError("Confirm every profile variant and choose one fallback default.");
        return;
      }
      for (const sourceContext of detail.sourceContexts) {
        const order = sourceContext.sourceServingOrders[0];
        for (const row of detail.sourceIngredientRows) {
          const matches = row.quantities.filter((quantity) => quantity.servingSizeOrder === order);
          if (matches.length > 1
            && !profileQuantityOverrides.has(`${sourceContext.contextKey}\u0000${row.rowPath}`)) {
            setError(`Choose one value column for ${sourceContext.contextKey}.`);
            return;
          }
        }
      }
    }
    if (excludeFromIngest && !exclusionReason) {
      setError("Choose why this product should be excluded from catalog ingest.");
      return;
    }
    if ((excludeFromIngest || composite || escalated || correctionOpen) && !reviewerNote.trim()) {
      setError(excludeFromIngest
        ? "Add a note explaining why this entire product must be excluded."
        : composite
        ? "Add a note explaining what the combined serving represents."
        : "Add a reviewer note explaining the escalation or correction.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const overrides: ServingSizeQuantityOverride[] = [...quantityOverrides.entries()]
        .map(([rowPath, selectedQuantityIndex]) => ({ rowPath, selectedQuantityIndex, contextKey: null }));
      const profileOverrides: ServingSizeQuantityOverride[] = [...profileQuantityOverrides.entries()]
        .map(([key, selectedQuantityIndex]) => {
          const [contextKey, rowPath] = key.split("\u0000", 2);
          return { rowPath, selectedQuantityIndex, contextKey };
        });
      const body = excludeFromIngest ? {
        expectedRevision: detail.revision,
        outcome: "excluded_from_ingest",
        reviewedServingContexts: null,
        selectedServingOrder: null,
        quantityOverrides: null,
        profileVariantRules: null,
        exclusionReason,
        reviewerNote: reviewerNote.trim(),
      } : composite ? {
        expectedRevision: detail.revision,
        outcome: "composite_serving",
        reviewedServingContexts: [reviewedContext(context!,
          detail.sourceServingSizes.map((serving) => serving.order))],
        selectedServingOrder: null,
        quantityOverrides: null,
        profileVariantRules: null,
        exclusionReason: null,
        reviewerNote: reviewerNote.trim(),
      } : profileVariants && !escalated ? {
        expectedRevision: detail.revision,
        outcome: "profile_variants_retained",
        reviewedServingContexts: detail.sourceContexts,
        selectedServingOrder: null,
        quantityOverrides: profileOverrides,
        profileVariantRules: profileRules,
        exclusionReason: null,
        reviewerNote: reviewerNote.trim() || null,
      } : escalated ? {
        expectedRevision: detail.revision,
        outcome: "escalated",
        reviewedServingContexts: null,
        selectedServingOrder: null,
        quantityOverrides: null,
        profileVariantRules: null,
        exclusionReason: null,
        reviewerNote: reviewerNote.trim(),
      } : {
        expectedRevision: detail.revision,
        outcome: correctionOpen ? "canonical_corrected" : "canonical_selected",
        reviewedServingContexts: [reviewedContext(context!, [selectedOrder!])],
        selectedServingOrder: selectedOrder,
        quantityOverrides: overrides,
        profileVariantRules: null,
        exclusionReason: null,
        reviewerNote: reviewerNote.trim() || null,
      };
      if (readOnlyPreview) {
        setSelectedTaskId(next?.id ?? "");
        setNotice("Preview only — nothing was recorded. Moved to the next label.");
        return;
      }
      const updated = await saveServingSizeReviewDecision(detail.id, body);
      const nextTasks = tasks.map((task) => task.id === updated.id ? updated : task);
      const nextScopedTasks = scopedTasks.map((task) => task.id === updated.id ? updated : task);
      setTasks(nextTasks);
      setSelectedTaskId(detail.status === "escalated"
        ? nextEscalation(nextScopedTasks, updated.id, detail.resolutionKind)?.id ?? ""
        : nextTask(nextScopedTasks, updated.id, range.first, range.last)?.id ?? "");
      setNotice(excludeFromIngest
        ? "Product excluded from catalog ingest. Moved to the next label."
        : composite
        ? "Combined serving saved. Moved to the next label."
        : profileVariants
        ? "Profile variants saved. Moved to the next label."
        : "Canonical serving saved. Moved to the next label.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save this decision.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="rounded border border-white/10 bg-[#0D1117] p-6 text-sm">Loading serving-size reviews…</p>;

  if (mode === "selector") return <section aria-label="Serving size review" className="space-y-4">
    <div className="rounded-[8px] border border-white/10 bg-[#0D1117] p-5">
      <h2 className="font-headline text-2xl font-bold">Serving resolution review</h2>
      <p className="mt-2 max-w-4xl text-sm text-text-secondary">
        Choose a review category first. Each category contains one consistent type of decision and its own progress.
      </p>
      <p className="mt-3 text-sm text-text-primary">{pending} pending · {decided} completed ({exclusions} excluded) · {escalations} escalated · {tasks.length} human-review tasks</p>
      <p className="mt-2 text-xs text-text-muted">Queue {batchKey}. The 918 policy-approved labels are stored separately and do not appear here.</p>
      {readOnlyPreview ? <p className="mt-3 rounded border border-sky-400/35 bg-sky-400/10 p-3 text-sm text-sky-200">
        Read-only local preview: controls advance through the queue, but nothing is saved.
      </p> : null}
    </div>

    <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
      {categoryOrder.map((category) => {
        const copy = categoryCopy[category];
        const counts = categoryCounts[category];
        const selected = selectedCategory === category;
        return <button key={category} type="button" onClick={() => chooseCategory(category)}
          className={`rounded-[8px] border p-4 text-left transition ${copy.style} ${selected ? "ring-2 ring-accent" : "hover:border-accent/60"}`}>
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-semibold text-text-primary">{copy.title}</h3>
            <span className="rounded-full border border-white/15 bg-black/20 px-2.5 py-1 text-xs font-bold">{counts.total}</span>
          </div>
          <p className="mt-2 text-sm text-text-secondary">{copy.short}</p>
          <p className="mt-3 text-xs text-text-muted">{counts.pending} pending{counts.escalated ? ` · ${counts.escalated} escalated` : ""}</p>
        </button>;
      })}
    </div>

    {selectedCategory ? <div className={`rounded-[8px] border p-5 ${categoryCopy[selectedCategory].style}`}>
      <p className="text-xs font-bold uppercase tracking-wide text-accent">Selected review</p>
      <h3 className="mt-1 font-headline text-xl font-bold">{categoryCopy[selectedCategory].title}</h3>
      <p className="mt-2 max-w-4xl text-sm text-text-secondary">{categoryCopy[selectedCategory].instructions}</p>
      <div className="mt-4 flex flex-wrap items-end gap-3 rounded border border-white/10 bg-[#080D12] p-3">
        <label className="text-xs font-semibold">Start at task<input className={`${inputClass} mt-1 w-28`} type="number"
          value={rangeStart} min={span ? span.first + 1 : undefined} max={span ? span.last + 1 : undefined}
          onChange={(event) => setRangeStart(event.target.value)} /></label>
        <label className="text-xs font-semibold">End at task<input className={`${inputClass} mt-1 w-28`} type="number"
          value={rangeEnd} min={span ? span.first + 1 : undefined} max={span ? span.last + 1 : undefined}
          onChange={(event) => setRangeEnd(event.target.value)} /></label>
        <button type="button" disabled={!span} onClick={applyRange}
          className="rounded-full bg-accent px-4 py-2 text-sm font-bold text-[#03100E] disabled:opacity-40">Start this category</button>
        <p className="text-xs text-text-muted">Use non-overlapping ranges for multiple admins. Completed tasks are skipped.</p>
      </div>
      {scopedTasks.some((task) => task.status === "escalated") ? <details className="mt-3 rounded border border-amber-400/25 p-3 text-sm">
        <summary className="cursor-pointer font-semibold text-amber-200">Escalations in this category ({categoryCounts[selectedCategory].escalated})</summary>
        <p className="mt-2 text-xs text-text-secondary">Any admin can reopen and resolve these.</p>
        <div className="mt-2 flex flex-wrap gap-2">{scopedTasks.filter((task) => task.status === "escalated").map((task, index) =>
          <button key={task.id} type="button" onClick={() => {
            window.sessionStorage.setItem(`serving-size-review-open-task:${batchKey}:${selectedCategory}`, task.id);
            router.push(`/admin/catalog/serving-size-review?category=${selectedCategory}`);
          }} className="rounded border border-white/15 px-3 py-2 text-left text-xs hover:border-accent">
            #{index + 1} · {task.labelName}
          </button>)}</div>
      </details> : null}
    </div> : null}
    {error ? <p role="alert" className="rounded border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">{error}</p> : null}
  </section>;

  return <section aria-label="Serving size review queue" className="space-y-4">
    <Link href="/admin/catalog?view=serving-size-review"
      className="inline-flex rounded-full border border-white/20 px-4 py-2 text-sm font-semibold hover:border-accent hover:text-accent">
      ← Back to serving-size queue
    </Link>
    {requestedCategory ? <div className={`rounded-[8px] border p-4 ${categoryCopy[requestedCategory].style}`}>
      <p className="text-xs font-bold uppercase tracking-wide text-accent">Current category</p>
      <h2 className="mt-1 font-headline text-xl font-bold">{categoryCopy[requestedCategory].title}</h2>
      <p className="mt-1 text-sm text-text-secondary">{categoryCopy[requestedCategory].instructions}</p>
    </div> : <p role="alert" className="rounded border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
      No review category was selected. Return to the serving-size queue and choose one.
    </p>}
    {error ? <p role="alert" className="rounded border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">{error}</p> : null}
    {notice ? <p role="status" className="rounded border border-accent/40 bg-accent/10 p-3 text-sm text-accent">{notice}</p> : null}
    <div className="rounded-[8px] border border-white/10 bg-[#0D1117] p-4">
      {readOnlyPreview ? <p className="mb-4 rounded border border-sky-400/35 bg-sky-400/10 p-3 text-sm text-sky-200">
        Read-only local preview — controls advance through the queue, but no decision is recorded.
      </p> : null}
      {selectedTaskId ? <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-accent">
        Task {currentPosition} of {scopedTasks.length} in this category · assigned range {range.first + 1}–{range.last + 1}
      </p> : null}
      {!detail || detail.id !== selectedTaskId ? <p className="text-sm text-text-secondary">
        {selectedTaskId ? "Loading the next label…" : "No pending labels remain in this range."}
      </p> : <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h3 ref={productNameRef} className="scroll-mt-4 font-headline text-xl font-bold">{detail.labelName}</h3>
            <p className="text-sm text-text-secondary">{detail.brandName} · DSLD {detail.dsldLabelId}{detail.offMarket ? " · off market" : ""}</p></div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-bold uppercase text-text-secondary">
              {categoryCopy[detail.reviewCategory].title}
            </span>
            {detail.resolutionKind === "composite" ? <span className="rounded-full border border-violet-400/40 bg-violet-400/10 px-3 py-1 text-xs font-bold uppercase text-violet-200">
              Composite package
            </span> : null}
            <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase ${severityStyle[detail.warningSeverity]}`}>
              {detail.warningSeverity === "none" ? "No extraction warning" : `${detail.warningSeverity} warning`}
            </span>
          </div>
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

            {detail.resolutionKind === "profile_variants" ? <>
              <section className="rounded border border-sky-400/35 bg-sky-400/10 p-3">
                <h4 className="font-semibold text-sky-100">1. Confirm the profile-based servings</h4>
                <p className="mt-1 text-xs text-text-secondary">
                  Keep each printed serving below. SuppVis will choose between them using the user&apos;s profile.
                </p>
                <div className="mt-3 space-y-3">{detail.sourceContexts.map((sourceContext) => {
                  const serving = detail.sourceServingSizes.find((candidate) =>
                    sourceContext.sourceServingOrders.includes(candidate.order));
                  const rule = profileRules.find((candidate) => candidate.contextKey === sourceContext.contextKey);
                  if (!serving || !rule) return null;
                  const ambiguousRows = detail.sourceIngredientRows.map((row) => ({
                    row,
                    candidates: row.quantities.filter((quantity) => quantity.servingSizeOrder === serving.order),
                  })).filter((entry) => entry.candidates.length > 1);
                  const columnCount = ambiguousRows.reduce((maximum, entry) =>
                    Math.max(maximum, entry.candidates.length), 0);
                  return <div key={sourceContext.contextKey} className="rounded border border-sky-300/20 bg-[#080D12] p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div><p className="font-semibold">{formatServing(serving.minQuantity, serving.maxQuantity, serving.unit)}</p>
                        <p className="mt-1 text-sm text-text-secondary">{serving.notes?.trim() || "No additional serving description"}</p>
                        <p className="mt-1 text-xs text-text-muted">DSLD serving order {serving.order}</p></div>
                      <label className="flex items-center gap-2 text-xs font-semibold"><input type="radio" name="profile-default"
                        className="accent-sky-400" checked={rule.isDefault}
                        onChange={() => chooseProfileDefault(sourceContext.contextKey)} />Fallback default</label>
                    </div>
                    <label className="mt-3 block text-xs font-semibold">Profile selector
                      <select className={`${inputClass} mt-1`} value={rule.value} onChange={(event) => setProfileRules((current) =>
                        current.map((candidate) => candidate.contextKey === rule.contextKey
                          ? { ...candidate, value: event.target.value } : candidate))}>
                        {rule.dimension === "sex" ? <>
                          <option value="male">Male</option><option value="female">Female</option>
                        </> : <>
                          <option value="under_50">Under 50</option><option value="50_and_over">50 and over</option>
                        </>}
                      </select>
                    </label>
                    {ambiguousRows.length ? <div className="mt-3 rounded border border-amber-400/30 bg-amber-400/5 p-3">
                      <p className="text-xs font-semibold text-amber-100">Choose one printed value column for this variant</p>
                      <div className="mt-2 flex flex-wrap gap-2">{Array.from({ length: columnCount }, (_, position) =>
                        <button key={position} type="button" onClick={() => applyProfileColumn(
                          sourceContext.contextKey, serving.order, position,
                        )} className={`rounded border px-3 py-2 text-xs font-semibold ${profileColumns.get(sourceContext.contextKey) === position
                          ? "border-accent bg-accent/15 text-accent" : "border-white/15"}`}>
                          Column {position + 1}
                        </button>)}</div>
                      <div className="mt-2 space-y-1 text-xs text-text-secondary">{ambiguousRows.slice(0, 3).map((entry) =>
                        <p key={entry.row.rowPath}>{entry.row.name}: {entry.candidates.map(formatQuantity).join(" | ")}</p>)}</div>
                    </div> : null}
                  </div>;
                })}</div>
              </section>
              <section className="rounded border border-white/10 p-3">
                <h4 className="font-semibold">2. Confirm the fallback</h4>
                <p className="mt-1 text-xs text-text-secondary">
                  The fallback is used only when the relevant profile field is unavailable. Both variants remain preserved.
                </p>
                <p className="mt-3 text-sm font-semibold text-accent">{profileRules.find((rule) => rule.isDefault)?.value.replaceAll("_", " ") ?? "Choose a fallback above"}</p>
              </section>
            </> : detail.resolutionKind === "composite" ? <>
              <section className="rounded border border-violet-400/35 bg-violet-400/10 p-3">
                <h4 className="font-semibold text-violet-100">1. Confirm the package components</h4>
                <p className="mt-1 text-xs text-text-secondary">
                  This label contains several serving rows that together make one package or regimen. All of them will remain as source evidence.
                </p>
                <div className="mt-3 space-y-2">
                  {detail.sourceServingSizes.map((serving) => <div key={serving.order}
                    className="rounded border border-violet-300/20 bg-[#080D12] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold">Component {serving.order}: {formatServing(serving.minQuantity, serving.maxQuantity, serving.unit)}</span>
                      <span className="text-xs text-text-muted">DSLD serving order {serving.order}</span>
                    </div>
                    <p className="mt-1 text-sm text-text-secondary">{serving.notes?.trim() || "No additional serving description"}</p>
                  </div>)}
                </div>
              </section>

              {context ? <section className="rounded border border-accent/25 bg-accent/5 p-3">
                <h4 className="font-semibold">2. Define the one combined serving SuppVis should display</h4>
                <p className="mt-1 text-xs text-text-secondary">
                  Usually this is one packet, pack, kit, or daily regimen containing every component above.
                </p>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <label className="text-xs">Amount<input className={`${inputClass} mt-1`} type="number" min="0" step="any"
                    value={context.householdQuantityMin} onChange={(event) => updateContext({ householdQuantityMin: event.target.value,
                      householdQuantityMax: event.target.value })} /></label>
                  <label className="text-xs">Unit<input className={`${inputClass} mt-1`} value={context.householdUnit}
                    onChange={(event) => updateContext({ householdUnit: event.target.value })} placeholder="packet" /></label>
                  <label className="text-xs">Printed description<input className={`${inputClass} mt-1`} value={context.labelText}
                    onChange={(event) => updateContext({ labelText: event.target.value })} placeholder="1 packet" /></label>
                </div>
              </section> : null}

              <section className="rounded border border-white/10 p-3">
                <h4 className="font-semibold">3. Check what the combined serving carries forward</h4>
                <p className="mt-1 text-xs text-text-secondary">
                  Every ingredient row linked to any component is retained. SuppVis will combine matching nutrition fields during catalog ingest while preserving each source row.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs">
                  <div className="rounded bg-accent/10 p-2"><strong className="block text-lg text-accent">{detail.sourceIngredientRows.length}</strong>source ingredient rows</div>
                  <div className={`rounded p-2 ${detail.repeatedIngredientNameGroups.length ? "bg-amber-400/10 text-amber-100" : "bg-white/5"}`}>
                    <strong className="block text-lg">{detail.repeatedIngredientNameGroups.length}</strong>repeated printed names
                  </div>
                </div>
                {detail.repeatedIngredientNameGroups.length ? <div className="mt-3 rounded border border-amber-400/25 bg-amber-400/5 p-3 text-xs">
                  <p className="font-semibold text-amber-100">Repeated names will be combined later, not discarded.</p>
                  <ul className="mt-2 space-y-1 text-text-secondary">{detail.repeatedIngredientNameGroups.slice(0, 30).map((group) =>
                    <li key={group.normalizedName}>• {group.printedNames.join(" / ")} — {group.rowPaths.length} rows</li>)}</ul>
                </div> : null}
                <details className="mt-3 text-xs"><summary className="cursor-pointer font-semibold">Preview all included rows ({detail.sourceIngredientRows.length})</summary>
                  <div className="mt-2 max-h-80 space-y-1 overflow-y-auto">{detail.sourceIngredientRows.map((row) => <div key={row.rowPath}
                    className="rounded bg-[#080D12] p-2">
                    <span className="font-semibold">{row.name || "Unnamed row"}</span>
                    {row.ancestorNames.length ? <span className="block text-text-muted">under {row.ancestorNames.join(" › ")}</span> : null}
                    <span className="mt-1 block text-text-secondary">{row.quantities.length
                      ? row.quantities.map((quantity) => `serving ${quantity.servingSizeOrder ?? "unlinked"}: ${formatQuantity(quantity)}`).join(" · ")
                      : "structural row"}</span>
                  </div>)}</div>
                </details>
              </section>
            </> : <>
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
              <p className="mt-1 text-xs text-text-secondary">{detail.reviewCategory === "unreferenced_serving_mapping_review"
                ? "Choose the printed value column that should populate this serving. The choice applies across the whole label."
                : "SuppVis keeps quantities tied to the selected serving and excludes quantities tied only to other servings."}</p>
              {detail.reviewCategory === "label_column_review" && labelColumnCount > 1 ? <div className="mt-3 rounded border border-cyan-400/30 bg-cyan-400/5 p-3">
                <p className="text-sm font-semibold text-cyan-100">Choose one value column for the whole label</p>
                <p className="mt-1 text-xs text-text-secondary">Every affected ingredient follows the same printed column pattern, so you only need to choose once.</p>
                <div className="mt-3 flex flex-wrap gap-2">{Array.from({ length: labelColumnCount }, (_, position) =>
                  <button key={position} type="button" onClick={() => applyGlobalColumnChoice(position)}
                    className={`rounded border px-3 py-2 text-xs font-semibold ${globalColumn === position
                      ? "border-accent bg-accent/15 text-accent" : "border-white/15"}`}>
                    Use column {position + 1}
                  </button>)}</div>
                <div className="mt-3 space-y-1 text-xs text-text-secondary">{detail.sourceIngredientRows.map((row) => ({
                  row,
                  candidates: row.quantities.filter((quantity) => quantity.servingSizeOrder === selectedOrder),
                })).filter((entry) => entry.candidates.length > 1).slice(0, 4).map((entry) =>
                  <p key={entry.row.rowPath}>{entry.row.name}: {entry.candidates.map(formatQuantity).join(" | ")}</p>)}</div>
              </div> : null}
              {detail.reviewCategory === "unreferenced_serving_mapping_review" ? <div className="mt-3 rounded border border-blue-400/30 bg-blue-400/5 p-3">
                <p className="text-sm font-semibold text-blue-100">Choose the source value column</p>
                <div className="mt-3 space-y-2">{unreferencedOptions.map((option) => <button key={option.key} type="button"
                  onClick={() => applyUnreferencedMapping(option)} className={`block w-full rounded border p-3 text-left text-xs ${globalMapping === option.key
                    ? "border-accent bg-accent/15" : "border-white/15 bg-[#080D12]"}`}>
                  <span className="font-semibold">{option.servingOrder == null ? "Unlinked values" : `Values currently tied to serving order ${option.servingOrder}`}{option.columnPosition ? ` · column ${option.columnPosition + 1}` : ""}</span>
                  <span className="mt-1 block text-text-secondary">Covers {option.coverage} ingredient rows · {option.examples.join(" · ")}</span>
                </button>)}</div>
              </div> : null}
              <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
                <div className="rounded bg-accent/10 p-2"><strong className="block text-lg text-accent">{projectionCounts.selected}</strong>kept</div>
                <div className="rounded bg-white/5 p-2"><strong className="block text-lg">{projectionCounts.excluded}</strong>excluded</div>
                <div className={`rounded p-2 ${projectionCounts.ambiguous ? "bg-red-400/10 text-red-200" : "bg-white/5"}`}><strong className="block text-lg">{projectionCounts.ambiguous}</strong>needs choice</div>
                <div className="rounded bg-white/5 p-2"><strong className="block text-lg">{projectionCounts.no_quantity}</strong>structural rows</div>
              </div>
              {detail.reviewCategory !== "label_column_review" ? projected.filter((projection) => projection.status === "ambiguous").map((projection) => <div key={projection.row.rowPath}
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
              </div>) : null}
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
            </>}

            <section className={`rounded border p-3 ${excludeFromIngest ? "border-red-400/60 bg-red-400/10" : "border-red-400/25 bg-[#080D12]"}`}>
              <label className="flex cursor-pointer items-start gap-3 text-sm">
                <input type="checkbox" className="mt-1 accent-red-400" checked={excludeFromIngest}
                  onChange={(event) => {
                    setExcludeFromIngest(event.target.checked);
                    if (event.target.checked) setEscalated(false);
                    else setExclusionReason("");
                  }} />
                <span><span className="block font-semibold text-red-200">Do not include this product in catalog ingest</span>
                  <span className="block text-xs text-text-secondary">This is a terminal product-level decision. The original DSLD data remains preserved for audit and possible future reconstruction.</span></span>
              </label>
              {excludeFromIngest ? <label className="mt-3 block text-xs font-semibold text-red-100">Reason
                <select className={`${inputClass} mt-1`} value={exclusionReason}
                  onChange={(event) => setExclusionReason(event.target.value as ServingSizeExclusionReason | "")}>
                  <option value="">Choose a reason…</option>
                  {exclusionReasons.map((reason) => <option key={reason.value} value={reason.value}>{reason.label}</option>)}
                </select>
              </label> : null}
            </section>

            {detail.resolutionKind !== "composite" ? <label className="flex cursor-pointer items-start gap-3 rounded border border-white/15 bg-[#080D12] p-3 text-sm">
              <input type="checkbox" className="mt-1 accent-amber-400" checked={escalated}
                onChange={(event) => {
                  setEscalated(event.target.checked);
                  if (event.target.checked) {
                    setExcludeFromIngest(false);
                    setExclusionReason("");
                  }
                }} />
              <span><span className="block font-semibold">Escalate — {detail.resolutionKind === "profile_variants"
                ? "cannot resolve the profile variants" : "cannot determine the canonical serving"}</span>
                <span className="block text-xs text-text-secondary">Save this label for a later decision; any admin can return and resolve it.</span></span>
            </label> : null}

            <div>{excludeFromIngest || detail.resolutionKind === "composite" || escalated || correctionOpen ? <label className="block text-sm font-semibold">Reviewer note (required)</label>
              : <button type="button" onClick={() => setNoteOpen((open) => !open)} className="text-sm font-semibold text-accent underline">
                {noteOpen ? "Hide reviewer note" : "Add reviewer note (optional)"}</button>}
              {excludeFromIngest || detail.resolutionKind === "composite" || escalated || correctionOpen || noteOpen ? <textarea className={`${inputClass} mt-2 min-h-20`} value={reviewerNote}
                onChange={(event) => setReviewerNote(event.target.value)} placeholder="Explain what the printed label shows." /> : null}</div>

            <div className="flex flex-wrap gap-2"><button type="button" disabled={saving
              || (!excludeFromIngest && detail.resolutionKind === "canonical" && !escalated && selectedOrder == null)} onClick={save}
              className={`rounded-full px-5 py-2 text-sm font-bold disabled:opacity-40 ${excludeFromIngest
                ? "bg-red-400 text-[#190404]" : "bg-accent text-[#03100E]"}`}>
              {saving ? "Saving…" : readOnlyPreview ? "Preview decision and continue"
                : excludeFromIngest ? "Exclude product from ingest"
                  : escalated ? "Save escalation"
                  : detail.resolutionKind === "composite" ? "Save combined serving"
                  : detail.resolutionKind === "profile_variants" ? "Save profile variants"
                  : "Save canonical serving"}</button>
              <button type="button" disabled={saving} onClick={() => setSelectedTaskId(next?.id ?? "")}
                className="rounded-full border border-white/15 px-5 py-2 text-sm font-semibold disabled:opacity-40">Skip for now</button></div>
          </div>
        </div>

        {detail.decisions.length ? <div className="border-t border-white/10 pt-4"><h4 className="mb-2 font-semibold">Decision history</h4>
          {detail.decisions.map((decision) => <p key={decision.id} className="mb-2 text-xs text-text-secondary">
            Rev {decision.taskRevision}: {humanize(decision.outcome)} by {decision.reviewerEmail} · {new Date(decision.decidedAt).toLocaleString()}
            {decision.selectedServingOrder ? ` · serving order ${decision.selectedServingOrder}` : ""}
            {decision.exclusionReason ? ` · ${humanize(decision.exclusionReason)}` : ""}
            {decision.reviewerNote ? ` — ${decision.reviewerNote}` : ""}
          </p>)}</div> : null}
      </div>}
    </div>
  </section>;
}
