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
  type DsldServingSize,
  type ReviewedServingContext,
  type ServingSizeIngredientRow,
  type ServingSizeExclusionReason,
  type ServingSizeProfileVariantRule,
  type ServingSizeQuantityOverride,
  type ServingSizeRangeEndpoint,
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
  "range_endpoint_review",
  "bundle_combination_review",
  "label_column_review",
  "canonical_choice_review",
  "unreferenced_serving_mapping_review",
  "composite_review",
  "profile_variant_review",
  "exclusion_review",
  "serving_extraction_review",
];

const categoryCopy: Record<ServingSizeReviewCategory, {
  title: string;
  short: string;
  instructions: string;
  style: string;
}> = {
  range_endpoint_review: {
    title: "Choose a serving-range endpoint",
    short: "Every ingredient has a complete minimum and maximum value set.",
    instructions: "Compare the printed range and explicitly choose the minimum or maximum as the catalog serving. Nothing is preselected and the source guidance remains unchanged.",
    style: "border-teal-300/40 bg-teal-300/5",
  },
  bundle_combination_review: {
    title: "Combine linked facts panels",
    short: "Several DSLD records belong to one physical package edition.",
    instructions: "Keep and combine a fixed, repeatable package. Exclude products whose contents change by day, phase, time of day, or another regimen.",
    style: "border-fuchsia-400/35 bg-fuchsia-400/5",
  },
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
  serving_extraction_review: {
    title: "Verify extracted serving sizes",
    short: "DSLD's structured serving conflicts with the printed label or its ingredient values.",
    instructions: "Compare the Facts-panel serving with DSLD. Confirm it, correct it, or record that the serving is correct and ingredient data caused the warning.",
    style: "border-amber-300/40 bg-amber-300/5",
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

type ProfileResolutionMode = "variants" | "single";
type ExtractionResolution = "confirm" | "correct" | "ingredient_review" | "escalate";

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

function servingUnitKey(value: string | null) {
  const compact = (value ?? "").toLowerCase()
    .replace(/vegetable|veggie/g, "v")
    .replace(/[^a-z0-9]/g, "");
  if (/^(?:v?caps?|capsules?)$/.test(compact)) return "capsule";
  if (/^(?:tabs?|tablets?)$/.test(compact)) return "tablet";
  if (/^(?:softgels?|softcaps?)$/.test(compact)) return "softgel";
  if (/^(?:scoops?)$/.test(compact)) return "scoop";
  if (/^(?:packets?|packs?)$/.test(compact)) return "packet";
  if (/^(?:gummies|gummys|gummy)$/.test(compact)) return "gummy";
  return compact.replace(/s$/, "");
}

function profileServingQuantityCandidates(row: ServingSizeIngredientRow, serving: DsldServingSize) {
  const servingUnit = servingUnitKey(serving.unit);
  const metadataMatches = row.quantities.filter((quantity) => {
    const amountMatches = quantity.servingSizeQuantity != null
      && ((serving.minQuantity != null
        && Math.abs(quantity.servingSizeQuantity - serving.minQuantity) < 1e-9)
        || (serving.maxQuantity != null
          && Math.abs(quantity.servingSizeQuantity - serving.maxQuantity) < 1e-9));
    if (!amountMatches) return false;
    const quantityUnit = servingUnitKey(quantity.servingSizeUnit);
    return !servingUnit || !quantityUnit || servingUnit === quantityUnit;
  });
  if (metadataMatches.length) return metadataMatches;
  return row.quantities.filter((quantity) => quantity.servingSizeOrder === serving.order);
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

function singleProfileServingSuggestion(detail: ServingSizeReviewTaskDetail) {
  const referenceCounts = new Map<number, number>();
  for (const row of detail.sourceIngredientRows) {
    for (const quantity of row.quantities) {
      if (quantity.servingSizeOrder == null) continue;
      referenceCounts.set(quantity.servingSizeOrder,
        (referenceCounts.get(quantity.servingSizeOrder) ?? 0) + 1);
    }
  }
  const serving = [...detail.sourceServingSizes].sort((left, right) =>
    (referenceCounts.get(right.order) ?? 0) - (referenceCounts.get(left.order) ?? 0)
    || Number(Boolean(right.inSFB)) - Number(Boolean(left.inSFB))
    || left.order - right.order)[0];
  if (!serving) return null;
  const sourceContext = detail.sourceContexts.find((candidate) =>
    candidate.sourceServingOrders.includes(serving.order));
  if (!sourceContext) return null;

  const embeddedServingKeys = new Map<string, { amount: number; unit: string | null; count: number }>();
  for (const row of detail.sourceIngredientRows) {
    for (const quantity of row.quantities) {
      if (quantity.servingSizeOrder !== serving.order || quantity.servingSizeQuantity == null) continue;
      const key = `${quantity.servingSizeQuantity}\u0000${quantity.servingSizeUnit ?? ""}`;
      const current = embeddedServingKeys.get(key);
      embeddedServingKeys.set(key, {
        amount: quantity.servingSizeQuantity,
        unit: quantity.servingSizeUnit,
        count: (current?.count ?? 0) + 1,
      });
    }
  }
  const embeddedServing = embeddedServingKeys.size === 1 ? [...embeddedServingKeys.values()][0] : null;
  const context: ReviewedServingContext = {
    ...sourceContext,
    contextKey: "canonical-serving",
    sourceServingOrders: [serving.order],
    householdQuantityMin: embeddedServing?.amount ?? sourceContext.householdQuantityMin,
    householdQuantityMax: embeddedServing?.amount ?? sourceContext.householdQuantityMax,
    householdUnit: embeddedServing?.unit ?? sourceContext.householdUnit,
    contextLabel: null,
    preparationContext: null,
    labelText: null,
  };
  return { order: serving.order, context };
}

function projections(
  rows: ServingSizeIngredientRow[],
  selectedOrder: number | null,
  overrides: Map<string, number | null>,
  independentColumns = false,
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
    if (independentColumns) {
      if (row.quantities.length === 0) {
        return { row, status: "no_quantity", selected: null, candidates: [] };
      }
      if (row.quantities.length === 1) {
        return { row, status: "selected", selected: row.quantities[0], candidates: row.quantities };
      }
      return { row, status: "ambiguous", selected: null, candidates: row.quantities };
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
  const [previewComponentId, setPreviewComponentId] = useState<number | null>(null);
  const [detail, setDetail] = useState<ServingSizeReviewTaskDetail | null>(null);
  const [range, setRange] = useState({ first: 0, last: -1 });
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<number | null>(null);
  const [selectedRangeEndpoint, setSelectedRangeEndpoint] = useState<ServingSizeRangeEndpoint | null>(null);
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
  const [profileResolutionMode, setProfileResolutionMode] = useState<ProfileResolutionMode>("variants");
  const [extractionResolution, setExtractionResolution] = useState<ExtractionResolution>("confirm");
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
  const bundleReview = detail?.reviewCategory === "bundle_combination_review";
  const rangeEndpointReview = detail?.reviewCategory === "range_endpoint_review";
  const selectedRangeOption = detail?.rangeEndpointOptions.find((option) =>
    option.endpoint === selectedRangeEndpoint) ?? null;
  const previewComponent = detail?.sourceBundleComponents.find((component) =>
    component.dsldLabelId === previewComponentId) ?? detail?.sourceBundleComponents[0] ?? null;
  const next = useMemo(() => {
    const selected = scopedTasks.find((task) => task.id === selectedTaskId);
    return selected?.status === "escalated"
      ? nextEscalation(scopedTasks, selectedTaskId, selected.resolutionKind)
      : nextTask(scopedTasks, selectedTaskId, range.first, range.last);
  },
    [scopedTasks, selectedTaskId, range]);
  const projected = useMemo(() => projections(detail?.sourceIngredientRows ?? [], selectedOrder,
    quantityOverrides, detail?.reviewCategory === "label_column_review"),
  [detail, selectedOrder, quantityOverrides]);
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
      row.quantities.length), 0);
  }, [detail, selectedOrder]);
  const profileUnassignedRows = useMemo(() => {
    if (!detail || detail.resolutionKind !== "profile_variants") return [];
    return detail.sourceIngredientRows.filter((row) => row.quantities.length > 0
      && detail.sourceContexts.every((sourceContext) => {
        const serving = detail.sourceServingSizes.find((candidate) =>
          sourceContext.sourceServingOrders.includes(candidate.order));
        return !serving || profileServingQuantityCandidates(row, serving).length === 0;
      }));
  }, [detail]);

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
    setPreviewComponentId(detail.sourceBundleComponents[0]?.dsldLabelId ?? null);
    setGlobalColumn(null);
    setGlobalMapping("");
    setProfileColumns(new Map());
    setSelectedRangeEndpoint(null);
    if (detail.reviewCategory === "range_endpoint_review") {
      setProfileResolutionMode("variants");
      setSelectedOrder(null);
      setContext(null);
      setCorrectionOpen(false);
      setEscalated(false);
      setExcludeFromIngest(false);
      setExclusionReason("");
      setQuantityOverrides(new Map());
      setProfileRules([]);
      setProfileQuantityOverrides(new Map());
      setReviewerNote("");
      setNoteOpen(false);
      productNameRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
      return;
    }
    if (detail.reviewCategory === "serving_extraction_review") {
      const effectiveContext = detail.reviewedServingContexts?.[0]
        ?? detail.suggestedServingContext ?? detail.sourceContexts[0] ?? null;
      setExtractionResolution("confirm");
      setSelectedOrder(null);
      setContext(effectiveContext ? editableContext(effectiveContext) : null);
      setCorrectionOpen(false);
      setEscalated(false);
      setExcludeFromIngest(false);
      setExclusionReason("");
      setQuantityOverrides(new Map());
      setProfileRules([]);
      setProfileQuantityOverrides(new Map());
      setReviewerNote("");
      setNoteOpen(false);
      productNameRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
      return;
    }
    if (detail.resolutionKind === "profile_variants") {
      setProfileResolutionMode("variants");
      setSelectedOrder(null);
      setContext(null);
      setCorrectionOpen(false);
      setEscalated(false);
      setExcludeFromIngest(false);
      setExclusionReason("");
      setQuantityOverrides(new Map());
      setProfileRules(detail.profileVariantRules ?? inferProfileRules(detail));
      const inferredOverrides = new Map((detail.quantityOverrides ?? [])
        .filter((override) => override.contextKey)
        .map((override) => [`${override.contextKey}\u0000${override.rowPath}`, override.selectedQuantityIndex]));
      for (const sourceContext of detail.sourceContexts) {
        const serving = detail.sourceServingSizes.find((candidate) =>
          sourceContext.sourceServingOrders.includes(candidate.order));
        if (!serving) continue;
        for (const row of detail.sourceIngredientRows) {
          const candidates = profileServingQuantityCandidates(row, serving);
          const key = `${sourceContext.contextKey}\u0000${row.rowPath}`;
          if (candidates.length === 1 && !inferredOverrides.has(key)) {
            inferredOverrides.set(key, candidates[0].sourceQuantityIndex);
          } else if (candidates.length === 0 && !inferredOverrides.has(key)) {
            inferredOverrides.set(key, null);
          }
        }
      }
      setProfileQuantityOverrides(inferredOverrides);
      setReviewerNote("");
      setNoteOpen(false);
      productNameRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
      return;
    }
    if (detail.resolutionKind === "composite") {
      setProfileResolutionMode("variants");
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
      setEscalated(detail.status === "escalated");
      setExcludeFromIngest(false);
      setExclusionReason("");
      setQuantityOverrides(new Map());
      setProfileRules([]);
      setProfileQuantityOverrides(new Map());
      setReviewerNote("");
      setNoteOpen(detail.reviewCategory !== "bundle_combination_review");
      productNameRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
      return;
    }
    const order = detail.selectedServingOrder ?? detail.policySuggestedServingOrder;
    setProfileResolutionMode("variants");
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

  function chooseExtractionResolution(resolution: ExtractionResolution) {
    if (!detail || detail.reviewCategory !== "serving_extraction_review") return;
    setExtractionResolution(resolution);
    setEscalated(resolution === "escalate");
    setExcludeFromIngest(false);
    setExclusionReason("");
    setError("");
    if (resolution === "correct") {
      const startingContext = detail.suggestedServingContext ?? detail.sourceContexts[0] ?? null;
      setContext(startingContext ? editableContext(startingContext) : null);
    }
    if (resolution === "confirm") {
      setReviewerNote("");
      setNoteOpen(false);
    } else {
      setNoteOpen(true);
    }
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
      const selected = row.quantities[position]
        ?? (row.quantities.length === 1 ? row.quantities[0] : undefined);
      if (selected) {
        nextMap.set(row.rowPath, selected.sourceQuantityIndex);
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

  function chooseProfileResolution(mode: ProfileResolutionMode) {
    if (!detail || detail.resolutionKind !== "profile_variants") return;
    setProfileResolutionMode(mode);
    setEscalated(false);
    setExcludeFromIngest(false);
    setExclusionReason("");
    setError("");
    if (mode === "variants") {
      setSelectedOrder(null);
      setContext(null);
      setCorrectionOpen(false);
      setQuantityOverrides(new Map());
      setReviewerNote("");
      setNoteOpen(false);
      return;
    }
    const suggestion = singleProfileServingSuggestion(detail);
    setSelectedOrder(suggestion?.order ?? null);
    setContext(suggestion ? editableContext(suggestion.context) : null);
    setCorrectionOpen(true);
    setQuantityOverrides(new Map());
    setReviewerNote("The Facts panel has one non-profile-specific serving; the gender-specific text is suggested-use guidance.");
    setNoteOpen(true);
  }

  function applyProfileColumn(contextKey: string, serving: DsldServingSize, position: number) {
    if (!detail) return;
    setProfileQuantityOverrides((current) => {
      const nextMap = new Map(current);
      for (const row of detail.sourceIngredientRows) {
        const candidates = profileServingQuantityCandidates(row, serving);
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
    const extractionReview = detail.reviewCategory === "serving_extraction_review";
    const rangeReview = detail.reviewCategory === "range_endpoint_review";
    const composite = detail.resolutionKind === "composite";
    const profileVariants = detail.resolutionKind === "profile_variants"
      && profileResolutionMode === "variants";
    if (!excludeFromIngest && composite && !context) {
      setError("Define the one combined serving SuppVis should use.");
      return;
    }
    if (rangeReview && !escalated && selectedRangeEndpoint == null) {
      setError("Choose the minimum or maximum serving endpoint.");
      return;
    }
    if (!excludeFromIngest && !rangeReview && !extractionReview && !composite && !profileVariants && !escalated
      && (selectedOrder == null || !context)) {
      setError("Choose the one serving size the app should use.");
      return;
    }
    if (!excludeFromIngest && extractionReview && extractionResolution === "correct" && !context) {
      setError("Enter the serving printed on the label.");
      return;
    }
    if (!excludeFromIngest && !rangeReview && !composite && !profileVariants && !escalated
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
        const serving = detail.sourceServingSizes.find((candidate) =>
          sourceContext.sourceServingOrders.includes(candidate.order));
        if (!serving) {
          setError(`No source serving was found for ${sourceContext.contextKey}.`);
          return;
        }
        for (const row of detail.sourceIngredientRows) {
          if (!row.quantities.length) continue;
          const matches = profileServingQuantityCandidates(row, serving);
          const key = `${sourceContext.contextKey}\u0000${row.rowPath}`;
          if (!profileQuantityOverrides.has(key)) {
            setError(`Confirm one value for ${row.name || "an ingredient"} in ${sourceContext.contextKey}.`);
            return;
          }
          const selectedQuantityIndex = profileQuantityOverrides.get(key);
          if (!matches.length && selectedQuantityIndex !== null) {
            setError(`${row.name || "An ingredient"} must be excluded from ${sourceContext.contextKey}.`);
            return;
          }
          if (matches.length && (selectedQuantityIndex == null || !matches.some((quantity) =>
            quantity.sourceQuantityIndex === selectedQuantityIndex))) {
            setError(`Confirm one matching value for ${row.name || "an ingredient"} in ${sourceContext.contextKey}.`);
            return;
          }
        }
      }
      for (const row of detail.sourceIngredientRows) {
        if (!row.quantities.length) continue;
        const retained = detail.sourceContexts.some((sourceContext) =>
          profileQuantityOverrides.get(`${sourceContext.contextKey}\u0000${row.rowPath}`) != null);
        if (!retained) {
          setError(`No profile variant retains ${row.name || "an ingredient"}. Escalate this label.`);
          return;
        }
      }
    }
    if (excludeFromIngest && !exclusionReason) {
      setError("Choose why this product should be excluded from catalog ingest.");
      return;
    }
    const extractionNeedsNote = extractionReview && extractionResolution !== "confirm";
    if ((excludeFromIngest || (composite && !bundleReview) || escalated || correctionOpen || extractionNeedsNote)
      && !reviewerNote.trim()) {
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
      const extractionBody = extractionResolution === "correct" ? {
        expectedRevision: detail.revision,
        outcome: "corrected",
        reviewedServingContexts: [reviewedContext(context!,
          detail.sourceServingSizes.map((serving) => serving.order))],
        selectedServingOrder: null,
        quantityOverrides: null,
        profileVariantRules: null,
        exclusionReason: null,
        reviewerNote: reviewerNote.trim(),
      } : extractionResolution === "ingredient_review" ? {
        expectedRevision: detail.revision,
        outcome: "serving_correct_ingredient_review",
        reviewedServingContexts: null,
        selectedServingOrder: null,
        quantityOverrides: null,
        profileVariantRules: null,
        exclusionReason: null,
        reviewerNote: reviewerNote.trim(),
      } : extractionResolution === "escalate" ? {
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
        outcome: "confirmed_correct",
        reviewedServingContexts: null,
        selectedServingOrder: null,
        quantityOverrides: null,
        profileVariantRules: null,
        exclusionReason: null,
        reviewerNote: reviewerNote.trim() || null,
      };
      const body = rangeReview && !escalated ? {
        expectedRevision: detail.revision,
        outcome: "canonical_selected",
        selectedRangeEndpoint,
        reviewedServingContexts: null,
        selectedServingOrder: null,
        quantityOverrides: null,
        profileVariantRules: null,
        exclusionReason: null,
        reviewerNote: reviewerNote.trim() || null,
      } : excludeFromIngest ? {
        expectedRevision: detail.revision,
        outcome: "excluded_from_ingest",
        reviewedServingContexts: null,
        selectedServingOrder: null,
        quantityOverrides: null,
        profileVariantRules: null,
        exclusionReason,
        reviewerNote: reviewerNote.trim(),
      } : extractionReview ? extractionBody : escalated ? {
        expectedRevision: detail.revision,
        outcome: "escalated",
        reviewedServingContexts: null,
        selectedServingOrder: null,
        quantityOverrides: null,
        profileVariantRules: null,
        exclusionReason: null,
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
      } : profileVariants ? {
        expectedRevision: detail.revision,
        outcome: "profile_variants_retained",
        reviewedServingContexts: detail.sourceContexts,
        selectedServingOrder: null,
        quantityOverrides: profileOverrides,
        profileVariantRules: profileRules,
        exclusionReason: null,
        reviewerNote: reviewerNote.trim() || null,
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
        : rangeReview
        ? "Serving endpoint saved. Moved to the next label."
        : extractionReview && extractionResolution === "correct"
        ? "Corrected serving saved. Moved to the next label."
        : extractionReview && extractionResolution === "ingredient_review"
        ? "Serving confirmed and ingredient follow-up recorded. Moved to the next label."
        : extractionReview
        ? "Serving decision saved. Moved to the next label."
        : escalated
        ? "Escalation saved. Moved to the next label."
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
      <p className="mt-2 text-xs text-text-muted">Queue {batchKey}. Automatically resolved labels are stored separately and do not appear here.</p>
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
            <p className="text-sm text-text-secondary">{detail.brandName} · DSLD {detail.dsldLabelId}{detail.offMarket ? " · off market" : ""}
              {detail.componentCount > 1 ? ` · ${detail.componentCount} linked component records` : ""}</p></div>
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
              <a href={previewComponent?.labelPdfUrl ?? detail.labelPdfUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-accent underline">Open label PDF</a></div>
            {detail.sourceBundleComponents.length > 1 ? <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
              {detail.sourceBundleComponents.map((component, index) => <button key={component.dsldLabelId}
                type="button" onClick={() => setPreviewComponentId(component.dsldLabelId)}
                className={`shrink-0 rounded border px-3 py-2 text-left text-xs ${previewComponent?.dsldLabelId === component.dsldLabelId
                  ? "border-accent bg-accent/10 text-accent" : "border-white/15 bg-[#080D12] text-text-secondary"}`}>
                <span className="block font-semibold">{index + 1}. {component.labelName}</span>
                <span className="mt-0.5 block text-[10px] opacity-70">DSLD {component.dsldLabelId}</span>
              </button>)}
            </div> : null}
            <Group1LabelPreview key={`${detail.id}:${previewComponent?.dsldLabelId ?? detail.dsldLabelId}`}
              labelId={previewComponent?.dsldLabelId ?? detail.dsldLabelId}
              sourceName={rangeEndpointReview ? "Supplement Facts" : "Serving Size"}
              suggestedFieldName={rangeEndpointReview ? "Nutrition Facts" : "Serving Size"}
              focusMode={rangeEndpointReview ? "facts-panel" : "row"} />
            {next && next.id !== detail.id ? <Group1LabelPreview
              key={`prefetch:${next.id}`}
              labelId={next.dsldLabelId}
              sourceName={next.reviewCategory === "range_endpoint_review" ? "Supplement Facts" : "Serving Size"}
              suggestedFieldName={next.reviewCategory === "range_endpoint_review" ? "Nutrition Facts" : "Serving Size"}
              focusMode={next.reviewCategory === "range_endpoint_review" ? "facts-panel" : "row"}
              prefetchOnly /> : null}
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

            {detail.reviewCategory !== "serving_extraction_review"
              && detail.resolutionKind === "profile_variants" ? <fieldset className="rounded border border-sky-400/35 bg-sky-400/5 p-3">
              <legend className="px-1 font-semibold text-sky-100">What does the Facts panel actually contain?</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <label className={`cursor-pointer rounded border p-3 ${profileResolutionMode === "variants"
                  ? "border-sky-300 bg-sky-400/10" : "border-white/15 bg-[#080D12]"}`}>
                  <span className="flex items-start gap-2"><input type="radio" name="profile-resolution"
                    className="mt-1 accent-sky-400" checked={profileResolutionMode === "variants"}
                    onChange={() => chooseProfileResolution("variants")} />
                    <span><span className="block text-sm font-semibold">Profile-specific serving variants</span>
                      <span className="mt-1 block text-xs text-text-secondary">The Facts panel prints different servings or value columns for each profile.</span></span></span>
                </label>
                <label className={`cursor-pointer rounded border p-3 ${profileResolutionMode === "single"
                  ? "border-accent bg-accent/10" : "border-white/15 bg-[#080D12]"}`}>
                  <span className="flex items-start gap-2"><input type="radio" name="profile-resolution"
                    className="mt-1 accent-emerald-400" checked={profileResolutionMode === "single"}
                    onChange={() => chooseProfileResolution("single")} />
                    <span><span className="block text-sm font-semibold">Single serving — not profile-specific</span>
                      <span className="mt-1 block text-xs text-text-secondary">Gender or age appears only in suggested-use directions. Save one shared Facts-panel serving.</span></span></span>
                </label>
              </div>
            </fieldset> : null}

            {rangeEndpointReview ? <>
              <section className="rounded border border-teal-300/35 bg-teal-300/5 p-3">
                <h4 className="font-semibold text-teal-100">Printed serving guidance</h4>
                {detail.sourceServingSizes.map((serving) => <div key={serving.order}
                  className="mt-3 rounded border border-white/15 bg-[#080D12] p-3">
                  <p className="font-semibold">Structured range: {formatServing(
                    serving.minQuantity, serving.maxQuantity, serving.unit,
                  )}</p>
                  <p className="mt-1 text-sm text-text-secondary">
                    Label guidance: {serving.notes?.trim() || "Not recorded"}
                  </p>
                </div>)}
                <p className="mt-3 text-xs text-text-secondary">
                  The guidance above stays unchanged. Your choice only sets the one numerical serving basis used by the catalog.
                </p>
              </section>

              <fieldset className="space-y-2">
                <legend className="font-semibold">Choose the canonical serving basis</legend>
                <p className="text-xs text-text-secondary">
                  No option is recommended or preselected. Compare both complete ingredient columns with the label and choose one.
                </p>
                {detail.rangeEndpointOptions.map((option) => {
                  const serving = detail.sourceServingSizes.find((candidate) =>
                    candidate.order === option.selectedServingOrder);
                  const amount = option.endpoint === "minimum" ? serving?.minQuantity : serving?.maxQuantity;
                  return <label key={option.endpoint}
                    className={`block cursor-pointer rounded border p-3 ${selectedRangeEndpoint === option.endpoint
                      ? "border-accent bg-accent/10" : "border-white/15 bg-[#080D12] hover:border-accent/50"}`}>
                    <span className="flex items-start gap-3"><input type="radio" name="range-endpoint"
                      className="mt-1 accent-emerald-400" checked={selectedRangeEndpoint === option.endpoint}
                      onChange={() => {
                        setSelectedRangeEndpoint(option.endpoint);
                        setEscalated(false);
                        setError("");
                      }} />
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold capitalize">Use the {option.endpoint}</span>
                        <span className="mt-1 block text-lg font-bold text-accent">
                          {formatServing(amount ?? null, amount ?? null, serving?.unit ?? null)}
                        </span>
                        <span className="mt-1 block text-xs text-text-secondary">
                          Complete values for {option.projectedRows.length} normalized ingredient rows
                        </span>
                        <span className="mt-2 block space-y-1 text-xs text-text-muted">
                          {option.projectedRows.slice(0, 4).map((row) => <span key={row.logicalRowKey}
                            className="block">{row.name}: {row.operator ? `${row.operator} ` : ""}
                            {row.quantity ?? "not recorded"}{row.unit ? ` ${row.unit}` : ""}</span>)}
                        </span>
                      </span></span>
                  </label>;
                })}
              </fieldset>

              {selectedRangeOption ? <details className="rounded border border-white/10 p-3 text-xs">
                <summary className="cursor-pointer font-semibold">
                  Preview the selected ingredient values ({selectedRangeOption.projectedRows.length})
                </summary>
                <div className="mt-2 max-h-80 space-y-1 overflow-y-auto">
                  {selectedRangeOption.projectedRows.map((row) => <div key={row.logicalRowKey}
                    className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded bg-[#080D12] p-2">
                    <span><span className="font-semibold">{row.name || "Unnamed row"}</span>
                      {row.ancestorNames.length ? <span className="block text-text-muted">
                        under {row.ancestorNames.join(" › ")}
                      </span> : null}</span>
                    <span className="text-accent">{row.operator ? `${row.operator} ` : ""}
                      {row.quantity ?? "not recorded"}{row.unit ? ` ${row.unit}` : ""}</span>
                  </div>)}
                </div>
              </details> : null}
            </> : detail.reviewCategory === "serving_extraction_review" ? <>
              <section className="rounded border border-amber-300/30 bg-amber-300/5 p-3">
                <h4 className="font-semibold text-amber-100">DSLD extracted serving</h4>
                {detail.sourceServingSizes.map((serving) => <div key={serving.order}
                  className="mt-3 rounded border border-white/15 bg-[#080D12] p-3">
                  <p className="font-semibold">Structured value: {formatServing(
                    serving.minQuantity, serving.maxQuantity, serving.unit,
                  )}</p>
                  <p className="mt-1 text-sm text-text-secondary">
                    Extracted description: {serving.notes?.trim() || "Not recorded"}
                  </p>
                </div>)}
                <p className="mt-3 text-xs text-text-secondary">
                  Verify the serving printed inside the Nutrition Facts or Supplement Facts panel. Suggested-use directions belong in guidance, not in the canonical amount.
                </p>
              </section>

              {detail.suggestedServingContext ? <section className="rounded border border-sky-400/30 bg-sky-400/5 p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-sky-200">Conservative starting suggestion</p>
                <p className="mt-2 text-sm text-text-primary">
                  {detail.suggestedServingContext.householdQuantityMin != null
                    ? `${formatServing(detail.suggestedServingContext.householdQuantityMin,
                      detail.suggestedServingContext.householdQuantityMax,
                      detail.suggestedServingContext.householdUnit)}` : "Household measure not inferred"}
                  {detail.suggestedServingContext.metricQuantityMin != null
                    ? ` · ${formatServing(detail.suggestedServingContext.metricQuantityMin,
                      detail.suggestedServingContext.metricQuantityMax,
                      detail.suggestedServingContext.metricUnit)}` : ""}
                </p>
                <p className="mt-1 text-xs text-text-secondary">This is only a prefilled starting point. Compare it with the label before saving.</p>
              </section> : null}

              <fieldset className="space-y-2">
                <legend className="font-semibold">Choose the serving-extraction result</legend>
                {([
                  ["confirm", "DSLD serving is correct", "The structured serving accurately represents the Facts-panel serving."],
                  ["correct", "Correct the serving", "Enter the printed household measure, metric equivalent, and description separately."],
                  ["ingredient_review", "Serving is correct — ingredient data needs later review", "The serving itself is valid; an ingredient amount or serving pointer caused the warning."],
                  ["escalate", "Escalate — cannot determine the serving", "Save this label for a later decision."],
                ] as Array<[ExtractionResolution, string, string]>).map(([value, title, description]) => <label key={value}
                  className={`block cursor-pointer rounded border p-3 ${extractionResolution === value
                    ? "border-accent bg-accent/10" : "border-white/15 bg-[#080D12] hover:border-accent/50"}`}>
                  <span className="flex items-start gap-3"><input type="radio" name="extraction-resolution"
                    className="mt-1 accent-emerald-400" checked={extractionResolution === value}
                    onChange={() => chooseExtractionResolution(value)} />
                    <span><span className="block text-sm font-semibold">{title}</span>
                      <span className="mt-1 block text-xs text-text-secondary">{description}</span></span></span>
                </label>)}
              </fieldset>

              {extractionResolution === "correct" && context ? <section className="rounded border border-accent/30 bg-accent/5 p-3">
                <h4 className="font-semibold">Enter exactly what the Facts panel prints</h4>
                <p className="mt-1 text-xs text-text-secondary">
                  Preserve a real printed range here. Choosing one scalar from a legitimate range happens in the later range review.
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <label className="text-xs">Household minimum<input className={`${inputClass} mt-1`} type="number" min="0" step="any"
                    value={context.householdQuantityMin} onChange={(event) => updateContext({ householdQuantityMin: event.target.value })} /></label>
                  <label className="text-xs">Household maximum<input className={`${inputClass} mt-1`} type="number" min="0" step="any"
                    value={context.householdQuantityMax} onChange={(event) => updateContext({ householdQuantityMax: event.target.value })}
                    placeholder="Leave blank if not a range" /></label>
                  <label className="text-xs">Household unit<input className={`${inputClass} mt-1`} value={context.householdUnit}
                    onChange={(event) => updateContext({ householdUnit: event.target.value })} placeholder="scoops" /></label>
                  <label className="text-xs">Metric minimum<input className={`${inputClass} mt-1`} type="number" min="0" step="any"
                    value={context.metricQuantityMin} onChange={(event) => updateContext({ metricQuantityMin: event.target.value })} /></label>
                  <label className="text-xs">Metric maximum<input className={`${inputClass} mt-1`} type="number" min="0" step="any"
                    value={context.metricQuantityMax} onChange={(event) => updateContext({ metricQuantityMax: event.target.value })}
                    placeholder="Leave blank if not a range" /></label>
                  <label className="text-xs">Metric unit<input className={`${inputClass} mt-1`} value={context.metricUnit}
                    onChange={(event) => updateContext({ metricUnit: event.target.value })} placeholder="g" /></label>
                  <label className="text-xs sm:col-span-3">Printed serving description<input className={`${inputClass} mt-1`} value={context.labelText}
                    onChange={(event) => updateContext({ labelText: event.target.value })} placeholder="4 scoops (150 g)" /></label>
                  <label className="text-xs sm:col-span-3">Serving guidance, if separate<input className={`${inputClass} mt-1`} value={context.preparationContext}
                    onChange={(event) => updateContext({ preparationContext: event.target.value })}
                    placeholder="For example: Add 1–2 tablespoons to a meal or shake" /></label>
                </div>
              </section> : null}

              {extractionResolution === "ingredient_review" ? <p className="rounded border border-blue-400/30 bg-blue-400/5 p-3 text-xs text-blue-100">
                This closes the serving-size task while preserving a distinct ingredient-level follow-up for later queue design.
              </p> : null}
            </> : detail.resolutionKind === "profile_variants" && profileResolutionMode === "variants" ? <>
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
                  const mappedRows = detail.sourceIngredientRows.map((row) => ({
                    row,
                    candidates: profileServingQuantityCandidates(row, serving),
                  }));
                  const matchedRows = mappedRows.filter((entry) => entry.candidates.length === 1);
                  const ambiguousRows = mappedRows.filter((entry) => entry.candidates.length > 1);
                  const missingRows = mappedRows.filter((entry) =>
                    entry.row.quantities.length > 0 && entry.candidates.length === 0);
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
                    {matchedRows.length ? <div className="mt-3 rounded border border-accent/30 bg-accent/5 p-3">
                      <p className="text-xs font-semibold text-accent">
                        {matchedRows.length} ingredient {matchedRows.length === 1 ? "value" : "values"} matched to this serving
                      </p>
                      <p className="mt-1 text-xs text-text-secondary">
                        Matched using the printed serving amount and unit, even when DSLD&apos;s serving-order pointer is wrong.
                      </p>
                      <div className="mt-2 space-y-1 text-xs text-text-secondary">{matchedRows.slice(0, 4).map((entry) =>
                        <p key={entry.row.rowPath}>{entry.row.name}: {formatQuantity(entry.candidates[0])}</p>)}</div>
                    </div> : null}
                    {ambiguousRows.length ? <div className="mt-3 rounded border border-amber-400/30 bg-amber-400/5 p-3">
                      <p className="text-xs font-semibold text-amber-100">Choose one printed value column for this variant</p>
                      <div className="mt-2 flex flex-wrap gap-2">{Array.from({ length: columnCount }, (_, position) =>
                        <button key={position} type="button" onClick={() => applyProfileColumn(
                          sourceContext.contextKey, serving, position,
                        )} className={`rounded border px-3 py-2 text-xs font-semibold ${profileColumns.get(sourceContext.contextKey) === position
                          ? "border-accent bg-accent/15 text-accent" : "border-white/15"}`}>
                          Column {position + 1}
                        </button>)}</div>
                      <div className="mt-2 space-y-1 text-xs text-text-secondary">{ambiguousRows.slice(0, 3).map((entry) =>
                        <p key={entry.row.rowPath}>{entry.row.name}: {entry.candidates.map(formatQuantity).join(" | ")}</p>)}</div>
                    </div> : null}
                    {missingRows.length ? <div className="mt-3 rounded border border-white/15 bg-white/5 p-3">
                      <p className="text-xs font-semibold text-text-primary">
                        {missingRows.length} ingredient {missingRows.length === 1 ? "row belongs" : "rows belong"} to another profile
                      </p>
                      <p className="mt-1 text-xs text-text-secondary">
                        {missingRows.length === 1 ? "It is" : "They are"} excluded from this variant and retained in the matching variant.
                      </p>
                      <p className="mt-2 text-xs text-text-muted">{missingRows.map((entry) => entry.row.name || "Unnamed row").join(", ")}</p>
                    </div> : null}
                  </div>;
                })}</div>
                {profileUnassignedRows.length ? <div className="mt-3 rounded border border-red-400/35 bg-red-400/10 p-3">
                  <p className="text-xs font-semibold text-red-200">
                    {profileUnassignedRows.length} ingredient {profileUnassignedRows.length === 1 ? "row does" : "rows do"} not match any profile
                  </p>
                  <p className="mt-1 text-xs text-text-secondary">Escalate this label so no source data is silently dropped.</p>
                  <p className="mt-2 text-xs text-red-100">
                    {profileUnassignedRows.map((row) => row.name || "Unnamed row").join(", ")}
                  </p>
                </div> : null}
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
                <h4 className="font-semibold text-violet-100">1. {bundleReview
                  ? "Review the linked package components" : "Confirm the package components"}</h4>
                <p className="mt-1 text-xs text-text-secondary">
                  {bundleReview
                    ? "DSLD stored these facts panels as separate records. Confirm whether they form one fixed, repeatable package or an unsupported changing regimen."
                    : "This label contains several serving rows that together make one package or regimen. All of them will remain as source evidence."}
                </p>
                <div className="mt-3 space-y-2">
                  {bundleReview ? detail.sourceBundleComponents.map((component, componentIndex) => {
                    const rows = detail.sourceIngredientRows.filter((row) =>
                      row.rowPath.startsWith(`component:${component.dsldLabelId}/`));
                    return <div key={component.dsldLabelId}
                      className="rounded border border-violet-300/20 bg-[#080D12] p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div><p className="font-semibold">{componentIndex + 1}. {component.labelName}</p>
                          <p className="mt-1 text-xs text-text-muted">DSLD {component.dsldLabelId}
                            {component.entryDate ? ` · entered ${component.entryDate}` : ""}
                            {component.offMarket ? " · off market" : ""}</p></div>
                        <button type="button" onClick={() => setPreviewComponentId(component.dsldLabelId)}
                          className="text-xs font-semibold text-accent underline">Show this label</button>
                      </div>
                      <div className="mt-2 space-y-1 text-xs text-text-secondary">
                        {component.sourceServingSizes.map((serving) => <p key={serving.order}>
                          Serving: {formatServing(serving.minQuantity, serving.maxQuantity, serving.unit)}
                          {serving.notes?.trim() ? ` — ${serving.notes.trim()}` : ""}
                        </p>)}
                        <p>{rows.length} ingredient {rows.length === 1 ? "row" : "rows"}</p>
                      </div>
                      <details className="mt-2 text-xs"><summary className="cursor-pointer font-semibold text-violet-100">
                        Show component ingredients</summary>
                        <div className="mt-2 max-h-56 space-y-1 overflow-y-auto">{rows.map((row) => <div key={row.rowPath}
                          className="rounded bg-black/20 p-2"><span className="font-semibold">{row.name || "Unnamed row"}</span>
                          {row.ancestorNames.length ? <span className="block text-text-muted">under {row.ancestorNames.join(" › ")}</span> : null}
                          <span className="block text-text-secondary">{row.quantities.length
                            ? row.quantities.map(formatQuantity).join(" · ") : "structural row"}</span></div>)}</div>
                      </details>
                    </div>;
                  }) : detail.sourceServingSizes.map((serving) => <div key={serving.order}
                    className="rounded border border-violet-300/20 bg-[#080D12] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold">Component {serving.order}: {formatServing(serving.minQuantity, serving.maxQuantity, serving.unit)}</span>
                      <span className="text-xs text-text-muted">DSLD serving order {serving.order}</span>
                    </div>
                    <p className="mt-1 text-sm text-text-secondary">{serving.notes?.trim() || "No additional serving description"}</p>
                  </div>)}
                </div>
                {bundleReview ? <p className="mt-3 text-[11px] text-text-muted">
                  Edition grouping: {detail.editionGroupingConfidence ?? "unknown"} confidence · {detail.editionGroupingEvidence.map(humanize).join(" · ")}
                </p> : null}
              </section>

              {bundleReview ? <fieldset className="rounded border border-accent/25 bg-accent/5 p-3">
                <legend className="px-1 font-semibold">2. Decide whether SuppVis can represent this package</legend>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  <label className={`cursor-pointer rounded border p-3 ${!excludeFromIngest && !escalated
                    ? "border-accent bg-accent/10" : "border-white/15 bg-[#080D12]"}`}>
                    <span className="flex items-start gap-2"><input type="radio" name="bundle-resolution"
                      className="mt-1 accent-emerald-400" checked={!excludeFromIngest && !escalated}
                      onChange={() => {
                        setExcludeFromIngest(false);
                        setEscalated(false);
                        setExclusionReason("");
                      }} />
                      <span><span className="block text-sm font-semibold">Combine into one canonical product</span>
                        <span className="mt-1 block text-xs text-text-secondary">Every component belongs to the same fixed serving each time. Ingest will flatten the rows and add matching ingredient amounts.</span></span></span>
                  </label>
                  <label className={`cursor-pointer rounded border p-3 ${excludeFromIngest
                    ? "border-red-400 bg-red-400/10" : "border-white/15 bg-[#080D12]"}`}>
                    <span className="flex items-start gap-2"><input type="radio" name="bundle-resolution"
                      className="mt-1 accent-red-400" checked={excludeFromIngest}
                      onChange={() => {
                        setExcludeFromIngest(true);
                        setEscalated(false);
                      }} />
                      <span><span className="block text-sm font-semibold text-red-100">Exclude from ingest</span>
                        <span className="mt-1 block text-xs text-text-secondary">Use when contents change by day, phase, time of day, or another non-repeatable regimen.</span></span></span>
                  </label>
                  <label className={`cursor-pointer rounded border p-3 ${escalated
                    ? "border-amber-400 bg-amber-400/10" : "border-white/15 bg-[#080D12]"}`}>
                    <span className="flex items-start gap-2"><input type="radio" name="bundle-resolution"
                      className="mt-1 accent-amber-400" checked={escalated}
                      onChange={() => {
                        setEscalated(true);
                        setExcludeFromIngest(false);
                        setExclusionReason("");
                      }} />
                      <span><span className="block text-sm font-semibold text-amber-100">Escalate for later review</span>
                        <span className="mt-1 block text-xs text-text-secondary">Use when the package cannot be confidently classified as a fixed combination or an exclusion.</span></span></span>
                  </label>
                </div>
              </fieldset> : context ? <section className="rounded border border-accent/25 bg-accent/5 p-3">
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
                <p className="mt-1 text-xs text-text-secondary">{detail.resolutionKind === "profile_variants"
                  ? "Save the one shared Facts-panel serving. Suggested-use directions remain only in source history."
                  : "Correct only the serving that will enter the catalog."}</p></div>
                {detail.resolutionKind !== "profile_variants" ? <button type="button" onClick={toggleCorrection}
                  className="shrink-0 text-xs font-semibold text-accent underline">
                  {correctionOpen ? "Use extracted values" : "Correct selected serving"}
                </button> : null}</div>
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
              <p className="mt-1 text-xs text-text-secondary">{detail.reviewCategory === "label_column_review"
                ? "Choose the serving above and the printed ingredient-value column here independently. Incorrect DSLD serving pointers will not hide a column."
                : detail.reviewCategory === "unreferenced_serving_mapping_review"
                ? "Choose the printed value column that should populate this serving. The choice applies across the whole label."
                : "SuppVis keeps quantities tied to the selected serving and excludes quantities tied only to other servings."}</p>
              {detail.reviewCategory === "label_column_review" && labelColumnCount > 1 ? <div className="mt-3 rounded border border-cyan-400/30 bg-cyan-400/5 p-3">
                <p className="text-sm font-semibold text-cyan-100">Choose one value column for the whole label</p>
                <p className="mt-1 text-xs text-text-secondary">This choice is independent of the serving selected above. Every affected ingredient follows the same printed column pattern, so you only need to choose once.</p>
                <div className="mt-3 flex flex-wrap gap-2">{Array.from({ length: labelColumnCount }, (_, position) =>
                  <button key={position} type="button" onClick={() => applyGlobalColumnChoice(position)}
                    className={`rounded border px-3 py-2 text-xs font-semibold ${globalColumn === position
                      ? "border-accent bg-accent/15 text-accent" : "border-white/15"}`}>
                    Use column {position + 1}
                  </button>)}</div>
                <div className="mt-3 space-y-1 text-xs text-text-secondary">{detail.sourceIngredientRows.map((row) => ({
                  row,
                  candidates: row.quantities,
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
              {detail.reviewCategory !== "label_column_review" || globalColumn != null
                ? projected.filter((projection) => projection.status === "ambiguous").map((projection) => <div key={projection.row.rowPath}
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

            {rangeEndpointReview ? null : bundleReview ? excludeFromIngest ? <section className="rounded border border-red-400/60 bg-red-400/10 p-3">
              <label className="block text-xs font-semibold text-red-100">Reason
                <select className={`${inputClass} mt-1`} value={exclusionReason}
                  onChange={(event) => setExclusionReason(event.target.value as ServingSizeExclusionReason | "")}>
                  <option value="">Choose a reason…</option>
                  {exclusionReasons.map((reason) => <option key={reason.value} value={reason.value}>{reason.label}</option>)}
                </select>
              </label>
            </section> : null : <section className={`rounded border p-3 ${excludeFromIngest ? "border-red-400/60 bg-red-400/10" : "border-red-400/25 bg-[#080D12]"}`}>
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
            </section>}

            {detail.resolutionKind !== "composite" && detail.reviewCategory !== "serving_extraction_review"
              ? <label className="flex cursor-pointer items-start gap-3 rounded border border-white/15 bg-[#080D12] p-3 text-sm">
              <input type="checkbox" className="mt-1 accent-amber-400" checked={escalated}
                onChange={(event) => {
                  setEscalated(event.target.checked);
                  if (event.target.checked) {
                    setExcludeFromIngest(false);
                    setExclusionReason("");
                  }
                }} />
              <span><span className="block font-semibold">Escalate — {detail.resolutionKind === "profile_variants"
                && profileResolutionMode === "variants"
                ? "cannot resolve the profile variants" : "cannot determine the canonical serving"}</span>
                <span className="block text-xs text-text-secondary">Save this label for a later decision; any admin can return and resolve it.</span></span>
            </label> : null}

            <div>{excludeFromIngest || (detail.resolutionKind === "composite" && !bundleReview) || escalated || correctionOpen
              || (detail.reviewCategory === "serving_extraction_review" && extractionResolution !== "confirm")
              ? <label className="block text-sm font-semibold">Reviewer note (required)</label>
              : <button type="button" onClick={() => setNoteOpen((open) => !open)} className="text-sm font-semibold text-accent underline">
                {noteOpen ? "Hide reviewer note" : "Add reviewer note (optional)"}</button>}
              {excludeFromIngest || (detail.resolutionKind === "composite" && !bundleReview) || escalated || correctionOpen
                || (detail.reviewCategory === "serving_extraction_review" && extractionResolution !== "confirm")
                || noteOpen ? <textarea className={`${inputClass} mt-2 min-h-20`} value={reviewerNote}
                onChange={(event) => setReviewerNote(event.target.value)} placeholder="Explain what the printed label shows." /> : null}</div>

            <div className="flex flex-wrap gap-2"><button type="button" disabled={saving
              || (rangeEndpointReview && !escalated && selectedRangeEndpoint == null)
              || (!rangeEndpointReview && !excludeFromIngest && detail.resolutionKind !== "composite"
                && detail.reviewCategory !== "serving_extraction_review"
                && !(detail.resolutionKind === "profile_variants" && profileResolutionMode === "variants")
                && !escalated && selectedOrder == null)} onClick={save}
              className={`rounded-full px-5 py-2 text-sm font-bold disabled:opacity-40 ${excludeFromIngest
                ? "bg-red-400 text-[#190404]" : "bg-accent text-[#03100E]"}`}>
              {saving ? "Saving…" : readOnlyPreview ? "Preview decision and continue"
                : excludeFromIngest ? "Exclude product from ingest"
                  : detail.reviewCategory === "serving_extraction_review"
                    ? extractionResolution === "correct" ? "Save corrected serving"
                      : extractionResolution === "ingredient_review" ? "Confirm serving and flag ingredients"
                        : extractionResolution === "escalate" ? "Save escalation"
                          : "Confirm extracted serving"
                  : escalated ? "Save escalation"
                  : rangeEndpointReview ? selectedRangeEndpoint
                    ? `Use ${selectedRangeEndpoint} endpoint` : "Choose an endpoint"
                  : bundleReview ? "Combine fixed package"
                  : detail.resolutionKind === "composite" ? "Save combined serving"
                  : detail.resolutionKind === "profile_variants" && profileResolutionMode === "variants" ? "Save profile variants"
                  : detail.resolutionKind === "profile_variants" ? "Save as one shared serving"
                  : "Save canonical serving"}</button>
              <button type="button" disabled={saving} onClick={() => setSelectedTaskId(next?.id ?? "")}
                className="rounded-full border border-white/15 px-5 py-2 text-sm font-semibold disabled:opacity-40">Skip for now</button></div>
          </div>
        </div>

        {detail.decisions.length ? <div className="border-t border-white/10 pt-4"><h4 className="mb-2 font-semibold">Decision history</h4>
          {detail.decisions.map((decision) => <p key={decision.id} className="mb-2 text-xs text-text-secondary">
            Rev {decision.taskRevision}: {humanize(decision.outcome)} by {decision.reviewerEmail} · {new Date(decision.decidedAt).toLocaleString()}
            {decision.selectedServingOrder ? ` · serving order ${decision.selectedServingOrder}` : ""}
            {decision.selectedRangeEndpoint ? ` · ${decision.selectedRangeEndpoint} endpoint` : ""}
            {decision.exclusionReason ? ` · ${humanize(decision.exclusionReason)}` : ""}
            {decision.reviewerNote ? ` — ${decision.reviewerNote}` : ""}
          </p>)}</div> : null}
      </div>}
    </div>
  </section>;
}
