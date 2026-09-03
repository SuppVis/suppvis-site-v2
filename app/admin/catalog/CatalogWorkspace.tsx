"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CatalogApiError,
  attachCatalogBarcode,
  createCatalogProduct,
  getCatalogImageAccess,
  getCatalogProduct,
  getPublicTemplates,
  getTemplateDiff,
  lookupCatalogBarcode,
  reassignCatalogBarcode,
  searchCatalogProducts,
  updateCatalogProduct,
} from "./catalog-api";
import {
  applySelectedReplacement,
  applyTemplateToDraft,
  catalogDraftBlockers,
  catalogProductFromDraft,
  createEmptyCatalogDraft,
  draftFromProduct,
  type CatalogEditorDraft,
} from "./catalog-draft";
import {
  evidenceBlockers,
  evidenceImageSets,
  serializableEvidence,
  type CatalogEvidenceFile,
} from "./catalog-evidence";
import CatalogEvidencePanel from "./CatalogEvidencePanel";
import CatalogFormulaEditor from "./CatalogFormulaEditor";
import CatalogReplacementReview from "./CatalogReplacementReview";
import type {
  CatalogBarcodeDecodeResponse,
  CatalogBarcodeFormat,
  CatalogBarcodeInput,
  CatalogBarcodeLookupResponse,
  CatalogFollowUpReason,
  CatalogFormulaTemplateCandidate,
  CatalogFrontLabelTemplateResponse,
  CatalogProductBrowserSummaryDto,
  CatalogProductDetailDto,
  CatalogProductType,
  CatalogTemplateDiffResponse,
} from "./contracts.generated";

type BarcodeDraft = {
  value: string;
  format: CatalogBarcodeFormat;
  confirmed: boolean;
  packageLabel: string;
  packageAmount: string;
  packageUnit: string;
};

type SavedLocalDraft = {
  version: 1;
  authoritativeRevision: number | null;
  savedAt: string;
  draft: CatalogEditorDraft;
  barcode: BarcodeDraft;
  evidence: CatalogEvidenceFile[];
};

type CatalogBrowserFilters = {
  q?: string;
  canonicalKey?: string;
  brandName?: string;
  productType?: CatalogProductType;
  followUpReason?: string;
};

const emptyBarcode = (): BarcodeDraft => ({
  value: "",
  format: "upc_a",
  confirmed: false,
  packageLabel: "",
  packageAmount: "",
  packageUnit: "",
});

const inputClass = "w-full rounded border border-white/15 bg-[#080D12] px-3 py-2 text-sm text-text-primary outline-none focus:border-accent";
const reasonOptions: CatalogFollowUpReason[] = [
  "legacy_pre_web_contract_review",
  "legacy_single_leaf_blend",
  "legacy_missing_source_images",
  "legacy_nutrition_component_candidate",
  "legacy_formula_review",
  "legacy_barcode_review",
  "admin_marked_follow_up",
];

function localStorageKey(productId: string | null) {
  return `suppvis:admin-catalog:draft:${productId ?? "new"}`;
}

function formatError(error: unknown) {
  return error instanceof Error ? error.message : "The catalog request failed.";
}

function barcodeInput(draft: BarcodeDraft): CatalogBarcodeInput {
  const packageStarted = draft.packageLabel.trim() || draft.packageAmount.trim() || draft.packageUnit.trim();
  return {
    value: draft.value.trim(),
    format: draft.format,
    packageSize: packageStarted
      ? {
          labelText: draft.packageLabel.trim(),
          amount: Number(draft.packageAmount),
          unit: draft.packageUnit.trim(),
        }
      : null,
  };
}

function BarcodeImagePreview({ file }: { file?: File }) {
  const [visible, setVisible] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    setVisible(false);
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const nextUrl = URL.createObjectURL(file);
    setPreviewUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [file]);

  if (!file || !previewUrl) return null;
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        className="text-xs font-semibold text-accent hover:underline"
        aria-expanded={visible}
      >
        {visible ? "Hide image" : "View image"}
      </button>
      {visible ? (
        <Image
          src={previewUrl}
          alt="Uploaded barcode label for digit verification"
          width={960}
          height={640}
          unoptimized
          className="mt-2 h-auto max-h-72 w-full rounded border border-white/10 bg-white object-contain"
        />
      ) : null}
    </div>
  );
}

function barcodeBlockers(draft: BarcodeDraft, lookup: CatalogBarcodeLookupResponse | null) {
  const blockers: string[] = [];
  if (draft.value.trim() && !draft.confirmed) blockers.push("Confirm the decoded or manually entered barcode digits.");
  if (draft.value.trim() && draft.confirmed && !lookup) blockers.push("Look up the confirmed barcode before saving.");
  const packageParts = [draft.packageLabel.trim(), draft.packageAmount.trim(), draft.packageUnit.trim()];
  const packageAmount = Number(draft.packageAmount);
  if (packageParts.some(Boolean) && (!packageParts.every(Boolean) || !Number.isFinite(packageAmount) || packageAmount <= 0)) {
    blockers.push("Package size must include a label, positive amount, and unit, or remain empty.");
  }
  if (draft.packageLabel.trim().length > 160 || draft.packageUnit.trim().length > 40) {
    blockers.push("Package-size label or unit exceeds the catalog limit.");
  }
  return blockers;
}

function candidateRank(candidate: CatalogFormulaTemplateCandidate) {
  if (candidate.source === "ocr_template") return 0;
  if (candidate.source === "nih_dsld_template") return 1;
  return 2;
}

function Browser({
  results,
  loading,
  nextCursor,
  selectedId,
  onSearch,
  onMore,
  onSelect,
  onNew,
}: {
  results: CatalogProductBrowserSummaryDto[];
  loading: boolean;
  nextCursor: string | null;
  selectedId: string | null;
  onSearch: (filters: CatalogBrowserFilters) => void;
  onMore: () => void;
  onSelect: (id: string) => void;
  onNew: () => void;
}) {
  const [q, setQ] = useState("");
  const [canonicalKey, setCanonicalKey] = useState("");
  const [brandName, setBrandName] = useState("");
  const [productType, setProductType] = useState("");
  const [reason, setReason] = useState("");
  function submit() {
    onSearch({
      q,
      canonicalKey: canonicalKey || undefined,
      brandName: brandName || undefined,
      productType: productType ? productType as CatalogProductType : undefined,
      followUpReason: reason || undefined,
    });
  }
  return (
    <aside className="self-start rounded-[8px] border border-white/10 bg-[#0D1117] p-4 xl:sticky xl:top-4">
      <div className="flex items-center justify-between gap-3">
        <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Review queue</p><h2 className="mt-1 font-headline text-xl font-bold">Drafts needing review</h2></div>
        <button type="button" onClick={onNew} className="rounded-full bg-accent px-3 py-2 text-xs font-bold text-[#03100E]">New product</button>
      </div>
      <form className="mt-4 space-y-2" onSubmit={(event) => { event.preventDefault(); submit(); }}>
        <input value={q} onChange={(event) => setQ(event.target.value)} className={inputClass} placeholder="Search label or brand" />
        <div className="grid grid-cols-2 gap-2">
          <input value={canonicalKey} onChange={(event) => setCanonicalKey(event.target.value)} className={inputClass} placeholder="Exact canonical key" />
          <input value={brandName} onChange={(event) => setBrandName(event.target.value)} className={inputClass} placeholder="Exact brand name" />
        </div>
        <select value={productType} onChange={(event) => setProductType(event.target.value)} className={inputClass}><option value="">All formula types</option><option value="supplement">Supplement</option><option value="blend">Blend</option></select>
        <select value={reason} onChange={(event) => setReason(event.target.value)} className={inputClass}><option value="">Any review reason</option>{reasonOptions.map((entry) => <option value={entry} key={entry}>{entry.replaceAll("_", " ")}</option>)}</select>
        <button disabled={loading} className="w-full rounded-full border border-white/15 px-3 py-2 text-xs font-semibold disabled:opacity-40">{loading ? "Searching…" : "Search catalog"}</button>
      </form>
      <div className="subscriber-detail-scroll mt-4 max-h-[65vh] space-y-2 overflow-y-auto pr-1">
        {results.map((product) => (
          <button
            key={product.id}
            type="button"
            onClick={() => onSelect(product.id)}
            className={`w-full rounded border p-3 text-left transition ${selectedId === product.id ? "border-accent bg-accent/5" : "border-white/10 bg-[#080D12] hover:border-white/25"}`}
          >
            <span className="block text-sm font-semibold">{product.labelName}</span>
            <span className="mt-1 block text-xs text-text-secondary">{product.brandName} · {product.productType} · rev {product.revision}</span>
            <span className="mt-2 block text-xs text-text-muted">{product.activeLeafCount} leaves · {product.barcodeCount} barcodes · {product.imageCount} images · {product.nutritionFactCount} nutrition</span>
            {product.needsFollowUp ? <span className="mt-2 inline-flex rounded-full border border-warning/40 px-2 py-1 text-[11px] text-warning">Needs follow-up</span> : null}
          </button>
        ))}
        {!loading && results.length === 0 ? <p className="py-6 text-center text-sm text-text-muted">No current products match.</p> : null}
      </div>
      {nextCursor ? <button type="button" disabled={loading} onClick={onMore} className="mt-3 w-full rounded-full border border-white/15 px-3 py-2 text-xs font-semibold disabled:opacity-40">Load more</button> : null}
    </aside>
  );
}

export default function CatalogWorkspace({ initialProductId }: { initialProductId?: string }) {
  const [selected, setSelected] = useState<CatalogProductDetailDto | null>(null);
  const [draft, setDraft] = useState<CatalogEditorDraft>(() => createEmptyCatalogDraft());
  const [evidence, setEvidence] = useState<CatalogEvidenceFile[]>([]);
  const [barcode, setBarcode] = useState<BarcodeDraft>(() => emptyBarcode());
  const [barcodeLookup, setBarcodeLookup] = useState<CatalogBarcodeLookupResponse | null>(null);
  const [barcodeEvidenceId, setBarcodeEvidenceId] = useState("");
  const [confirmReassignment, setConfirmReassignment] = useState(false);
  const [frontCandidate, setFrontCandidate] = useState<CatalogFrontLabelTemplateResponse | null>(null);
  const [formulaCandidates, setFormulaCandidates] = useState<CatalogFormulaTemplateCandidate[]>([]);
  const [sourceErrors, setSourceErrors] = useState<string[]>([]);
  const [diff, setDiff] = useState<{ candidate: CatalogFormulaTemplateCandidate; result: CatalogTemplateDiffResponse } | null>(null);
  const [results, setResults] = useState<CatalogProductBrowserSummaryDto[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [filters, setFilters] = useState<CatalogBrowserFilters>({});
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const suppressNextPersistence = useRef(true);

  const runSearch = useCallback(async (nextFilters = filters, cursor?: string, append = false) => {
    setLoadingSearch(true);
    try {
      const response = await searchCatalogProducts({
        ...nextFilters,
        status: "draft",
        needsFollowUp: true,
        cursor,
      });
      setResults((current) => append ? [...current, ...response.results] : response.results);
      setNextCursor(response.nextCursor);
      setError(null);
    } catch (caught) {
      setError(formatError(caught));
    } finally {
      setLoadingSearch(false);
    }
  }, [filters]);

  useEffect(() => { void runSearch({}); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (suppressNextPersistence.current) {
      suppressNextPersistence.current = false;
      return;
    }
    const key = localStorageKey(selected?.id ?? null);
    const timer = window.setTimeout(() => {
      const value: SavedLocalDraft = {
        version: 1,
        authoritativeRevision: selected?.revision ?? null,
        savedAt: new Date().toISOString(),
        draft,
        barcode,
        evidence: serializableEvidence(evidence),
      };
      localStorage.setItem(key, JSON.stringify(value));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [barcode, draft, evidence, selected?.id, selected?.revision]);

  function resetAuxiliaryState() {
    setEvidence([]);
    setBarcode(emptyBarcode());
    setBarcodeLookup(null);
    setBarcodeEvidenceId("");
    setConfirmReassignment(false);
    setFrontCandidate(null);
    setFormulaCandidates([]);
    setSourceErrors([]);
    setDiff(null);
  }

  function beginNew() {
    suppressNextPersistence.current = true;
    setSelected(null);
    resetAuxiliaryState();
    const stored = localStorage.getItem(localStorageKey(null));
    if (stored) {
      try {
        const saved = JSON.parse(stored) as SavedLocalDraft;
        if (saved.version === 1) {
          setDraft(saved.draft);
          setBarcode(saved.barcode);
          setEvidence(saved.evidence ?? []);
          setNotice(`Recovered a local new-product draft saved ${new Date(saved.savedAt).toLocaleString()}.`);
          return;
        }
      } catch {
        localStorage.removeItem(localStorageKey(null));
      }
    }
    setDraft(createEmptyCatalogDraft());
    setNotice("Started a new single-product draft.");
  }

  async function loadProduct(productId: string, allowLocal = true) {
    setBusy("load");
    setError(null);
    try {
      const product = await getCatalogProduct(productId);
      suppressNextPersistence.current = true;
      if (!allowLocal) localStorage.removeItem(localStorageKey(productId));
      setSelected(product);
      resetAuxiliaryState();
      setBarcodeEvidenceId(product.barcodes[0]?.id ?? "");
      if (allowLocal) {
        const stored = localStorage.getItem(localStorageKey(productId));
        if (stored) {
          try {
            const saved = JSON.parse(stored) as SavedLocalDraft;
            if (saved.version === 1 && saved.authoritativeRevision === product.revision) {
              setDraft(saved.draft);
              setBarcode(saved.barcode);
              setEvidence(saved.evidence ?? []);
              setNotice(`Recovered a local edit saved ${new Date(saved.savedAt).toLocaleString()} against revision ${product.revision}.`);
              return;
            }
          } catch {
            localStorage.removeItem(localStorageKey(productId));
          }
        }
      }
      setDraft(draftFromProduct(product));
      setNotice(`Loaded authoritative revision ${product.revision}.`);
    } catch (caught) {
      setError(formatError(caught));
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    if (initialProductId) void loadProduct(initialProductId);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function changeBarcode(patch: Partial<BarcodeDraft>) {
    setBarcode((current) => ({ ...current, ...patch, confirmed: patch.confirmed ?? false }));
    setBarcodeLookup(null);
    setConfirmReassignment(false);
  }

  async function lookupBarcode() {
    if (!barcode.confirmed) return;
    setBusy("barcode-lookup");
    setError(null);
    try {
      const result = await lookupCatalogBarcode(barcodeInput(barcode));
      setBarcodeLookup(result);
      setNotice(result.found
        ? `Barcode is currently assigned to ${result.product.brandName} ${result.product.labelName}.`
        : `Barcode ${result.normalizedBarcode.gtin14} is available.`);
    } catch (caught) {
      setBarcodeLookup(null);
      setError(formatError(caught));
    } finally {
      setBusy(null);
    }
  }

  function onBarcodeCandidate(candidate: CatalogBarcodeDecodeResponse) {
    if (candidate.status === "decoded") {
      setBarcode({
        ...emptyBarcode(),
        value: candidate.candidate.value,
        format: candidate.candidate.format,
        packageLabel: candidate.candidate.packageSize?.labelText ?? "",
        packageAmount: candidate.candidate.packageSize ? String(candidate.candidate.packageSize.amount) : "",
        packageUnit: candidate.candidate.packageSize?.unit ?? "",
      });
      setBarcodeLookup(null);
      setNotice(`Decoded ${candidate.candidate.value}. Confirm the digits against the package before lookup.`);
    } else {
      setNotice(`Barcode requires manual entry: ${candidate.reason.replaceAll("_", " ")}.`);
    }
  }

  async function loadPublicCandidates() {
    if (!barcode.value.trim()) return;
    setBusy("public-templates");
    setError(null);
    try {
      const response = await getPublicTemplates(barcodeInput(barcode));
      setFormulaCandidates((current) => [
        ...current.filter((candidate) => candidate.source === "ocr_template"),
        ...response.candidates,
      ].sort((left, right) => candidateRank(left) - candidateRank(right)));
      setSourceErrors(response.sourceErrors.map((entry) => `${entry.source}: ${entry.message}`));
      setNotice("Public candidates loaded independently. No catalog data was written.");
    } catch (caught) {
      setError(formatError(caught));
    } finally {
      setBusy(null);
    }
  }

  function addOcrCandidate(candidate: CatalogFormulaTemplateCandidate) {
    setFormulaCandidates((current) => [candidate, ...current.filter((entry) => entry.source !== "ocr_template")]);
  }

  async function previewCandidate(candidate: CatalogFormulaTemplateCandidate) {
    if (!selected) {
      setDraft((current) => applyTemplateToDraft(current, candidate, false));
      setNotice(`Applied ${candidate.sourceLabel} to editable browser state only.`);
      return;
    }
    setBusy(`diff:${candidate.templateId}`);
    try {
      const result = await getTemplateDiff(selected.id, selected.revision, candidate);
      setDiff({ candidate, result });
      setNotice("Read-only replacement diff is ready. Review it before applying the source.");
    } catch (caught) {
      if (caught instanceof CatalogApiError && caught.code === "REVISION_CONFLICT") {
        await loadProduct(selected.id, false);
        setError("The product changed while previewing. Authoritative data was reloaded before editing resumed.");
      } else setError(formatError(caught));
    } finally {
      setBusy(null);
    }
  }

  const blockers = useMemo(() => {
    const all = [
      ...catalogDraftBlockers(draft),
      ...evidenceBlockers(evidence),
      ...barcodeBlockers(barcode, barcodeLookup),
    ];
    const barcodeFiles = evidence.filter((file) => file.role === "barcode" && file.status === "uploaded");
    if (!selected && barcodeFiles.length > 0 && !barcode.value.trim()) {
      all.push("Add a barcode before saving barcode images, or remove those images.");
    }
    if (selected && barcodeFiles.length > 0 && !barcode.value.trim() && !barcodeEvidenceId) {
      all.push("Choose an attached barcode for replacement barcode evidence.");
    }
    if (!selected && barcodeLookup?.found) all.push("This barcode already belongs to a catalog product; open that product instead.");
    if (selected && barcodeLookup?.found && barcodeLookup.product.id !== selected.id && !confirmReassignment) {
      all.push("Confirm the explicit barcode reassignment before saving.");
    }
    if (selected && barcodeLookup?.found && barcodeLookup.product.id !== selected.id && barcodeFiles.length > 0) {
      all.push("New barcode evidence cannot be combined with reassignment; save the reassignment, then replace its evidence.");
    }
    return [...new Set(all)];
  }, [barcode, barcodeEvidenceId, barcodeLookup, confirmReassignment, draft, evidence, selected]);
  const barcodeEvidenceFile = evidence.find((file) => file.role === "barcode")?.file;

  async function saveDraft() {
    if (blockers.length > 0) return;
    setBusy("save");
    setError(null);
    let authoritativeAfterProductUpdate: CatalogProductDetailDto | null = null;
    let pendingBarcodeEvidence: CatalogEvidenceFile[] = [];
    try {
      const product = catalogProductFromDraft(draft);
      let saved: CatalogProductDetailDto;
      if (!selected) {
        const created = await createCatalogProduct({
          product,
          ...(barcode.value.trim() ? { barcode: barcodeInput(barcode) } : {}),
          templateProvenance: draft.templateProvenance,
          imageSets: evidenceImageSets(evidence, "append"),
        });
        saved = created.product;
        localStorage.removeItem(localStorageKey(null));
      } else {
        const barcodeFiles = evidence.filter((file) => file.role === "barcode");
        pendingBarcodeEvidence = barcodeFiles;
        const foundHere = barcodeLookup?.found && barcodeLookup.product.id === selected.id
          ? barcodeLookup.barcode.id
          : null;
        const replacementBarcodeId = foundHere || (!barcode.value.trim() ? barcodeEvidenceId : null);
        const updateSets = evidenceImageSets(evidence.filter((file) => file.role !== "barcode"), "replace_current");
        if (replacementBarcodeId && barcodeFiles.length > 0) {
          updateSets.push(...evidenceImageSets(barcodeFiles, "replace_current", replacementBarcodeId));
        }
        saved = (await updateCatalogProduct(selected.id, {
          expectedRevision: selected.revision,
          product,
          imageSets: updateSets,
        })).product;
        authoritativeAfterProductUpdate = saved;

        if (barcode.value.trim() && barcodeLookup && !barcodeLookup.found) {
          saved = (await attachCatalogBarcode(selected.id, {
            barcode: barcodeInput(barcode),
            imageSets: evidenceImageSets(barcodeFiles, "append"),
          })).product;
        } else if (barcode.value.trim() && barcodeLookup?.found && barcodeLookup.product.id !== selected.id) {
          saved = (await reassignCatalogBarcode(barcodeLookup.normalizedBarcode.gtin14, {
            destinationProductId: selected.id,
            expectedSourceProductId: barcodeLookup.product.id,
            expectedRevision: barcodeLookup.barcode.revision,
          })).product;
        }
        localStorage.removeItem(localStorageKey(selected.id));
      }
      suppressNextPersistence.current = true;
      setSelected(saved);
      setDraft(draftFromProduct(saved));
      resetAuxiliaryState();
      setBarcodeEvidenceId(saved.barcodes[0]?.id ?? "");
      setNotice(`Draft saved at revision ${saved.revision}. No product was published.`);
      await runSearch(filters);
    } catch (caught) {
      const revisionConflict = caught instanceof CatalogApiError && caught.code === "REVISION_CONFLICT";
      if (selected && authoritativeAfterProductUpdate && (!revisionConflict || pendingBarcodeEvidence.length > 0)) {
        localStorage.removeItem(localStorageKey(selected.id));
        setSelected(authoritativeAfterProductUpdate);
        setDraft(draftFromProduct(authoritativeAfterProductUpdate));
        setEvidence(pendingBarcodeEvidence);
        setBarcodeEvidenceId(authoritativeAfterProductUpdate.barcodes[0]?.id ?? "");
        setBarcodeLookup(null);
        setConfirmReassignment(false);
        setNotice(`Product fields and non-barcode evidence saved at revision ${authoritativeAfterProductUpdate.revision}.`);
        setError(`The barcode operation still needs to be retried after a fresh lookup: ${formatError(caught)}`);
        await runSearch(filters);
      } else if (selected && revisionConflict) {
        await loadProduct(selected.id, false);
        localStorage.removeItem(localStorageKey(selected.id));
        setError("Save was rejected because the product changed. Authoritative data was reloaded before editing resumed.");
      } else if (!selected && caught instanceof CatalogApiError && caught.code === "BARCODE_ALREADY_ASSIGNED") {
        const currentProductId = caught.details?.currentProductId;
        if (typeof currentProductId === "string") await loadProduct(currentProductId, false);
        setError("Create was rejected because the barcode is already assigned. The authoritative product was loaded.");
      } else {
        setError(formatError(caught));
      }
    } finally {
      setBusy(null);
    }
  }

  async function viewImage(imageId: string) {
    setBusy(`image:${imageId}`);
    try {
      const access = await getCatalogImageAccess(imageId);
      window.open(access.url, "_blank", "noopener,noreferrer");
    } catch (caught) {
      setError(formatError(caught));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
      <Browser
        results={results}
        loading={loadingSearch}
        nextCursor={nextCursor}
        selectedId={selected?.id ?? null}
        onSearch={(nextFilters) => { setFilters(nextFilters); void runSearch(nextFilters); }}
        onMore={() => { if (nextCursor) void runSearch(filters, nextCursor, true); }}
        onSelect={(id) => void loadProduct(id)}
        onNew={beginNew}
      />
      <div className="min-w-0 space-y-4">
        <section className="rounded-[8px] border border-white/10 bg-[#0D1117] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">{selected ? "Edit current draft" : "New product"}</p>
              <h2 className="mt-1 font-headline text-2xl font-bold">{selected ? `${selected.brandName} ${selected.labelName}` : "One-product curation workflow"}</h2>
              {selected ? <p className="mt-1 text-xs text-text-muted">{selected.status} · server-derived {selected.productType} · {selected.activeLeafCount} active leaves · revision {selected.revision} · updated {new Date(selected.updatedAt).toLocaleString()}</p> : null}
            </div>
            <div className="flex gap-2">
              {selected ? <button type="button" disabled={busy !== null} onClick={() => void loadProduct(selected.id, false)} className="rounded-full border border-white/15 px-3 py-2 text-xs font-semibold disabled:opacity-40">Discard local edits & reload</button> : null}
            </div>
          </div>
          {notice ? <p role="status" className="mt-3 rounded border border-accent/20 bg-accent/5 p-3 text-sm text-text-secondary">{notice}</p> : null}
          {error ? <p role="alert" className="mt-3 rounded border border-error/30 bg-error/5 p-3 text-sm text-error">{error}</p> : null}
        </section>

        {selected ? (
          <section className="rounded-[8px] border border-white/10 bg-[#0D1117] p-4">
            <div className="grid gap-5 lg:grid-cols-3">
              <div><h3 className="font-semibold">Barcode group</h3><div className="mt-2 space-y-2">{selected.barcodes.map((entry) => <div key={entry.id} className="rounded border border-white/10 bg-[#080D12] p-2 text-xs"><p className="font-semibold">{entry.labelBarcode}</p><p className="mt-1 text-text-muted">{entry.format} · GTIN {entry.gtin14} · rev {entry.revision}</p>{entry.packageSize ? <p className="mt-1 text-text-muted">{entry.packageSize.labelText}</p> : null}</div>)}</div></div>
              <div><h3 className="font-semibold">Provenance & review</h3><p className="mt-2 text-xs text-text-secondary">{selected.templateProvenance.entryMethod.replaceAll("_", " ")}</p><p className="mt-1 text-xs text-text-muted">Created by {selected.createdByEmail}<br />Updated by {selected.updatedByEmail}</p>{selected.followUpReasons.length > 0 ? <p className="mt-2 text-xs text-warning">{selected.followUpReasons.join(", ")}</p> : null}</div>
              <div><h3 className="font-semibold">Retained evidence</h3><div className="mt-2 max-h-48 space-y-2 overflow-y-auto">{selected.images.map((image) => <div key={image.id} className="rounded border border-white/10 bg-[#080D12] p-2 text-xs"><p className="truncate font-semibold">{image.role.replaceAll("_", " ")} · {image.originalFilename}</p><p className="mt-1 text-text-muted">#{image.sortOrder + 1} · {(image.byteSize / 1024 / 1024).toFixed(1)} MiB · {image.isCurrent ? "current" : "superseded"}</p><button type="button" disabled={busy !== null} onClick={() => void viewImage(image.id)} className="mt-2 text-accent disabled:opacity-40">View with short-lived access</button></div>)}{selected.images.length === 0 ? <p className="text-xs text-text-muted">No retained evidence.</p> : null}</div></div>
            </div>
          </section>
        ) : null}

        <CatalogEvidencePanel
          files={evidence}
          onChange={setEvidence}
          onFrontCandidate={setFrontCandidate}
          onFormulaCandidate={addOcrCandidate}
          onBarcodeCandidate={onBarcodeCandidate}
          currentImageRoles={[...new Set(selected?.images
            .filter((image) => image.isCurrent)
            .map((image) => image.role) ?? [])]}
        />

        {frontCandidate ? (
          <section className="rounded-[8px] border border-white/10 bg-[#0D1117] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Front-label suggestions</p>
            <p className="mt-2 text-sm text-text-secondary">Suggestions never overwrite your editor unless you explicitly use one.</p>
            <div className="mt-3 flex flex-wrap gap-2">{frontCandidate.labelNameCandidates.map((value) => <button type="button" key={`label:${value}`} onClick={() => setDraft((current) => ({ ...current, labelName: value }))} className="rounded-full border border-white/15 px-3 py-2 text-xs">Use source label: {value}</button>)}{frontCandidate.brandNameCandidates.map((value) => <button type="button" key={`brand:${value}`} onClick={() => setDraft((current) => ({ ...current, brandName: value }))} className="rounded-full border border-white/15 px-3 py-2 text-xs">Use source brand: {value}</button>)}{frontCandidate.physicalFormCandidate ? <button type="button" onClick={() => setDraft((current) => ({ ...current, physicalForm: frontCandidate.physicalFormCandidate! }))} className="rounded-full border border-white/15 px-3 py-2 text-xs">Use source form: {frontCandidate.physicalFormCandidate}</button> : null}{frontCandidate.variantCandidate ? <button type="button" onClick={() => setDraft((current) => ({ ...current, variant: frontCandidate.variantCandidate! }))} className="rounded-full border border-white/15 px-3 py-2 text-xs">Use source variant: {frontCandidate.variantCandidate}</button> : null}</div>
            {frontCandidate.reviewReasons.length > 0 ? <p className="mt-3 text-xs text-warning">Review: {frontCandidate.reviewReasons.join(", ")}</p> : null}
          </section>
        ) : null}

        <section className="rounded-[8px] border border-white/10 bg-[#0D1117] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Barcode identity · Optional</p><h2 className="mt-1 font-headline text-xl font-bold">Add now or later</h2><p className="mt-1 text-xs text-text-muted">Leave this section blank for a manual-entry draft. A barcode can be attached later.</p></div>
            <button type="button" disabled={busy !== null || !barcode.value.trim()} onClick={() => void loadPublicCandidates()} className="rounded-full border border-white/15 px-3 py-2 text-xs font-semibold disabled:opacity-40">Load NIH & OFF candidates</button>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <div className="xl:col-span-2">
              <label htmlFor="catalog-barcode-digits" className="text-xs font-semibold text-text-muted">Printed/decoded digits</label>
              <input id="catalog-barcode-digits" value={barcode.value} onChange={(event) => changeBarcode({ value: event.target.value })} className={`${inputClass} mt-1`} />
              <BarcodeImagePreview file={barcodeEvidenceFile} />
            </div>
            <label className="text-xs font-semibold text-text-muted">Format<select value={barcode.format} onChange={(event) => changeBarcode({ format: event.target.value as CatalogBarcodeFormat })} className={`${inputClass} mt-1`}><option value="upc_a">UPC-A</option><option value="upc_e">UPC-E</option><option value="ean_8">EAN-8</option><option value="ean_13">EAN-13</option><option value="gtin_14">GTIN-14</option></select></label>
            <label className="text-xs font-semibold text-text-muted">Package label<input value={barcode.packageLabel} onChange={(event) => changeBarcode({ packageLabel: event.target.value })} className={`${inputClass} mt-1`} placeholder="60 capsules" /></label>
            <div className="grid grid-cols-2 gap-2"><label className="text-xs font-semibold text-text-muted">Amount<input value={barcode.packageAmount} onChange={(event) => changeBarcode({ packageAmount: event.target.value })} className={`${inputClass} mt-1`} /></label><label className="text-xs font-semibold text-text-muted">Unit<input value={barcode.packageUnit} onChange={(event) => changeBarcode({ packageUnit: event.target.value })} className={`${inputClass} mt-1`} /></label></div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={!barcode.value.trim()} checked={barcode.confirmed} onChange={(event) => { setBarcode((current) => ({ ...current, confirmed: event.target.checked })); setBarcodeLookup(null); }} /> I confirmed the digits against the package</label>
            <button type="button" disabled={!barcode.value.trim() || !barcode.confirmed || busy !== null} onClick={() => void lookupBarcode()} className="rounded-full bg-accent px-3 py-2 text-xs font-bold text-[#03100E] disabled:opacity-40">{busy === "barcode-lookup" ? "Looking up…" : "Lookup barcode"}</button>
          </div>
          {selected && evidence.some((file) => file.role === "barcode") && !barcode.value.trim() ? <label className="mt-3 block text-xs font-semibold text-text-muted">Barcode receiving replacement evidence<select value={barcodeEvidenceId} onChange={(event) => setBarcodeEvidenceId(event.target.value)} className={`${inputClass} mt-1`}><option value="">Choose attached barcode</option>{selected.barcodes.map((entry) => <option key={entry.id} value={entry.id}>{entry.labelBarcode} ({entry.format})</option>)}</select></label> : null}
          {barcodeLookup?.found && selected && barcodeLookup.product.id !== selected.id ? <label className="mt-3 flex gap-2 rounded border border-warning/40 bg-warning/5 p-3 text-sm text-warning"><input type="checkbox" checked={confirmReassignment} onChange={(event) => setConfirmReassignment(event.target.checked)} /> Reassign this barcode from {barcodeLookup.product.brandName} {barcodeLookup.product.labelName} to the open product when Save draft is pressed.</label> : null}
          {barcodeLookup?.found && !selected ? <button type="button" onClick={() => void loadProduct(barcodeLookup.product.id)} className="mt-3 rounded-full border border-white/15 px-3 py-2 text-xs font-semibold">Open assigned product</button> : null}
        </section>

        <section className="rounded-[8px] border border-white/10 bg-[#0D1117] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Formula sources</p><h2 className="mt-1 font-headline text-xl font-bold">Independent candidates</h2></div><span className="text-xs text-text-muted">OCR → newest NIH DSLD → Open Food Facts → manual</span></div>
          {sourceErrors.length > 0 ? <div className="mt-3 rounded border border-warning/30 p-3 text-xs text-warning">{sourceErrors.map((entry) => <p key={entry}>{entry}</p>)}</div> : null}
          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            {[...formulaCandidates].sort((left, right) => candidateRank(left) - candidateRank(right)).map((candidate) => <div key={candidate.templateId} className="rounded border border-white/10 bg-[#080D12] p-3"><p className="font-semibold">{candidate.sourceLabel}</p><p className="mt-1 text-xs text-text-muted">{candidate.components.length} top-level rows · {candidate.nutritionFacts.length} nutrition rows · hierarchy {candidate.hierarchyStatus.replaceAll("_", " ")}</p>{candidate.reviewReasons.length > 0 ? <p className="mt-2 text-xs text-warning">{candidate.reviewReasons.join(", ")}</p> : null}<button type="button" disabled={busy !== null} onClick={() => void previewCandidate(candidate)} className="mt-3 rounded-full border border-white/15 px-3 py-2 text-xs font-semibold disabled:opacity-40">{selected ? "Preview replacement diff" : "Use source in editor"}</button></div>)}
            <div className="rounded border border-white/10 bg-[#080D12] p-3"><p className="font-semibold">Manual entry</p><p className="mt-1 text-xs text-text-muted">Continue with the editable formula below. Manual entry remains independent of every source.</p></div>
          </div>
        </section>

        {diff ? <CatalogReplacementReview
          key={`${diff.candidate.templateId}:${diff.result.comparedRevision}`}
          candidate={diff.candidate}
          result={diff.result}
          draft={draft}
          onApply={(selection) => {
            setDraft((current) => applySelectedReplacement(current, diff.candidate, selection));
            setDiff(null);
            setNotice(`Applied selected ${diff.candidate.sourceLabel} values to editable browser state only.`);
          }}
          onReject={() => setDiff(null)}
        /> : null}

        <CatalogFormulaEditor draft={draft} onChange={setDraft} />

        <section className="sticky bottom-3 z-10 rounded-[8px] border border-white/15 bg-[#080D12]/95 p-4 shadow-2xl shadow-black/50 backdrop-blur">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div><p className="font-semibold">{blockers.length === 0 ? "Ready to save a draft" : `${blockers.length} blocker${blockers.length === 1 ? "" : "s"} remain`}</p>{blockers.length > 0 ? <ul className="mt-1 max-h-24 list-disc overflow-y-auto pl-5 text-xs leading-5 text-warning">{blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul> : <p className="mt-1 text-xs text-text-muted">This writes a draft only; it cannot publish.</p>}</div>
            <button type="button" disabled={blockers.length > 0 || busy !== null} onClick={() => void saveDraft()} className="shrink-0 rounded-full bg-accent px-6 py-3 text-sm font-extrabold text-[#03100E] disabled:cursor-not-allowed disabled:opacity-40">{busy === "save" ? "Saving draft…" : "Save draft"}</button>
          </div>
        </section>
      </div>
    </div>
  );
}
