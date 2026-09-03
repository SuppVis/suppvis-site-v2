import type {
  CatalogImageRole,
  CatalogImageSetInput,
  CatalogUploadMimeType,
} from "./contracts.generated";

export type CatalogEvidenceStatus = "local" | "hashing" | "requesting" | "uploading" | "uploaded" | "failed";

export type CatalogEvidenceFile = {
  clientId: string;
  role: CatalogImageRole;
  fileName: string;
  mimeType: CatalogUploadMimeType;
  byteSize: number;
  sha256: string | null;
  uploadHandle: string | null;
  expiresAt: string | null;
  status: CatalogEvidenceStatus;
  error: string | null;
  file?: File;
};

export const CATALOG_MAX_IMAGE_BYTES = 20 * 1024 * 1024;
export const CATALOG_MAX_WORKFLOW_BYTES = 100 * 1024 * 1024;
export const CATALOG_MAX_WORKFLOW_IMAGES = 12;

export const catalogRoleLimits: Record<CatalogImageRole, number> = {
  front_label: 1,
  supplement_facts: 4,
  barcode: 1,
};

const allowedMimeTypes = new Set<CatalogUploadMimeType>([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export function catalogMimeType(file: Pick<File, "name" | "type">): CatalogUploadMimeType | null {
  const declared = file.type.toLowerCase();
  if (allowedMimeTypes.has(declared as CatalogUploadMimeType)) {
    return declared as CatalogUploadMimeType;
  }
  const extension = file.name.toLowerCase().split(".").pop();
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  if (extension === "heic") return "image/heic";
  if (extension === "heif") return "image/heif";
  return null;
}

export function validateEvidenceAddition(
  existing: CatalogEvidenceFile[],
  role: CatalogImageRole,
  files: File[],
) {
  const retainedExisting = catalogRoleLimits[role] === 1
    ? existing.filter((entry) => entry.role !== role)
    : existing;
  if (retainedExisting.length + files.length > CATALOG_MAX_WORKFLOW_IMAGES) {
    return `A product workflow accepts at most ${CATALOG_MAX_WORKFLOW_IMAGES} images.`;
  }
  if (retainedExisting.filter((entry) => entry.role === role).length + files.length > catalogRoleLimits[role]) {
    return role === "supplement_facts"
      ? "Supplement Facts accepts one to four ordered images."
      : `${role === "front_label" ? "Front label" : "Barcode"} accepts one image. Choose a single replacement image.`;
  }
  if (files.some((file) => file.size <= 0 || file.size > CATALOG_MAX_IMAGE_BYTES)) {
    return "Every image must be non-empty and no larger than 20 MiB.";
  }
  if (files.some((file) => !catalogMimeType(file))) {
    return "Images must be JPEG, PNG, WebP, HEIC, or HEIF.";
  }
  const total = retainedExisting.reduce((sum, file) => sum + file.byteSize, 0)
    + files.reduce((sum, file) => sum + file.size, 0);
  if (total > CATALOG_MAX_WORKFLOW_BYTES) return "One product workflow accepts at most 100 MiB of images.";
  return null;
}

export function addEvidenceFiles(
  existing: CatalogEvidenceFile[],
  role: CatalogImageRole,
  files: File[],
): CatalogEvidenceFile[] {
  const issue = validateEvidenceAddition(existing, role, files);
  if (issue) throw new Error(issue);
  const retainedExisting = catalogRoleLimits[role] === 1
    ? existing.filter((entry) => entry.role !== role)
    : existing;
  return [
    ...retainedExisting,
    ...files.map((file): CatalogEvidenceFile => ({
      clientId: crypto.randomUUID(),
      role,
      fileName: file.name,
      mimeType: catalogMimeType(file)!,
      byteSize: file.size,
      sha256: null,
      uploadHandle: null,
      expiresAt: null,
      status: "local",
      error: null,
      file,
    })),
  ];
}

export function moveEvidenceFile(
  existing: CatalogEvidenceFile[],
  clientId: string,
  direction: -1 | 1,
) {
  const index = existing.findIndex((file) => file.clientId === clientId);
  if (index < 0) return existing;
  const role = existing[index].role;
  const roleIndexes = existing.flatMap((file, fileIndex) => file.role === role ? [fileIndex] : []);
  const rolePosition = roleIndexes.indexOf(index);
  const target = roleIndexes[rolePosition + direction];
  if (target === undefined) return existing;
  const next = [...existing];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function serializableEvidence(files: CatalogEvidenceFile[]) {
  return files
    .map((file): CatalogEvidenceFile => ({
      clientId: file.clientId,
      role: file.role,
      fileName: file.fileName,
      mimeType: file.mimeType,
      byteSize: file.byteSize,
      sha256: file.sha256,
      uploadHandle: file.uploadHandle,
      expiresAt: file.expiresAt,
      status: file.status === "uploaded" && file.uploadHandle ? "uploaded" : "failed",
      error: file.status === "uploaded" && file.uploadHandle
        ? file.error
        : "The local file must be reselected after reload. Remove this entry and add the image again.",
    }));
}

export function evidenceImageSets(
  files: CatalogEvidenceFile[],
  action: "append" | "replace_current",
  barcodeId?: string | null,
): CatalogImageSetInput[] {
  const roles: CatalogImageRole[] = ["front_label", "supplement_facts", "barcode"];
  return roles.flatMap((role) => {
    const uploadHandles = files
      .filter((file) => file.role === role && file.status === "uploaded" && file.uploadHandle)
      .map((file) => file.uploadHandle!);
    if (uploadHandles.length === 0) return [];
    return [{
      role,
      action,
      ...(role === "barcode" && barcodeId ? { barcodeId } : {}),
      uploadHandles,
    }];
  });
}

export function evidenceBlockers(files: CatalogEvidenceFile[]) {
  const blockers: string[] = [];
  if (files.some((file) => file.status !== "uploaded" || !file.uploadHandle)) {
    blockers.push("Upload or remove every selected evidence image before saving.");
  }
  if (files.some((file) => {
    if (!file.uploadHandle || !file.expiresAt) return false;
    const expiresAt = Date.parse(file.expiresAt);
    return Number.isFinite(expiresAt) && expiresAt <= Date.now();
  })) {
    blockers.push("Remove and reselect expired pending evidence before saving.");
  }
  return blockers;
}
