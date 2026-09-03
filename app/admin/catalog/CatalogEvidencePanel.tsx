"use client";

import { useRef, useState, type DragEvent, type ReactNode } from "react";
import type { SourceStates, SourceState } from "./catalog-intake";
import {
  decodeBarcodeImage,
  getFrontLabelTemplate,
  getOcrTemplate,
  putCatalogUpload,
  requestCatalogUploads,
  sha256File,
} from "./catalog-api";
import {
  addEvidenceFiles,
  catalogRoleLimits,
  moveEvidenceFile,
  type CatalogEvidenceFile,
} from "./catalog-evidence";
import type {
  CatalogBarcodeDecodeResponse,
  CatalogFormulaTemplateCandidate,
  CatalogFrontLabelTemplateResponse,
  CatalogImageRole,
} from "./contracts.generated";

const roleCopy: Record<CatalogImageRole, { title: string; detail: string }> = {
  front_label: {
    title: "Front label",
    detail: "One optional image for product identity suggestions. A new image replaces the current one.",
  },
  supplement_facts: {
    title: "Supplement Facts",
    detail: "One to four ordered panels analyzed together as the preferred formula candidate.",
  },
  barcode: {
    title: "Barcode",
    detail: "One optional image. Bars are decoded and validated; you must still confirm the digits.",
  },
};

function message(error: unknown) {
  return error instanceof Error ? error.message : "The evidence request failed.";
}

export default function CatalogEvidencePanel({
  files,
  onChange,
  onFrontCandidate,
  onFormulaCandidate,
  onBarcodeCandidate,
  currentImageRoles = [],
  intake,
  disabled = false,
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
    onSkip: (role: CatalogImageRole) => void;
    onSkipAll: () => void;
    onManualBarcode: () => void;
    barcodeControl: ReactNode;
    stopForDuplicate?: boolean;
  };
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [draggingRole, setDraggingRole] = useState<CatalogImageRole | null>(null);
  const inFlight = useRef(false);

  async function selectFiles(role: CatalogImageRole, selected: FileList | null) {
    if (!selected?.length || inFlight.current || disabled) return;
    try {
      const next = addEvidenceFiles(files, role, [...selected]);
      const replacesPending = catalogRoleLimits[role] === 1
        && files.some((file) => file.role === role);
      const replacesCurrent = catalogRoleLimits[role] === 1
        && currentImageRoles.includes(role);
      if ((replacesPending || replacesCurrent) && !window.confirm(
        `Only one current ${roleCopy[role].title.toLowerCase()} image is allowed. ${replacesCurrent ? "Saving this draft will supersede the current stored image." : "This will replace the image already selected."} Continue?`,
      )) return;
      intake?.onState(role, "processing");
      onChange(next);
      await uploadRole(role, next, replacesCurrent || replacesPending);
    } catch (error) {
      setNotice(message(error));
    }
  }

  function dragFiles(event: DragEvent<HTMLLabelElement>, role: CatalogImageRole) {
    event.preventDefault();
    if (!disabled && busy === null && event.dataTransfer.types.includes("Files")) {
      event.dataTransfer.dropEffect = "copy";
      setDraggingRole(role);
    }
  }

  function leaveDropZone(event: DragEvent<HTMLLabelElement>, role: CatalogImageRole) {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setDraggingRole((current) => current === role ? null : current);
  }

  function dropFiles(event: DragEvent<HTMLLabelElement>, role: CatalogImageRole) {
    event.preventDefault();
    setDraggingRole(null);
    if (disabled || inFlight.current) {
      setNotice("Wait for the current evidence action to finish before adding images.");
      return;
    }
    void selectFiles(role, event.dataTransfer.files);
  }

  async function uploadRole(role: CatalogImageRole, initialFiles: CatalogEvidenceFile[], isReplacement: boolean) {
    const pending = initialFiles.filter((file) => file.role === role && file.status !== "uploaded");
    if (pending.length === 0) return;
    if (pending.some((entry) => !entry.file)) {
      setNotice("A restored local file must be selected again before it can be uploaded.");
      return;
    }
    setBusy(`upload:${role}`);
    inFlight.current = true;
    intake?.onState(role, "processing");
    setNotice(`${isReplacement ? "Replacement image selected. " : ""}${roleCopy[role].title} is uploading and will be analyzed automatically.`);
    let working = initialFiles;
    try {
      const descriptors = [];
      for (const entry of pending) {
        working = working.map((file) => file.clientId === entry.clientId
          ? { ...file, status: "hashing" as const, error: null }
          : file);
        onChange(working);
        const sha256 = await sha256File(entry.file!);
        working = working.map((file) => file.clientId === entry.clientId
          ? { ...file, sha256, status: "requesting" as const }
          : file);
        onChange(working);
        descriptors.push({
          clientId: entry.clientId,
          role,
          originalFilename: entry.fileName,
          mimeType: entry.mimeType,
          byteSize: entry.byteSize,
          sha256,
        });
      }
      const response = await requestCatalogUploads({ files: descriptors });
      const uploadById = new Map(response.uploads.map((upload) => [upload.clientId, upload]));
      for (const entry of pending) {
        const upload = uploadById.get(entry.clientId);
        if (!upload) {
          working = working.map((file) => file.clientId === entry.clientId
            ? { ...file, status: "failed" as const, error: "No scoped upload was returned." }
            : file);
          onChange(working);
          continue;
        }
        working = working.map((file) => file.clientId === entry.clientId
          ? { ...file, status: "uploading" as const, error: null }
          : file);
        onChange(working);
        try {
          await putCatalogUpload(entry.file!, upload);
          working = working.map((file) => file.clientId === entry.clientId
            ? {
                ...file,
                status: "uploaded" as const,
                uploadHandle: upload.uploadHandle,
                expiresAt: upload.expiresAt,
                error: null,
              }
            : file);
        } catch (error) {
          working = working.map((file) => file.clientId === entry.clientId
            ? { ...file, status: "failed" as const, error: message(error) }
            : file);
        }
        onChange(working);
      }
      if (working.some((file) => file.role === role && file.status !== "uploaded")) {
        intake?.onState(role, "analysis_failed");
        setNotice(`The ${roleCopy[role].title.toLowerCase()} upload did not finish. Remove or replace the failed image to retry.`);
      } else {
        await analyze(role, working);
      }
    } catch (error) {
      const pendingIds = new Set(pending.map((entry) => entry.clientId));
      working = working.map((file) => pendingIds.has(file.clientId) && file.status !== "uploaded"
        ? { ...file, status: "failed", error: message(error) }
        : file);
      onChange(working);
      intake?.onState(role, "analysis_failed");
      setNotice(message(error));
    } finally {
      setBusy(null);
      inFlight.current = false;
    }
  }

  function uploadedHandles(role: CatalogImageRole, sourceFiles: CatalogEvidenceFile[] = files) {
    return sourceFiles
      .filter((file) => file.role === role && file.status === "uploaded" && file.uploadHandle)
      .map((file) => file.uploadHandle!);
  }

  async function analyze(role: CatalogImageRole, sourceFiles: CatalogEvidenceFile[]) {
    const handles = uploadedHandles(role, sourceFiles);
    if (handles.length === 0) return;
    setBusy(`analyze:${role}`);
    inFlight.current = true;
    intake?.onState(role, "processing");
    setNotice(null);
    try {
      if (role === "front_label") onFrontCandidate(await getFrontLabelTemplate(handles));
      if (role === "supplement_facts") onFormulaCandidate((await getOcrTemplate(handles)).candidate);
      if (role === "barcode") {
        const decoded = await decodeBarcodeImage(handles[0]);
        onBarcodeCandidate(decoded);
        if (decoded.status === "manual_required") {
          intake?.onState(role, "analysis_failed");
          setNotice(`Barcode could not be decoded: ${decoded.reason.replaceAll("_", " ")}. Retry, replace, type the digits, or explicitly skip.`);
          return;
        }
      }
      intake?.onState(role, "ready");
      setNotice(`${roleCopy[role].title} uploaded and analyzed. Review the suggestions below; nothing is saved to the catalog until Save draft.`);
    } catch (error) {
      intake?.onState(role, "analysis_failed");
      setNotice(message(error));
    } finally {
      setBusy(null);
      inFlight.current = false;
    }
  }

  return (
    <section className="rounded-[8px] border border-white/10 bg-[#0D1117] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-headline text-xl font-bold">Source images</h2>
        </div>
        <p className="max-w-xl text-xs leading-5 text-text-muted">{intake ? "Upload or explicitly skip each source to continue. You can also type barcode digits. " : "Images are optional. "}Front label and barcode accept one image each; Supplement Facts accepts up to four ordered images. Upload and analysis start automatically, and images remain private.</p>
      </div>
      {intake && !intake.stopForDuplicate ? <button type="button" disabled={disabled || busy !== null} onClick={intake.onSkipAll} className="mt-3 rounded-full border border-white/20 px-3 py-2 text-xs disabled:opacity-40">Skip all images — completely manual entry</button> : null}
      {notice ? <p role="status" className="mt-3 rounded border border-white/10 bg-[#080D12] p-3 text-sm text-text-secondary">{notice}</p> : null}
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        {(intake ? (intake.stopForDuplicate ? ["barcode"] : ["barcode", "front_label", "supplement_facts"]) as CatalogImageRole[] : Object.keys(roleCopy) as CatalogImageRole[]).map((role) => {
          const roleFiles = files.filter((file) => file.role === role);
          const singleImageRole = catalogRoleLimits[role] === 1;
          const replacesCurrent = singleImageRole && currentImageRoles.includes(role);
          return (
            <div key={role} className="rounded-[8px] border border-white/10 bg-[#080D12] p-3">
              <h3 className="font-semibold">{roleCopy[role].title}</h3>
              {intake ? <p role="status" className="mt-1 text-xs text-accent">{intake.states[role].replaceAll("_", " ")}</p> : null}
              <p className="mt-1 min-h-10 text-xs leading-5 text-text-muted">{roleCopy[role].detail}</p>
              {replacesCurrent ? <p className="mt-2 text-xs text-warning">Warning: adding a new image will supersede the current stored image when you Save draft.</p> : null}
              <label
                onDragEnter={(event) => dragFiles(event, role)}
                onDragOver={(event) => dragFiles(event, role)}
                onDragLeave={(event) => leaveDropZone(event, role)}
                onDrop={(event) => dropFiles(event, role)}
                className={`mt-3 block cursor-pointer rounded border border-dashed px-3 py-4 text-center text-xs font-semibold transition ${draggingRole === role ? "border-accent bg-accent/10 text-accent" : "border-white/20 text-text-secondary hover:border-accent/60 hover:text-accent"}`}
              >
                <span className="block">{singleImageRole && (roleFiles.length > 0 || replacesCurrent) ? "Replace image" : role === "supplement_facts" ? "Add images (max 4)" : "Add image"}</span>
                <span className="mt-1 block font-normal text-text-muted">Drag and drop here, or click to browse</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
                  multiple={!singleImageRole}
                  disabled={disabled || busy !== null}
                  className="sr-only"
                  onChange={(event) => {
                    void selectFiles(role, event.target.files);
                    event.currentTarget.value = "";
                  }}
                />
              </label>
              <ol className="mt-3 space-y-2">
                {roleFiles.map((file, index) => (
                  <li key={file.clientId} className="rounded border border-white/10 p-2 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-text-primary">{index + 1}. {file.fileName}</p>
                        <p className={file.status === "failed" ? "mt-1 text-error" : "mt-1 text-text-muted"}>
                          {file.status} · {(file.byteSize / 1024 / 1024).toFixed(1)} MiB
                        </p>
                        {file.error ? <p className="mt-1 text-error">{file.error}</p> : null}
                      </div>
                      <div className="flex gap-1">
                        {!singleImageRole ? <button type="button" disabled={disabled || busy !== null} aria-label="Move image earlier" onClick={() => { const next = moveEvidenceFile(files, file.clientId, -1); onChange(next); if (intake) void analyze(role, next); }} className="rounded border border-white/10 px-2 py-1 disabled:opacity-40">↑</button> : null}
                        {!singleImageRole ? <button type="button" disabled={disabled || busy !== null} aria-label="Move image later" onClick={() => { const next = moveEvidenceFile(files, file.clientId, 1); onChange(next); if (intake) void analyze(role, next); }} className="rounded border border-white/10 px-2 py-1 disabled:opacity-40">↓</button> : null}
                        <button type="button" disabled={disabled || busy !== null} aria-label="Remove image" onClick={() => { const next = files.filter((entry) => entry.clientId !== file.clientId); onChange(next); intake?.onState(role, "undecided"); if (intake && next.some((entry) => entry.role === role && entry.status === "uploaded")) void analyze(role, next); }} className="rounded border border-white/10 px-2 py-1 text-error disabled:opacity-40">×</button>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
              {intake ? <div className="mt-3 space-y-2">
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={disabled || busy !== null} onClick={() => intake.onSkip(role)} className="rounded border border-white/20 px-2 py-1 text-xs disabled:opacity-40">{role === "barcode" ? "Skip — no image or digits" : "Skip this image"}</button>
                  {role === "barcode" ? <button type="button" disabled={disabled || busy !== null} onClick={intake.onManualBarcode} className="rounded border border-white/20 px-2 py-1 text-xs disabled:opacity-40">Manually type barcode digits</button> : null}
                  {intake.states[role] === "analysis_failed" ? <>
                    <button type="button" disabled={disabled || busy !== null} onClick={() => { if (roleFiles.some((file) => file.status !== "uploaded")) void uploadRole(role, files, false); else void analyze(role, files); }} className="rounded border border-white/20 px-2 py-1 text-xs disabled:opacity-40">Retry failed source</button>
                    {role !== "barcode" && roleFiles.every((file) => file.status === "uploaded") ? <button type="button" disabled={disabled || busy !== null} onClick={() => intake.onState(role, "ready")} className="rounded border border-white/20 px-2 py-1 text-xs disabled:opacity-40">Keep image, enter details manually</button> : null}
                  </> : null}
                </div>
                {role === "barcode" ? intake.barcodeControl : null}
              </div> : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
