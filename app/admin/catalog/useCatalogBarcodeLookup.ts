"use client";

import { useEffect, useState } from "react";
import { lookupCatalogBarcode } from "./catalog-api";
import { barcodeValidation, type BarcodeDraft } from "./catalog-intake";
import type { CatalogBarcodeLookupResponse } from "./contracts.generated";

export default function useCatalogBarcodeLookup(barcode: BarcodeDraft, enabled = true) {
  const key = JSON.stringify([barcode.value.trim(), barcode.format]);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ key: string; result: CatalogBarcodeLookupResponse | null; error: string | null }>({ key: "", result: null, error: null });
  const valid = enabled && !barcodeValidation(barcode.value, barcode.format);
  useEffect(() => {
    if (!valid) return;
    let cancelled = false;
    setState({ key, result: null, error: null });
    const timer = setTimeout(async () => {
      try {
        const result = await lookupCatalogBarcode({ value: barcode.value.trim(), format: barcode.format, packageSize: null });
        if (!cancelled) setState({ key, result, error: null });
      } catch (error) {
        if (!cancelled) setState({ key, result: null, error: error instanceof Error ? error.message : "Barcode check failed." });
      }
    }, 350);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [key, attempt, valid, barcode.value, barcode.format]);
  const current = valid && state.key === key;
  return {
    result: current ? state.result : null,
    error: current ? state.error : null,
    checking: valid && (!current || (!state.result && !state.error)),
    retry: () => { setState({ key: "", result: null, error: null }); setAttempt((value) => value + 1); },
  };
}
