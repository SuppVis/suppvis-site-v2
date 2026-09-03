"use client";

import { useState, type DragEvent } from "react";
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
    detail: "Product identity suggestions only. Values apply only when you choose Use source.",
  },
  supplement_facts: {
    title: "Supplement Facts",
    detail: "One to four ordered panels analyzed together as the preferred formula candidate.",
  },
  barcode: {
    title: "Barcode",
    detail: "Bars are decoded and validated. You must still confirm the digits.",
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
}: {
  files: CatalogEvidenceFile[];
  onChange: (files: CatalogEvidenceFile[]) => void;
  onFrontCandidate: (candidate: CatalogFrontLabelTemplateResponse) => void;
  onFormulaCandidate: (candidate: CatalogFormulaTemplateCandidate) => void;
  onBarcodeCandidate: (candidate: CatalogBarcodeDecodeResponse) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [draggingRole, setDraggingRole] = useState<CatalogImageRole | null>(null);

  function selectFiles(role: CatalogImageRole, selected: FileList | null) {
    if (!selected?.length) return;
    try {
      onChange(addEvidenceFiles(files, role, [...selected]));
      setNotice(null);
    } catch (error) {
      setNotice(message(error));
    }
  }

  function dragFiles(event: DragEvent<HTMLLabelElement>, role: CatalogImageRole) {
    event.preventDefault();
    if (busy === null && event.dataTransfer.types.includes("Files")) {
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
    if (busy !== null) {
      setNotice("Wait for the current evidence action to finish before adding images.");
      return;
    }
    selectFiles(role, event.dataTransfer.files);
  }

  async function uploadRole(role: CatalogImageRole) {
    const pending = files.filter((file) => file.role === role && file.status !== "uploaded");
    if (pending.length === 0) return;
    if (pending.some((entry) => !entry.file)) {
      setNotice("A restored local file must be selected again before it can be uploaded.");
      return;
    }
    setBusy(`upload:${role}`);
    setNotice(null);
    let working = files;
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
      setNotice("Uploaded files remain pending and create no catalog records until Save draft.");
    } catch (error) {
      const pendingIds = new Set(pending.map((entry) => entry.clientId));
      onChange(working.map((file) => pendingIds.has(file.clientId) && file.status !== "uploaded"
        ? { ...file, status: "failed", error: message(error) }
        : file));
      setNotice(message(error));
    } finally {
      setBusy(null);
    }
  }

  function uploadedHandles(role: CatalogImageRole) {
    return files
      .filter((file) => file.role === role && file.status === "uploaded" && file.uploadHandle)
      .map((file) => file.uploadHandle!);
  }

  async function analyze(role: CatalogImageRole) {
    const handles = uploadedHandles(role);
    if (handles.length === 0) return;
    setBusy(`analyze:${role}`);
    setNotice(null);
    try {
      if (role === "front_label") onFrontCandidate(await getFrontLabelTemplate(handles));
      if (role === "supplement_facts") onFormulaCandidate((await getOcrTemplate(handles)).candidate);
      if (role === "barcode") onBarcodeCandidate(await decodeBarcodeImage(handles[0]));
      setNotice(`${roleCopy[role].title} analysis is ready for review. No catalog data was written.`);
    } catch (error) {
      setNotice(message(error));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="rounded-[8px] border border-white/10 bg-[#0D1117] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Private evidence</p>
          <h2 className="mt-1 font-headline text-xl font-bold">Role-specific source images</h2>
        </div>
        <p className="max-w-xl text-xs leading-5 text-text-muted">Originals upload directly with opaque handles. Order is retained inside each role; permanent storage identifiers never enter browser state.</p>
      </div>
      {notice ? <p role="status" className="mt-3 rounded border border-white/10 bg-[#080D12] p-3 text-sm text-text-secondary">{notice}</p> : null}
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        {(Object.keys(roleCopy) as CatalogImageRole[]).map((role) => {
          const roleFiles = files.filter((file) => file.role === role);
          const handles = uploadedHandles(role);
          return (
            <div key={role} className="rounded-[8px] border border-white/10 bg-[#080D12] p-3">
              <h3 className="font-semibold">{roleCopy[role].title}</h3>
              <p className="mt-1 min-h-10 text-xs leading-5 text-text-muted">{roleCopy[role].detail}</p>
              <label
                onDragEnter={(event) => dragFiles(event, role)}
                onDragOver={(event) => dragFiles(event, role)}
                onDragLeave={(event) => leaveDropZone(event, role)}
                onDrop={(event) => dropFiles(event, role)}
                className={`mt-3 block cursor-pointer rounded border border-dashed px-3 py-4 text-center text-xs font-semibold transition ${draggingRole === role ? "border-accent bg-accent/10 text-accent" : "border-white/20 text-text-secondary hover:border-accent/60 hover:text-accent"}`}
              >
                <span className="block">Add image{role === "supplement_facts" ? "s (max 4)" : "s"}</span>
                <span className="mt-1 block font-normal text-text-muted">Drag and drop here, or click to browse</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
                  multiple
                  disabled={busy !== null}
                  className="sr-only"
                  onChange={(event) => {
                    selectFiles(role, event.target.files);
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
                        <button type="button" disabled={busy !== null} aria-label="Move image earlier" onClick={() => onChange(moveEvidenceFile(files, file.clientId, -1))} className="rounded border border-white/10 px-2 py-1 disabled:opacity-40">↑</button>
                        <button type="button" disabled={busy !== null} aria-label="Move image later" onClick={() => onChange(moveEvidenceFile(files, file.clientId, 1))} className="rounded border border-white/10 px-2 py-1 disabled:opacity-40">↓</button>
                        <button type="button" disabled={busy !== null} aria-label="Remove image" onClick={() => onChange(files.filter((entry) => entry.clientId !== file.clientId))} className="rounded border border-white/10 px-2 py-1 text-error disabled:opacity-40">×</button>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={roleFiles.length === 0 || busy !== null}
                  onClick={() => void uploadRole(role)}
                  className="rounded-full border border-white/15 px-3 py-2 text-xs font-semibold disabled:opacity-40"
                >
                  {busy === `upload:${role}` ? "Uploading…" : "Upload pending"}
                </button>
                <button
                  type="button"
                  disabled={handles.length === 0 || busy !== null || (role === "barcode" && handles.length !== 1)}
                  onClick={() => void analyze(role)}
                  className="rounded-full bg-accent px-3 py-2 text-xs font-bold text-[#03100E] disabled:opacity-40"
                >
                  {busy === `analyze:${role}` ? "Analyzing…" : role === "barcode" ? "Decode bars" : "Analyze source"}
                </button>
              </div>
              {role === "barcode" && handles.length > 1 ? <p className="mt-2 text-xs text-warning">Keep exactly one uploaded barcode image for decoding.</p> : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
