"use client";

import { useEffect, useRef, useState } from "react";
import { searchCatalogProducts } from "./catalog-api";
import { identityKey } from "./catalog-intake";
import type { CatalogProductBrowserSummaryDto } from "./contracts.generated";

type Result = { results: CatalogProductBrowserSummaryDto[]; nextCursor: string | null };
type State = { signature: string; result: Result | null; error: string | null; loading: boolean };

export default function useCatalogIdentityLookup(label: string, brand: string, enabled: boolean) {
  const exactLabelName = label.trim();
  const exactBrandName = brand.trim();
  const signature = JSON.stringify([exactLabelName, exactBrandName]);
  const valid = enabled && !!exactLabelName && !!exactBrandName;
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<State>({ signature: "", result: null, error: null, loading: false });
  const generationRef = useRef({ value: 0 });
  const generation = generationRef.current;
  const pagePending = useRef(false);

  useEffect(() => {
    const token = ++generation.value;
    pagePending.current = false;
    if (!valid) return;
    setState({ signature, result: null, error: null, loading: true });
    const timer = setTimeout(async () => {
      try {
        const result = await searchCatalogProducts({ exactLabelName, exactBrandName, status: "all", limit: 30 });
        if (result.results.some((product) => identityKey(product.labelName, product.brandName) !== identityKey(exactLabelName, exactBrandName))) {
          throw new Error("The identity check returned unexpected results. Retry before continuing.");
        }
        if (token === generation.value) setState({ signature, result, error: null, loading: false });
      } catch (error) {
        if (token === generation.value) setState({ signature, result: null, error: error instanceof Error ? error.message : "Product check failed.", loading: false });
      }
    }, 350);
    return () => { clearTimeout(timer); generation.value++; };
  }, [signature, exactLabelName, exactBrandName, valid, attempt, generation]);

  const current = valid && state.signature === signature;
  async function loadMore() {
    if (!current || !state.result?.nextCursor || state.loading || pagePending.current) return;
    pagePending.current = true;
    const token = generation.value;
    setState((previous) => ({ ...previous, loading: true, error: null }));
    try {
      const result = await searchCatalogProducts({ exactLabelName, exactBrandName, status: "all", limit: 30, cursor: state.result.nextCursor });
      if (result.results.some((product) => identityKey(product.labelName, product.brandName) !== identityKey(exactLabelName, exactBrandName))) throw new Error("The identity check returned unexpected results. Retry before continuing.");
      if (token === generation.value) setState((previous) => ({ signature, loading: false, error: null, result: {
        results: [...new Map([...(previous.result?.results ?? []), ...result.results].map((product) => [product.id, product])).values()],
        nextCursor: result.nextCursor,
      } }));
    } catch (error) {
      if (token === generation.value) setState((previous) => ({ ...previous, loading: false, error: error instanceof Error ? error.message : "Product check failed." }));
    } finally { if (token === generation.value) pagePending.current = false; }
  }
  return {
    result: current ? state.result : null,
    error: current ? state.error : null,
    checking: valid && (!current || state.loading),
    retry: () => { generation.value++; setState({ signature: "", result: null, error: null, loading: false }); setAttempt((value) => value + 1); },
    loadMore,
  };
}
