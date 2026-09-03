"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { barcodeValidation, type BarcodeDraft } from "./catalog-intake";
import type { CatalogBarcodeFormat } from "./contracts.generated";
import CatalogBarcodeFormatHelp from "./CatalogBarcodeFormatHelp";

const inputClass = "mt-1 w-full rounded border border-white/15 bg-[#080D12] px-3 py-2 text-sm";
const formats: [CatalogBarcodeFormat, string, string][] = [
  ["upc_a", "UPC-A", "12 digits, common on US/Canadian retail products — 012345678905"],
  ["upc_e", "UPC-E", "8 digits, compressed UPC for small packages — 01234505"],
  ["ean_8", "EAN-8", "8 digits, compact international retail code — 96385074"],
  ["ean_13", "EAN-13", "13 digits, common internationally — 4006381333931"],
  ["gtin_14", "GTIN-14", "14 digits, often used for cases/packaging levels — 00012345678905"],
];

export function LocalSourceImage({ file, alt }: { file?: File; alt: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
    if (!file) { setUrl(null); return; }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  if (!url) return null;
  return <div className="mt-2">
    <Image src={url} alt={alt} width={960} height={640} unoptimized onError={() => setFailed(true)} className="max-h-72 w-full rounded border border-white/10 bg-white object-contain" />
    {failed ? <p className="text-xs text-warning">This browser cannot display this image. Use a JPEG/PNG replacement to compare it on screen, or compare against the physical package.</p> : null}
  </div>;
}

export function PackageFields({ value, onChange }: { value: BarcodeDraft; onChange: (patch: Partial<BarcodeDraft>) => void }) {
  return <div className="mt-3 grid gap-3 sm:grid-cols-3">
    <label className="text-xs">Package label (optional)<input aria-label="Package label" value={value.packageLabel} onChange={(e) => onChange({ packageLabel: e.target.value })} className={inputClass} placeholder="60 capsules" /></label>
    <label className="text-xs">Package amount<input aria-label="Package amount" value={value.packageAmount} onChange={(e) => onChange({ packageAmount: e.target.value })} className={inputClass} /></label>
    <label className="text-xs">Package unit<input aria-label="Package unit" value={value.packageUnit} onChange={(e) => onChange({ packageUnit: e.target.value })} className={inputClass} placeholder="capsules" /></label>
  </div>;
}

export default function CatalogBarcodeFields({ value, onChange, file, lookupMessage, retry, lookupFailed }: {
  value: BarcodeDraft;
  onChange: (patch: Partial<BarcodeDraft>) => void;
  file?: File;
  lookupMessage: string;
  retry: () => void;
  lookupFailed: boolean;
}) {
  const invalid = barcodeValidation(value.value, value.format);
  return <div className="space-y-3 border-t border-white/10 pt-3">
    <label className="block text-xs">Printed/decoded digits<input aria-label="Printed/decoded digits" inputMode="numeric" value={value.value} onChange={(e) => onChange({ value: e.target.value })} className={inputClass} /></label>
    <LocalSourceImage file={file} alt="Uploaded barcode label for digit verification" />
    {!file ? <p className="text-xs text-text-muted">No comparison image supplied. Confirm the digits against the physical package.</p> : null}
    <div className="text-xs">
      <label htmlFor="intake-barcode-format">Barcode format</label>{" "}
      <CatalogBarcodeFormatHelp>{formats.map(([, name, description]) => <span className="mb-2 block last:mb-0" key={name}><strong>{name}:</strong> {description}</span>)}</CatalogBarcodeFormatHelp>
      <select id="intake-barcode-format" value={value.format} onChange={(e) => onChange({ format: e.target.value as CatalogBarcodeFormat })} className={inputClass}>{formats.map(([format, name]) => <option key={format} value={format}>{name}</option>)}</select>
    </div>
    {invalid && value.value ? <p className="text-xs text-warning">{invalid}</p> : null}
    <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={value.confirmed} disabled={!!invalid} onChange={(e) => onChange({ confirmed: e.target.checked })} />I confirmed the digits against the package</label>
    <p role="status" className="text-xs text-text-secondary">{lookupMessage}</p>
    {lookupFailed ? <button type="button" onClick={retry} className="rounded border border-white/20 px-2 py-1 text-xs">Retry failed barcode check</button> : null}
  </div>;
}
