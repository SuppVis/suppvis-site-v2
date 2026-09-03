"use client";

import { useEffect, useRef, useState } from "react";
import { decodeBarcodeImage, getFrontLabelTemplate, getOcrTemplate, putCatalogUpload, requestCatalogUploads, sha256File } from "./catalog-api";
import type { CatalogEvidenceFile } from "./catalog-evidence";
import type { SourceState } from "./catalog-intake";
import type { CatalogBarcodeDecodeResponse, CatalogFormulaTemplateCandidate, CatalogFrontLabelTemplateResponse, CatalogImageRole } from "./contracts.generated";

const roles: CatalogImageRole[] = ["barcode", "front_label", "supplement_facts"];
type Activity = "uploading" | "analyzing" | null;
const message = (error: unknown) => error instanceof Error ? error.message : "The image request failed.";

export default function useCatalogEvidenceProcessing(options: {
  files: CatalogEvidenceFile[];
  onChange: (files: CatalogEvidenceFile[]) => void;
  onState?: (role: CatalogImageRole, state: SourceState) => void;
  onFrontCandidate: (candidate: CatalogFrontLabelTemplateResponse) => void;
  onFormulaCandidate: (candidate: CatalogFormulaTemplateCandidate) => void;
  onBarcodeCandidate: (candidate: CatalogBarcodeDecodeResponse) => void;
}) {
  const latest = useRef(options);
  latest.current = options;
  const files = useRef(options.files);
  files.current = options.files;
  const generations = useRef({ barcode: 0, front_label: 0, supplement_facts: 0 });
  const jobs = useRef<Partial<Record<CatalogImageRole, string>>>({});
  const uploading = useRef(new Set<CatalogImageRole>());
  const [activities, setActivities] = useState<Record<CatalogImageRole, Activity>>({ barcode: null, front_label: null, supplement_facts: null });
  const [notices, setNotices] = useState<Partial<Record<CatalogImageRole, string>>>({});

  useEffect(() => () => { for (const role of roles) generations.current[role]++; }, []);
  useEffect(() => {
    // A parent may open a different product or discard its files without remounting this panel.
    for (const role of roles) {
      const signature = JSON.stringify(files.current.filter((file) => file.role === role).map((file) => file.clientId));
      if (jobs.current[role] && jobs.current[role] !== signature) {
        generations.current[role]++;
        delete jobs.current[role];
        uploading.current.delete(role);
        setActivities((current) => ({ ...current, [role]: null }));
      }
    }
  }, [options.files]);

  function changeRole(role: CatalogImageRole, next: CatalogEvidenceFile[]) {
    // A completion in one column must never replace another column's newer files.
    files.current = [...files.current.filter((file) => file.role !== role), ...next.filter((file) => file.role === role)];
    latest.current.onChange(files.current);
  }
  function notify(role: CatalogImageRole, text: string) { setNotices((current) => ({ ...current, [role]: text })); }
  function cancel(role: CatalogImageRole) {
    generations.current[role]++;
    delete jobs.current[role];
    uploading.current.delete(role);
    setActivities((current) => ({ ...current, [role]: null }));
    notify(role, "");
  }
  async function process(role: CatalogImageRole, sourceFiles = files.current) {
    if (uploading.current.has(role)) return;
    const token = ++generations.current[role];
    let working = sourceFiles.filter((file) => file.role === role);
    const signature = JSON.stringify(working.map((file) => file.clientId));
    jobs.current[role] = signature;
    const active = () => token === generations.current[role]
      && signature === JSON.stringify(files.current.filter((file) => file.role === role).map((file) => file.clientId));
    const pending = working.filter((file) => file.status !== "uploaded");
    const publish = () => { if (active()) changeRole(role, working); };
    if (!working.length) return;
    notify(role, "");
    try {
      if (pending.length) {
        if (pending.some((file) => !file.file)) throw new Error("A restored local file must be selected again before it can be uploaded.");
        uploading.current.add(role);
        setActivities((current) => ({ ...current, [role]: "uploading" }));
        latest.current.onState?.(role, "uploading");
        const descriptors = [];
        for (const entry of pending) {
          working = working.map((file) => file.clientId === entry.clientId ? { ...file, status: "hashing", error: null } : file);
          publish();
          const sha256 = await sha256File(entry.file!);
          if (!active()) return;
          working = working.map((file) => file.clientId === entry.clientId ? { ...file, sha256, status: "requesting" } : file);
          publish();
          descriptors.push({ clientId: entry.clientId, role, originalFilename: entry.fileName, mimeType: entry.mimeType, byteSize: entry.byteSize, sha256 });
        }
        const response = await requestCatalogUploads({ files: descriptors });
        if (!active()) return;
        const uploads = new Map(response.uploads.map((upload) => [upload.clientId, upload]));
        for (const entry of pending) {
          const upload = uploads.get(entry.clientId);
          try {
            if (!upload) throw new Error("No scoped upload was returned.");
            working = working.map((file) => file.clientId === entry.clientId ? { ...file, status: "uploading", error: null } : file);
            publish();
            await putCatalogUpload(entry.file!, upload);
            if (!active()) return;
            working = working.map((file) => file.clientId === entry.clientId ? { ...file, status: "uploaded", uploadHandle: upload.uploadHandle, expiresAt: upload.expiresAt, error: null } : file);
          } catch (error) {
            if (!active()) return;
            working = working.map((file) => file.clientId === entry.clientId ? { ...file, status: "failed", error: message(error) } : file);
          }
          publish();
        }
        if (working.some((file) => file.status !== "uploaded")) throw new Error("The upload did not finish. Remove or replace the failed image to retry.");
      }
      // Adding/reordering more panels during OCR starts a newer analysis of the full ordered set.
      uploading.current.delete(role);
      const handles = working.map((file) => file.uploadHandle).filter((handle): handle is string => !!handle);
      if (handles.length !== working.length) throw new Error("Reselect images with missing upload handles.");
      setActivities((current) => ({ ...current, [role]: "analyzing" }));
      latest.current.onState?.(role, "analyzing");
      if (role === "front_label") {
        const candidate = await getFrontLabelTemplate(handles);
        if (!active()) return;
        latest.current.onFrontCandidate(candidate);
      } else if (role === "supplement_facts") {
        const { candidate } = await getOcrTemplate(handles);
        if (!active()) return;
        latest.current.onFormulaCandidate(candidate);
      } else {
        const decoded = await decodeBarcodeImage(handles[0]);
        if (!active()) return;
        latest.current.onBarcodeCandidate(decoded);
        if (decoded.status === "manual_required") throw new Error(`Barcode could not be decoded: ${decoded.reason.replaceAll("_", " ")}. Retry, replace, type the digits, or explicitly skip.`);
      }
      latest.current.onState?.(role, "ready");
      notify(role, "Analysis complete. Nothing is saved to the catalog until Save draft.");
    } catch (error) {
      if (!active()) return;
      working = working.map((file) => file.status !== "uploaded" ? { ...file, status: "failed", error: message(error) } : file);
      publish();
      latest.current.onState?.(role, "analysis_failed");
      notify(role, message(error));
    } finally {
      if (active()) {
        delete jobs.current[role];
        uploading.current.delete(role);
        setActivities((current) => ({ ...current, [role]: null }));
      }
    }
  }
  return { files, activities, notices, uploading, changeRole, cancel, process, notify };
}
