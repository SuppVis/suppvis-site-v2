"use client";

import { useEffect, useRef, useState } from "react";
import CatalogEvidencePanel from "./CatalogEvidencePanel";
import CatalogBarcodeFields, { LocalSourceImage, PackageFields } from "./CatalogBarcodeFields";
import CatalogFormulaEditor from "./CatalogFormulaEditor";
import useCatalogBarcodeLookup from "./useCatalogBarcodeLookup";
import { CatalogApiError, attachCatalogBarcode, createCatalogProduct, getCatalogProduct, getPublicTemplates, lookupCatalogBarcode, searchCatalogProducts } from "./catalog-api";
import { applyTemplateToDraft, catalogDraftBlockers, catalogProductFromDraft, createEmptyCatalogDraft, type CatalogEditorDraft } from "./catalog-draft";
import { evidenceBlockers, evidenceImageSets, serializableEvidence, type CatalogEvidenceFile } from "./catalog-evidence";
import { allFactorsConfirmed, barcodeBlockers, barcodeInput, emptyBarcode, emptySources, identifyingFactors, identityKey, sourcesResolved, type BarcodeDraft, type SourceState, type SourceStates } from "./catalog-intake";
import type { CatalogBarcodeDecodeResponse, CatalogFormulaTemplateCandidate, CatalogFrontLabelTemplateResponse, CatalogImageRole, CatalogProductBrowserSummaryDto, CatalogProductDetailDto } from "./contracts.generated";

const storageKey = "suppvis:admin-catalog:intake:v1";
const panel = "rounded-[8px] border border-white/10 bg-[#0D1117] p-4";
const button = "rounded-full border border-white/20 px-3 py-2 text-xs font-semibold disabled:opacity-40";
const primary = `${button} bg-accent text-[#03100E]`;
const input = "mt-1 w-full rounded border border-white/15 bg-[#080D12] px-3 py-2 text-sm";
const message = (error: unknown) => error instanceof Error ? error.message : "The catalog request failed.";
type BarcodeMode = "undecided" | "image" | "manual" | "none";

function ProductComparison({ product }: { product: CatalogProductDetailDto }) {
  return <div className="mt-3 space-y-3 text-sm">
    <p className="font-semibold">{product.brandName} · {product.labelName}</p>
    <p>{product.status} · revision {product.revision} · {product.variant || "No variant"} · {product.physicalForm} · {product.marketRegion}</p>
    {product.needsFollowUp ? <p className="rounded border border-warning/30 p-2 text-warning">Worth reviewing: {product.followUpReasons.length ? product.followUpReasons.map((reason) => reason.replaceAll("_", " ")).join(", ") : "Marked for follow-up"}</p> : null}
    {product.adminNotes ? <p>Admin notes: {product.adminNotes}</p> : null}
    <p>Serving basis: {product.servingSize.labelText} ({product.servingSize.amount} {product.servingSize.unit})</p>
    <div><h4 className="font-semibold">Formula per serving</h4><ul className="list-disc pl-5">{product.components.map((row) => <li key={row.id}>{row.labelName} — {row.amountText || "Amount not disclosed"}{row.componentType === "proprietary_blend" ? <ul className="list-disc pl-5">{row.children.map((child) => <li key={child.id}>{child.labelName} — {child.amountText || "Amount not disclosed"}</li>)}</ul> : null}</li>)}</ul></div>
    <div><h4 className="font-semibold">Nutrition</h4>{product.nutritionFacts.length ? <ul className="list-disc pl-5">{product.nutritionFacts.map((fact) => <li key={fact.id}>{fact.labelName}: {fact.amountText}{fact.dailyValuePercent !== null ? ` · ${fact.dailyValuePercent}% DV` : ""}</li>)}</ul> : <p>No nutrition facts recorded.</p>}</div>
    <div><h4 className="font-semibold">Known barcodes and package sizes</h4>{product.barcodes.length ? <ul className="list-disc pl-5">{product.barcodes.map((barcode) => <li key={barcode.id}>{barcode.labelBarcode} — {barcode.packageSize ? `${barcode.packageSize.labelText} (${barcode.packageSize.amount} ${barcode.packageSize.unit})` : "Package size not recorded"}</li>)}</ul> : <p>No barcodes or package sizes recorded.</p>}</div>
  </div>;
}

export default function CatalogIntake({ onOpen, onSaved }: { onOpen: (id: string) => void; onSaved: (id: string) => void }) {
  const [draft, setDraft] = useState<CatalogEditorDraft>(createEmptyCatalogDraft);
  const [barcode, setBarcode] = useState<BarcodeDraft>(emptyBarcode);
  const [mode, setMode] = useState<BarcodeMode>("undecided");
  const [sources, setSources] = useState<SourceStates>(emptySources);
  const [files, setFiles] = useState<CatalogEvidenceFile[]>([]);
  const [front, setFront] = useState<CatalogFrontLabelTemplateResponse | null>(null);
  const [templates, setTemplates] = useState<CatalogFormulaTemplateCandidate[]>([]);
  const [candidates, setCandidates] = useState<CatalogProductBrowserSummaryDto[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [searchedKey, setSearchedKey] = useState<string | null>(null);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [target, setTarget] = useState<CatalogProductDetailDto | null>(null);
  const [checks, setChecks] = useState<boolean[]>([]);
  const [attach, setAttach] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [finished, setFinished] = useState(false);
  const generation = useRef(0);
  const saving = useRef(false);
  const lookup = useCatalogBarcodeLookup(barcode, mode === "image" || mode === "manual");
  const key = identityKey(draft.labelName, draft.brandName);
  const found = lookup.result?.found ? lookup.result.product : null;
  const resolved = sourcesResolved(sources) && (mode === "none" || (!!lookup.result && !lookup.result.found && barcode.confirmed));
  const searched = searchedKey === key;
  const creating = resolved && newKey === key && !found;
  const attaching = resolved && searched && attach && !!target && target.status === "draft" && mode !== "none" && allFactorsConfirmed(checks);
  const allSkipped = Object.values(sources).every((state) => state === "skipped");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey) || localStorage.getItem("suppvis:admin-catalog:draft:new");
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.version === 1 && saved.draft) {
          setDraft(saved.draft);
          setBarcode({ ...emptyBarcode(), ...saved.barcode, confirmed: false });
          const evidence: CatalogEvidenceFile[] = saved.files ?? saved.evidence ?? [];
          setFiles(evidence);
          setMode(saved.mode ?? (saved.barcode?.value ? "manual" : "undecided"));
          const restored = saved.sources ?? emptySources();
          for (const role of ["barcode", "front_label", "supplement_facts"] as CatalogImageRole[]) {
            if (restored[role] === "processing") restored[role] = "analysis_failed";
          }
          // Local File bytes do not survive reload. Never reuse a hidden barcode image confirmation.
          if (evidence.some((file) => file.role === "barcode")) restored.barcode = "analysis_failed";
          setSources(restored);
          setFront(saved.front ?? null);
          setTemplates(saved.templates ?? []);
          setNotice("Recovered your local intake. Recheck barcode digits and product matches; reselect the barcode image to compare it, or explicitly choose manual digits.");
        }
      }
    } catch { setNotice("The saved intake could not be recovered. Start a new intake below."); }
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (!hydrated || finished) return;
    const timer = setTimeout(() => {
      try { localStorage.setItem(storageKey, JSON.stringify({ version: 1, draft, barcode, mode, sources, files: serializableEvidence(files), front, templates })); }
      catch { setNotice("Local draft preservation is unavailable in this browser. Keep this page open until saved."); }
    }, 300);
    return () => clearTimeout(timer);
  }, [hydrated, finished, draft, barcode, mode, sources, files, front, templates]);
  useEffect(() => () => { generation.current++; }, []);

  function invalidate() {
    generation.current++;
    setSearchedKey(null); setNewKey(null); setCandidates([]); setNextCursor(null); setTarget(null); setChecks([]); setAttach(false);
  }
  function sourceState(role: CatalogImageRole, state: SourceState) {
    setSources((current) => ({ ...current, [role]: state }));
    if (state === "processing" || state === "undecided") {
      invalidate();
      if (role === "front_label") setFront(null);
      if (role === "supplement_facts") setTemplates((current) => current.filter((candidate) => candidate.source !== "ocr_template"));
      if (role === "barcode") { setMode("image"); setBarcode(emptyBarcode()); }
    }
  }
  function skip(role: CatalogImageRole) {
    if (role === "barcode" && !window.confirm("Skip only if you cannot obtain a barcode image or its digits. This intake will have no barcode or package-size record. Continue?")) return;
    if (files.some((file) => file.role === role) && !window.confirm("Discard the selected image(s) for this source? They will not be saved.")) return;
    invalidate(); setFiles((current) => current.filter((file) => file.role !== role));
    setSources((current) => ({ ...current, [role]: "skipped" }));
    if (role === "barcode") { setMode("none"); setBarcode(emptyBarcode()); setTemplates((current) => current.filter((candidate) => candidate.source === "ocr_template")); }
    if (role === "front_label") setFront(null);
    if (role === "supplement_facts") setTemplates((current) => current.filter((candidate) => candidate.source !== "ocr_template"));
  }
  function skipAll() {
    if ((files.length || barcode.value) && !window.confirm("Discard all selected images and barcode digits and continue completely manually?")) return;
    invalidate(); setFiles([]); setMode("none"); setBarcode(emptyBarcode()); setFront(null); setTemplates([]);
    setSources({ barcode: "skipped", front_label: "skipped", supplement_facts: "skipped" });
    setNotice("Manual intake: no barcode or package-size record will be created. Check product name and brand for duplicates first.");
  }
  function changeBarcode(patch: Partial<BarcodeDraft>) {
    if (patch.value !== undefined || patch.format !== undefined) { invalidate(); setTemplates((current) => current.filter((candidate) => candidate.source === "ocr_template")); }
    setBarcode((current) => ({ ...current, ...patch, confirmed: patch.confirmed ?? ((patch.value !== undefined || patch.format !== undefined) ? false : current.confirmed) }));
  }
  function decoded(candidate: CatalogBarcodeDecodeResponse) {
    if (candidate.status === "decoded") {
      setBarcode({ ...emptyBarcode(), value: candidate.candidate.value, format: candidate.candidate.format });
      setMode("image");
    }
  }
  function manualDigits() {
    invalidate(); setMode("manual"); setBarcode((current) => ({ ...current, confirmed: false }));
    // Preserve a live image after decode failure; restored images must be reselected to view.
    setFiles((current) => current.filter((file) => file.role !== "barcode" || !!file.file));
    setSources((current) => ({ ...current, barcode: "ready" }));
  }
  function finish() {
    if (!window.confirm("Finish this intake? No new catalog data will be saved; unattached images will expire.")) return;
    generation.current++; setFinished(true); localStorage.removeItem(storageKey); localStorage.removeItem("suppvis:admin-catalog:draft:new");
  }
  function changeDraft(next: CatalogEditorDraft) {
    if (identityKey(next.labelName, next.brandName) !== key) invalidate();
    else if (target && (next.physicalForm !== draft.physicalForm || next.variant !== draft.variant)) { setChecks([]); setAttach(false); }
    setDraft(next);
  }
  function frontIdentity(candidate: CatalogFrontLabelTemplateResponse) {
    invalidate();
    setFront(candidate);
    setDraft((current) => ({
      ...current,
      labelName: candidate.labelNameCandidates.find((value) => value.trim()) ?? current.labelName,
      brandName: candidate.brandNameCandidates.find((value) => value.trim()) ?? current.brandName,
    }));
  }
  async function search(more = false) {
    if (!resolved || !draft.labelName.trim() || !draft.brandName.trim()) return;
    const token = ++generation.current;
    setBusy("search"); setError(null); setNewKey(null); setAttach(false); setTarget(null); setChecks([]);
    if (!more) { setSearchedKey(null); setCandidates([]); }
    try {
      // Require both fields to match before pagination; general catalog search remains separate.
      const response = await searchCatalogProducts({ exactLabelName: draft.labelName.trim(), exactBrandName: draft.brandName.trim(), status: "all", limit: 30, cursor: more ? nextCursor ?? undefined : undefined });
      if (token !== generation.current) return;
      if (response.results.some((product) => identityKey(product.labelName, product.brandName) !== key)) {
        throw new Error("The identity check returned unexpected results. Refresh and retry before continuing.");
      }
      setCandidates((current) => [...new Map([...(more ? current : []), ...response.results].map((product) => [product.id, product])).values()]);
      setNextCursor(response.nextCursor);
      setSearchedKey(key);
      if (!more && !response.results.length && !response.nextCursor) setNewKey(key);
    } catch (caught) { if (token === generation.current) setError(message(caught)); }
    finally { setBusy(null); }
  }
  async function compare(id: string) {
    const token = ++generation.current;
    setBusy("compare"); setError(null); setTarget(null); setChecks([]); setAttach(false);
    try { const product = await getCatalogProduct(id); if (token === generation.current) setTarget(product); }
    catch (caught) { if (token === generation.current) setError(message(caught)); }
    finally { setBusy(null); }
  }
  async function publicTemplates() {
    const token = generation.current;
    setBusy("templates"); setError(null);
    try {
      const response = await getPublicTemplates(barcodeInput(barcode));
      if (token !== generation.current) return;
      setTemplates((current) => [...current.filter((candidate) => candidate.source === "ocr_template"), ...response.candidates]);
      setNotice(response.sourceErrors.length ? response.sourceErrors.map((entry) => `${entry.source}: ${entry.message}`).join("; ") : "Independent public sources loaded. Select one source or continue manually.");
    } catch (caught) { if (token === generation.current) setError(message(caught)); }
    finally { setBusy(null); }
  }
  const blockers = [
    ...barcodeBlockers(barcode, lookup.result),
    ...evidenceBlockers(attaching ? files.filter((file) => file.role === "barcode") : files),
    ...(creating ? catalogDraftBlockers(draft) : []),
    ...(!creating && !attaching ? ["Complete the source and product-match review first."] : []),
  ];
  async function saveDraft() {
    if (saving.current || busy || blockers.length) return;
    saving.current = true; setBusy("save"); setError(null);
    try {
      // Read immediately before write; the transaction's unique GTIN constraint is authoritative.
      if (mode !== "none") {
        const fresh = await lookupCatalogBarcode(barcodeInput(barcode));
        if (fresh.found) { lookup.retry(); setNotice("This barcode was just assigned. Review the authoritative match before continuing."); return; }
      }
      const saved = attaching && target
        ? await attachCatalogBarcode(target.id, { expectedRevision: target.revision, barcode: barcodeInput(barcode), imageSets: evidenceImageSets(files.filter((file) => file.role === "barcode"), "append") })
        : await createCatalogProduct({ product: catalogProductFromDraft(draft), ...(mode !== "none" ? { barcode: barcodeInput(barcode) } : {}), templateProvenance: draft.templateProvenance, imageSets: evidenceImageSets(files, "append") });
      setFinished(true); localStorage.removeItem(storageKey); localStorage.removeItem("suppvis:admin-catalog:draft:new");
      onSaved(saved.product.id);
    } catch (caught) {
      if (caught instanceof CatalogApiError && caught.code === "BARCODE_ALREADY_ASSIGNED") {
        lookup.retry(); setError("Another intake assigned this barcode. The automatic check will load its current product; nothing was duplicated.");
      } else if (caught instanceof CatalogApiError && ["REVISION_CONFLICT", "PRODUCT_RETIRED", "PRODUCT_NOT_FOUND"].includes(caught.code) && target) {
        const id = target.id; setChecks([]); setAttach(false); await compare(id);
        setError("The matched product changed. Review the reloaded details and confirm every identifying factor again.");
      } else {
        if (mode === "none") invalidate();
        setError(`${message(caught)} Your intake is preserved. ${mode === "none" ? "Recheck product matches before retrying, in case the first save succeeded." : "The next Save draft rechecks the barcode before writing."}`);
      }
    } finally { saving.current = false; setBusy(null); }
  }

  if (!hydrated) return <p role="status">Restoring local intake…</p>;
  if (finished) return <section className={panel}><p>Intake finished.</p><button className={`${button} mt-3`} onClick={() => { setDraft(createEmptyCatalogDraft()); setFiles([]); setSources(emptySources()); setBarcode(emptyBarcode()); setMode("undecided"); setFront(null); setTemplates([]); setNotice(null); setError(null); invalidate(); setFinished(false); }}>Start another product</button></section>;
  return <div className="space-y-4">
    {notice ? <p role="status" className={`${panel} text-sm text-text-secondary`}>{notice}</p> : null}
    {error ? <p role="alert" className={`${panel} text-sm text-error`}>{error}</p> : null}
    <fieldset disabled={busy !== null} className="min-w-0 space-y-4">
      <CatalogEvidencePanel files={files} onChange={setFiles} disabled={busy !== null} onFrontCandidate={frontIdentity} onFormulaCandidate={(candidate) => setTemplates((current) => [candidate, ...current.filter((entry) => entry.source !== "ocr_template")])} onBarcodeCandidate={decoded}
        intake={{ states: sources, onState: sourceState, onSkip: skip, onSkipAll: skipAll, onManualBarcode: manualDigits, stopForDuplicate: !!found,
          barcodeControl: mode === "image" || mode === "manual" ? <CatalogBarcodeFields value={barcode} onChange={changeBarcode} file={files.find((file) => file.role === "barcode")?.file} lookupFailed={!!lookup.error} retry={lookup.retry} lookupMessage={lookup.error || (lookup.checking ? "Checking SuppVis for this barcode…" : found ? "Already in the catalog. Review the match below." : lookup.result ? "No existing barcode found. Confirm the digits and resolve the other sources." : "Valid digits will be checked automatically.")} /> : null }} />
      {found ? <section className={panel}>
        <h3 className="text-lg font-semibold">This barcode is already in the database</h3>
        <p className="mt-2 text-sm">{barcode.confirmed ? "No new entry is needed." : "Provisional match: compare and confirm the digits above before opening the entry."} You do not need to upload or skip the other images.</p>
        <ProductComparison product={found} />
        <div className="mt-3 flex gap-2">{found.status === "draft" ? <button className={primary} disabled={!barcode.confirmed} onClick={() => onOpen(found.id)}>Review / edit existing draft</button> : <p className="text-warning">Lifecycle-safe barcode management for {found.status} products arrives in Phase 2. No changes will be made.</p>}<button className={button} onClick={finish}>Already entered — finish</button></div>
      </section> : null}
      {resolved && !found ? <>
        <section className={panel}>
          <h3 className="text-lg font-semibold">Check product identity</h3>
          <p className="mt-1 text-sm text-text-secondary">Check the label name and brand below. Matches must have both the same label name and brand, ignoring capitalization.</p>
          {mode === "none" && !allSkipped ? <p className="mt-2 text-sm text-warning">Barcode skipped: only continue without one if its image and digits are unavailable. No package-size child can be added without a barcode in Phase 1.</p> : null}
          {front?.reviewReasons.length ? <p className="mt-3 text-xs text-warning">{front.reviewReasons.join(", ")}</p> : null}
          <div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-xs">Product / label name<input aria-label="Intake product name" maxLength={200} className={input} value={draft.labelName} onChange={(e) => changeDraft({ ...draft, labelName: e.target.value })} /></label><label className="text-xs">Brand / manufacturer<input aria-label="Intake brand" maxLength={160} className={input} value={draft.brandName} onChange={(e) => changeDraft({ ...draft, brandName: e.target.value })} /></label></div>
          <button className={`${primary} mt-3`} disabled={!draft.labelName.trim() || !draft.brandName.trim()} onClick={() => void search()}>Find potential matches</button>
          {searched && !candidates.length && !nextCursor ? <p role="status" className="mt-3 text-sm">No matches found. Continue with the new product below.</p> : null}
        </section>
        {searched && !creating && !attaching ? <section className={panel}>
          <h3 className="text-lg font-semibold">Potential matching products</h3>
          <p className="mt-1 text-sm text-text-muted">Compare the full identifying details. Package quantity and barcode may differ; everything else must match.</p>
          <div className="mt-3 space-y-2">{candidates.map((product) => <button className="block w-full rounded border border-white/15 p-3 text-left text-sm" key={product.id} onClick={() => void compare(product.id)}><strong>{product.brandName} · {product.labelName}</strong><span className="mt-1 block">{product.status} · {product.variant || "No variant"} · {product.physicalForm}{product.needsFollowUp ? " · Needs follow-up/review" : ""}</span></button>)}{!candidates.length ? <p>No potential matches found.</p> : null}</div>
          {nextCursor ? <button className={`${button} mt-3`} onClick={() => void search(true)}>Load more potential matches</button> : null}
          {target ? <div className="mt-4 border-t border-white/15 pt-3">
            <ProductComparison product={target} />
            <div className="mt-3 grid gap-2 sm:grid-cols-2">{files.filter((file) => file.role !== "barcode").map((file) => <LocalSourceImage key={file.clientId} file={file.file} alt={`New package ${file.role.replaceAll("_", " ")} for comparison`} />)}</div>
            <p className="mt-3 text-sm text-warning">Check each factor only after comparing it. A difference means this is a different product; if unsure, do not attach.</p>
            <div className="mt-3 space-y-2">{identifyingFactors.map((factor, index) => <label className="flex gap-2 text-sm" key={factor}><input type="checkbox" checked={checks[index] ?? false} onChange={(e) => setChecks((current) => identifyingFactors.map((_, i) => i === index ? e.target.checked : current[i] ?? false))} />{factor}</label>)}</div>
            {target.status !== "draft" ? <p className="mt-3 text-warning">This product is {target.status}. Lifecycle-safe barcode management arrives in Phase 2. If it matches, finish without changes.</p>
              : mode === "none" ? <p className="mt-3 text-sm">If all factors match, this product is already entered. There is no new barcode to add. Adding a barcode-less package size is out of scope.</p>
              : <button className={`${primary} mt-3`} disabled={!allFactorsConfirmed(checks)} onClick={() => setAttach(true)}>Use this matching draft</button>}
            {(mode === "none" || target.status !== "draft") ? <button className={`${button} mt-3`} disabled={!allFactorsConfirmed(checks)} onClick={finish}>Product already exists — finish without changes</button> : null}
          </div> : null}
          <button className={`${button} mt-4`} onClick={() => { setTarget(null); setChecks([]); setNewKey(key); }}>No match — create a new product</button>
        </section> : null}
        {attaching && target ? <section className={panel}><h3 className="text-lg font-semibold">Add a barcode to {target.brandName} {target.labelName}</h3><p className="mt-2 text-sm">Only the new barcode, its optional package size, and its barcode image will be saved. Existing product details, front-label images, and Supplement Facts images remain unchanged. Other newly uploaded images will expire.</p><PackageFields value={barcode} onChange={changeBarcode} /><button className={`${button} mt-3`} onClick={() => { setAttach(false); setChecks([]); }}>Back to product comparison</button></section> : null}
        {creating ? <>
          <section className={panel}><h3 className="font-semibold">New product draft</h3>{candidates.length ? <button className={`${button} mt-2`} onClick={() => setNewKey(null)}>Back to potential matches</button> : null}{mode !== "none" ? <PackageFields value={barcode} onChange={changeBarcode} /> : <p className="mt-2 text-xs text-text-muted">This product will have no barcode or package-size record.</p>}</section>
          {!allSkipped ? <section className={panel}><h3 className="text-lg font-semibold">Formula sources</h3><p className="mt-1 text-xs text-text-muted">{mode === "none" ? "OCR or manual entry" : "OCR → NIH DSLD → Open Food Facts → manual"}. Select a source explicitly; candidates are never merged.</p>{mode !== "none" ? <button className={`${button} mt-3`} onClick={() => void publicTemplates()}>Load NIH & OFF candidates</button> : null}<div className="mt-3 grid gap-3 lg:grid-cols-2">{templates.map((candidate) => <div className="rounded border border-white/15 p-3 text-sm" key={candidate.templateId}><strong>{candidate.sourceLabel}</strong><p>{candidate.components.length} top-level formula rows · {candidate.nutritionFacts.length} nutrition rows</p><p className="text-xs text-warning">{candidate.reviewReasons.join(", ")}</p><button className={`${button} mt-2`} onClick={() => { const next = applyTemplateToDraft(draft, candidate, false); setDraft({ ...next, labelName: draft.labelName, brandName: draft.brandName }); }}>Use source in editor</button></div>)}<p className="text-sm">Manual entry: enter or correct the formula below.</p></div></section> : null}
          <CatalogFormulaEditor draft={draft} onChange={changeDraft} />
        </> : null}
      </> : null}
    </fieldset>
    {(creating || attaching) ? <section className={`${panel} sticky bottom-3 z-10 bg-[#080D12]/95 shadow-xl`}>
      {blockers.length ? <ul className="mb-3 max-h-32 list-disc overflow-auto pl-5 text-xs text-warning">{[...new Set(blockers)].map((blocker) => <li key={blocker}>{blocker}</li>)}</ul> : <p className="mb-3 text-sm">Ready to save a draft. No publication.</p>}
      <button disabled={!!busy || blockers.length > 0} onClick={() => void saveDraft()} className={primary}>{busy === "save" ? "Saving draft…" : "Save draft"}</button>
    </section> : null}
  </div>;
}
