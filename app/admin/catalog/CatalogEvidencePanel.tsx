"use client";

import { useState, type DragEvent, type ReactNode } from "react";
import type { SourceStates, SourceState } from "./catalog-intake";
import { addEvidenceFiles, catalogRoleLimits, moveEvidenceFile, type CatalogEvidenceFile } from "./catalog-evidence";
import useCatalogEvidenceProcessing from "./useCatalogEvidenceProcessing";
import type { CatalogBarcodeDecodeResponse, CatalogFormulaTemplateCandidate, CatalogFrontLabelTemplateResponse, CatalogImageRole } from "./contracts.generated";

const roleCopy: Record<CatalogImageRole, { title: string; detail: string }> = {
  front_label: { title: "Front label", detail: "One optional image for the product label and brand." },
  supplement_facts: { title: "Supplement Facts", detail: "One to four ordered panels. You can add more images while OCR runs." },
  barcode: { title: "Barcode", detail: "One optional image. Bars are decoded and validated; you must still confirm the digits." },
};

export default function CatalogEvidencePanel({
  files, onChange, onFrontCandidate, onFormulaCandidate, onBarcodeCandidate,
  currentImageRoles = [], intake, disabled = false,
}: {
  files: CatalogEvidenceFile[];
  onChange: (files: CatalogEvidenceFile[]) => void;
  onFrontCandidate: (candidate: CatalogFrontLabelTemplateResponse) => void;
  onFormulaCandidate: (candidate: CatalogFormulaTemplateCandidate) => void;
  onBarcodeCandidate: (candidate: CatalogBarcodeDecodeResponse) => void;
  currentImageRoles?: CatalogImageRole[];
  disabled?: boolean;
  intake?: {
    states: SourceStates;
    onState: (role: CatalogImageRole, state: SourceState) => void;
    onSkip: (role: CatalogImageRole) => boolean;
    onSkipAll: () => boolean;
    onManualBarcode: () => void;
    barcodeControl: ReactNode;
    frontControl: ReactNode;
    stopForDuplicate?: boolean;
  };
}) {
  const [draggingRole, setDraggingRole] = useState<CatalogImageRole | null>(null);
  const processing = useCatalogEvidenceProcessing({ files, onChange, onFrontCandidate, onFormulaCandidate, onBarcodeCandidate, onState: intake?.onState });

  async function selectFiles(role: CatalogImageRole, selected: FileList | null) {
    if (!selected?.length || processing.uploading.current.has(role) || disabled) return;
    try {
      const current = processing.files.current;
      const next = addEvidenceFiles(current, role, [...selected]);
      const replacesPending = catalogRoleLimits[role] === 1 && current.some((file) => file.role === role);
      const replacesCurrent = catalogRoleLimits[role] === 1 && currentImageRoles.includes(role);
      if ((replacesPending || replacesCurrent) && !window.confirm(
        `Only one current ${roleCopy[role].title.toLowerCase()} image is allowed. ${replacesCurrent ? "Saving this draft will supersede the current stored image." : "This will replace the image already selected."} Continue?`,
      )) return;
      processing.changeRole(role, next);
      await processing.process(role, next);
    } catch (error) { processing.notify(role, error instanceof Error ? error.message : "The image request failed."); }
  }
  function dragFiles(event: DragEvent<HTMLLabelElement>, role: CatalogImageRole) {
    event.preventDefault();
    if (!disabled && !processing.uploading.current.has(role) && event.dataTransfer.types.includes("Files")) {
      event.dataTransfer.dropEffect = "copy";
      setDraggingRole(role);
    }
  }
  function dropFiles(event: DragEvent<HTMLLabelElement>, role: CatalogImageRole) {
    event.preventDefault();
    setDraggingRole(null);
    void selectFiles(role, event.dataTransfer.files);
  }
  function reorder(role: CatalogImageRole, id: string, direction: -1 | 1) {
    const next = moveEvidenceFile(processing.files.current, id, direction);
    processing.changeRole(role, next);
    void processing.process(role, next);
  }
  function remove(role: CatalogImageRole, id: string) {
    processing.cancel(role);
    const next = processing.files.current.filter((file) => file.clientId !== id);
    processing.changeRole(role, next);
    intake?.onState(role, "undecided");
    if (next.some((file) => file.role === role)) void processing.process(role, next);
  }

  return <section className="rounded-[8px] border border-white/10 bg-[#0D1117] p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <h2 className="font-headline text-xl font-bold">Source images</h2>
      <p className="max-w-xl text-xs leading-5 text-text-muted">{intake ? "Upload or explicitly skip each source. You can also type barcode digits. " : "Images are optional. "}Front label and barcode accept one image each; Supplement Facts accepts up to four ordered images. Upload and analysis run independently, so you can keep working while OCR finishes.</p>
    </div>
    {intake && !intake.stopForDuplicate ? <button type="button" disabled={disabled} onClick={() => { if (intake.onSkipAll()) for (const role of Object.keys(roleCopy) as CatalogImageRole[]) processing.cancel(role); }} className="mt-3 rounded-full border border-white/20 px-3 py-2 text-xs disabled:opacity-40">Skip all images — completely manual entry</button> : null}
    <div className="mt-4 grid gap-4 xl:grid-cols-3">
      {(intake ? (intake.stopForDuplicate ? ["barcode"] : ["barcode", "front_label", "supplement_facts"]) as CatalogImageRole[] : Object.keys(roleCopy) as CatalogImageRole[]).map((role) => {
        const roleFiles = files.filter((file) => file.role === role);
        const singleImageRole = catalogRoleLimits[role] === 1;
        const replacesCurrent = singleImageRole && currentImageRoles.includes(role);
        const uploading = processing.activities[role] === "uploading";
        return <div key={role} data-source-role={role} className="min-w-0 rounded-[8px] border border-white/10 bg-[#080D12] p-3">
          <h3 className="font-semibold">{roleCopy[role].title}</h3>
          {intake ? <p role="status" className="mt-1 text-xs text-accent">{intake.states[role].replaceAll("_", " ")}</p> : null}
          <p className="mt-1 min-h-10 text-xs leading-5 text-text-muted">{roleCopy[role].detail}</p>
          {processing.activities[role] === "analyzing" ? <p role="status" className="mt-2 text-xs text-accent">Reading images… You can keep working.</p> : null}
          {processing.notices[role] ? <p role="status" className="mt-2 text-xs text-text-secondary">{processing.notices[role]}</p> : null}
          {replacesCurrent ? <p className="mt-2 text-xs text-warning">Warning: adding a new image will supersede the current stored image when you Save draft.</p> : null}
          <label
            onDragEnter={(event) => dragFiles(event, role)}
            onDragOver={(event) => dragFiles(event, role)}
            onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDraggingRole((current) => current === role ? null : current); }}
            onDrop={(event) => dropFiles(event, role)}
            className={`mt-3 block cursor-pointer rounded border border-dashed px-3 py-4 text-center text-xs font-semibold transition ${draggingRole === role ? "border-accent bg-accent/10 text-accent" : "border-white/20 text-text-secondary hover:border-accent/60 hover:text-accent"}`}
          >
            <span className="block">{singleImageRole && (roleFiles.length > 0 || replacesCurrent) ? "Replace image" : role === "supplement_facts" ? "Add images (max 4)" : "Add image"}</span>
            <span className="mt-1 block font-normal text-text-muted">Drag and drop here, or click to browse</span>
            <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" multiple={!singleImageRole} disabled={disabled || uploading} className="sr-only"
              onChange={(event) => { void selectFiles(role, event.target.files); event.currentTarget.value = ""; }} />
          </label>
          <ol className="mt-3 space-y-2">{roleFiles.map((file, index) => <li key={file.clientId} className="rounded border border-white/10 p-2 text-xs">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0"><p className="truncate font-semibold text-text-primary">{index + 1}. {file.fileName}</p>
                <p className={file.status === "failed" ? "mt-1 text-error" : "mt-1 text-text-muted"}>{file.status} · {(file.byteSize / 1024 / 1024).toFixed(1)} MiB</p>
                {file.error ? <p className="mt-1 text-error">{file.error}</p> : null}
              </div>
              <div className="flex gap-1">
                {!singleImageRole ? <button type="button" disabled={disabled || uploading} aria-label="Move image earlier" onClick={() => reorder(role, file.clientId, -1)} className="rounded border border-white/10 px-2 py-1 disabled:opacity-40">↑</button> : null}
                {!singleImageRole ? <button type="button" disabled={disabled || uploading} aria-label="Move image later" onClick={() => reorder(role, file.clientId, 1)} className="rounded border border-white/10 px-2 py-1 disabled:opacity-40">↓</button> : null}
                <button type="button" disabled={disabled || uploading} aria-label="Remove image" onClick={() => remove(role, file.clientId)} className="rounded border border-white/10 px-2 py-1 text-error disabled:opacity-40">×</button>
              </div>
            </div>
          </li>)}</ol>
          {intake ? <div className="mt-3 space-y-2">
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={disabled} onClick={() => { if (intake.onSkip(role)) processing.cancel(role); }} className="rounded border border-white/20 px-2 py-1 text-xs disabled:opacity-40">{role === "barcode" ? "Skip — no image or digits" : "Skip this image"}</button>
              {role === "barcode" ? <button type="button" disabled={disabled || uploading} onClick={() => { processing.cancel(role); intake.onManualBarcode(); }} className="rounded border border-white/20 px-2 py-1 text-xs disabled:opacity-40">Manually type barcode digits</button> : null}
              {intake.states[role] === "analysis_failed" ? <>
                <button type="button" disabled={disabled || uploading} onClick={() => void processing.process(role)} className="rounded border border-white/20 px-2 py-1 text-xs disabled:opacity-40">Retry failed source</button>
                {role !== "barcode" && roleFiles.every((file) => file.status === "uploaded") ? <button type="button" disabled={disabled} onClick={() => { processing.cancel(role); intake.onState(role, "ready"); }} className="rounded border border-white/20 px-2 py-1 text-xs disabled:opacity-40">Keep image, enter details manually</button> : null}
              </> : null}
            </div>
            {role === "barcode" ? intake.barcodeControl : null}
            {role === "front_label" ? intake.frontControl : null}
          </div> : null}
        </div>;
      })}
    </div>
  </section>;
}
