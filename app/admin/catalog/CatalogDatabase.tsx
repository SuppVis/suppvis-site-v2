"use client";

/* eslint-disable @next/next/no-img-element -- private presigned origins are runtime-only */

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type SyntheticEvent,
} from "react";
import {
  getCatalogImageAccess,
  getCatalogProduct,
  searchCatalogProducts,
} from "./catalog-api";
import {
  canOpenCatalogWorkspace,
  catalogDatabaseHasActiveFilters,
  catalogDatabaseStateFromParams,
  catalogDatabaseUrlParams,
  catalogEvidenceSummary,
  catalogPrimaryIdentity,
  defaultCatalogDatabaseFilters,
  nextCatalogDatabaseSort,
  type CatalogDatabaseFilters,
  type CatalogDatabaseSort,
  type CatalogDatabaseSortKey,
} from "./catalog-database";
import type {
  CatalogComponentDto,
  CatalogProductBrowserSummaryDto,
  CatalogProductDetailDto,
  CatalogProductImageDto,
  CatalogProductStatus,
} from "./contracts.generated";

type DetailLoadState =
  | { state: "loading" }
  | { state: "ready"; product: CatalogProductDetailDto }
  | { state: "error"; message: string };

type ImageAccessState =
  | { state: "loading" }
  | { state: "ready"; url: string; expiresAt: string }
  | { state: "error"; message: string };

const statusClasses: Record<CatalogProductStatus, string> = {
  draft: "border-warning/30 bg-warning/5 text-warning",
  published: "border-accent/30 bg-accent/5 text-accent",
  retired: "border-white/15 bg-white/5 text-text-muted",
};

function titleCase(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatBytes(value: number) {
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KiB`;
  return `${(value / 1024 / 1024).toFixed(1)} MiB`;
}

function packageDescription(product: CatalogProductDetailDto["barcodes"][number]) {
  return product.packageSize
    ? `${product.packageSize.labelText} (${product.packageSize.amount} ${product.packageSize.unit})`
    : "No package size recorded";
}

function doseGuidanceDescription(product: CatalogProductDetailDto) {
  const guidance = product.labelDoseGuidance;
  if (guidance.state === "none") return "None on label";
  if (guidance.state === "unmappable") return `${guidance.labelText} (not mapped)`;
  return `${guidance.labelText} → ${guidance.mappedAmount} ${guidance.mappedUnit}`;
}

function timingGuidanceDescription(product: CatalogProductDetailDto) {
  const guidance = product.labelTimingGuidance;
  if (guidance.state === "none") return "None on label";
  if (guidance.state === "unmappable") return `${guidance.labelText} (not mapped)`;
  return `${guidance.labelText} → ${titleCase(guidance.mappedTiming)}`;
}

function DetailItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded border border-white/10 bg-[#080D12] p-3">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">{label}</dt>
      <dd className="mt-1 break-words text-sm text-text-secondary">{value ?? "—"}</dd>
    </div>
  );
}

function SortableHeader({
  column,
  label,
  sort,
  onSort,
  align = "left",
}: {
  column: CatalogDatabaseSortKey;
  label: string;
  sort: CatalogDatabaseSort;
  onSort: (column: CatalogDatabaseSortKey) => void;
  align?: "left" | "right";
}) {
  const activeDirection = sort?.key === column ? sort.direction : null;
  const nextState = activeDirection === "ascending"
    ? "descending"
    : activeDirection === "descending" ? "original order" : "ascending";
  return (
    <th scope="col" aria-sort={activeDirection ?? "none"} className="px-2 py-1">
      <button
        type="button"
        onClick={() => onSort(column)}
        title={`Sort ${label} ${nextState}`}
        className={`flex w-full items-center gap-2 rounded px-2 py-2 text-left transition hover:bg-white/5 hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${align === "right" ? "justify-end text-right" : "justify-start"}`}
      >
        <span>{label}</span>
        <span aria-hidden="true" className={activeDirection ? "text-accent" : "text-text-muted/60"}>
          {activeDirection === "ascending" ? "▲" : activeDirection === "descending" ? "▼" : "↕"}
        </span>
        <span className="sr-only">Activate to sort {nextState}</span>
      </button>
    </th>
  );
}

const databaseFilterClass = "mt-1 w-full rounded border border-white/15 bg-[#080D12] px-3 py-2 text-sm text-text-primary outline-none transition focus:border-accent";

function ActiveFilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/5 px-3 py-1.5 text-xs font-semibold text-accent hover:border-accent/60"
      aria-label={`Remove filter: ${label}`}
    >
      <span>{label}</span>
      <span aria-hidden="true">×</span>
    </button>
  );
}

function ComponentRow({ component }: { component: CatalogComponentDto }) {
  if (component.componentType === "proprietary_blend") {
    return (
      <li className="rounded border border-white/10 bg-[#080D12] p-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">Proprietary blend</span>
            <p className="mt-1 font-semibold">{component.labelName}</p>
            <p className="mt-1 break-all font-mono text-[10px] text-text-muted">ID {component.id} · order {component.sortOrder}</p>
          </div>
          <span className="text-sm text-text-secondary">{component.amountText}</span>
        </div>
        <ol className="mt-3 space-y-2 border-l border-white/15 pl-4">
          {component.children.map((child) => <ComponentRow key={child.id} component={child} />)}
        </ol>
      </li>
    );
  }
  return (
    <li className="rounded border border-white/10 bg-[#080D12] p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{component.labelName}</p>
          <p className="mt-1 text-xs text-text-muted">
            {component.libraryStatus === "matched"
              ? `Matched: ${component.canonicalKey}`
              : "Not in research library"}
          </p>
          <p className="mt-1 break-all font-mono text-[10px] text-text-muted">ID {component.id} · order {component.sortOrder}</p>
        </div>
        <span className="text-sm text-text-secondary">{component.amountText ?? "Amount not disclosed"}</span>
      </div>
    </li>
  );
}

function EvidenceImage({
  image,
  access,
  barcodeLabel,
}: {
  image: CatalogProductImageDto;
  access?: ImageAccessState;
  barcodeLabel?: string;
}) {
  return (
    <article className="overflow-hidden rounded border border-white/10 bg-[#080D12]">
      <div className="flex min-h-44 items-center justify-center bg-black/20 p-2">
        {access?.state === "ready" ? (
          <img
            src={access.url}
            alt={`${titleCase(image.role)} evidence: ${image.originalFilename}`}
            className="max-h-64 w-full object-contain"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : access?.state === "error" ? (
          <p className="px-4 text-center text-xs text-error">{access.message}</p>
        ) : (
          <p className="text-xs text-text-muted">Loading private image…</p>
        )}
      </div>
      <div className="space-y-1 border-t border-white/10 p-3 text-xs text-text-muted">
        <p className="truncate font-semibold text-text-secondary" title={image.originalFilename}>{image.originalFilename}</p>
        <p>{titleCase(image.role)} · #{image.sortOrder + 1} · {formatBytes(image.byteSize)}</p>
        {barcodeLabel ? <p>Barcode {barcodeLabel}</p> : null}
        <p>{image.widthPx && image.heightPx ? `${image.widthPx} × ${image.heightPx}` : "Dimensions unavailable"}</p>
        <p>{image.isCurrent ? "Current evidence" : `Superseded ${formatDate(image.supersededAt)}`}</p>
        <p>Added by {image.createdByEmail} · {formatDate(image.createdAt)}</p>
        <p className="break-all font-mono text-[10px]">Image ID {image.id}</p>
        <p className="break-all font-mono text-[10px]">Evidence set {image.evidenceSetId}</p>
        <p className="break-all font-mono text-[10px]">SHA-256 {image.sha256}</p>
      </div>
    </article>
  );
}

function CatalogDatabaseDetails({ product }: { product: CatalogProductDetailDto }) {
  const [imagesExpanded, setImagesExpanded] = useState(false);
  const [imageAccess, setImageAccess] = useState<Record<string, ImageAccessState>>({});

  const loadImages = useCallback(async (force = false) => {
    const now = Date.now();
    const targets = product.images.filter((image) => {
      const current = imageAccess[image.id];
      if (force || !current) return true;
      return current.state === "error"
        || (current.state === "ready" && Date.parse(current.expiresAt) <= now + 5_000);
    });
    if (targets.length === 0) return;
    setImageAccess((current) => {
      const next = { ...current };
      targets.forEach((image) => { next[image.id] = { state: "loading" }; });
      return next;
    });
    const resolved = await Promise.all(targets.map(async (image) => {
      try {
        const access = await getCatalogImageAccess(image.id);
        return [image.id, { state: "ready", ...access }] as const;
      } catch (error) {
        return [image.id, {
          state: "error",
          message: error instanceof Error ? error.message : "Private evidence could not be loaded.",
        }] as const;
      }
    }));
    setImageAccess((current) => ({ ...current, ...Object.fromEntries(resolved) }));
  }, [imageAccess, product.images]);

  function onImagesToggle(event: SyntheticEvent<HTMLDetailsElement>) {
    const open = event.currentTarget.open;
    setImagesExpanded(open);
    if (open) void loadImages();
  }

  return (
    <div className="space-y-3 p-4 lg:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-text-muted">Product ID</p>
          <p className="mt-1 break-all font-mono text-xs text-text-secondary">{product.id}</p>
        </div>
        {canOpenCatalogWorkspace(product) ? (
          <Link
            href={`/admin/catalog?view=workspace&product=${encodeURIComponent(product.id)}`}
            className="rounded-full bg-accent px-4 py-2 text-xs font-bold text-[#03100E]"
          >
            Open in workspace
          </Link>
        ) : (
          <span className="rounded-full border border-white/15 px-3 py-2 text-xs text-text-muted">
            {titleCase(product.status)} records are read-only
          </span>
        )}
      </div>

      <details className="rounded border border-white/10 bg-[#0D1117]">
        <summary className="cursor-pointer px-4 py-3 font-semibold">Product-level details</summary>
        <div className="border-t border-white/10 p-4">
          <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <DetailItem label="Label name" value={product.labelName} />
            <DetailItem label="Brand" value={product.brandName} />
            <DetailItem label="Status" value={titleCase(product.status)} />
            <DetailItem label="Formula type" value={titleCase(product.productType)} />
            <DetailItem label="Physical form" value={product.physicalForm} />
            <DetailItem label="Variant" value={product.variant ?? "None"} />
            <DetailItem label="Market" value={product.marketRegion} />
            <DetailItem label="Primary identity" value={product.primaryCanonicalKey ?? (product.productType === "blend" ? "Multiple ingredients" : "Not in research library")} />
            <DetailItem label="Serving size" value={`${product.servingSize.labelText} (${product.servingSize.amount} ${product.servingSize.unit})`} />
            <DetailItem label="Revision" value={product.revision} />
            <DetailItem label="Created" value={formatDate(product.createdAt)} />
            <DetailItem label="Updated" value={formatDate(product.updatedAt)} />
            <DetailItem label="Created by" value={product.createdByEmail} />
            <DetailItem label="Updated by" value={product.updatedByEmail} />
            <DetailItem label="Published" value={product.publishedAt ? `${formatDate(product.publishedAt)} by ${product.publishedByEmail}` : "Not published"} />
            <DetailItem label="Retired" value={product.retiredAt ? `${formatDate(product.retiredAt)} by ${product.retiredByEmail}` : "Not retired"} />
            <DetailItem label="Dose guidance" value={doseGuidanceDescription(product)} />
            <DetailItem label="Timing guidance" value={timingGuidanceDescription(product)} />
            <DetailItem label="Entry method" value={titleCase(product.templateProvenance.entryMethod)} />
            <DetailItem label="Source record" value={product.templateProvenance.sourceRecordId ?? "None"} />
            <DetailItem label="Source retrieved" value={formatDate(product.templateProvenance.sourceRetrievedAt)} />
            <DetailItem label="Follow-up state" value={product.needsFollowUp ? "Needs review" : "Clear"} />
          </dl>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <DetailItem label="Admin notes" value={product.adminNotes ?? "None"} />
            <DetailItem label="Review reasons" value={product.followUpReasons.length > 0 ? product.followUpReasons.map(titleCase).join(", ") : "None"} />
          </div>
        </div>
      </details>

      <details className="rounded border border-white/10 bg-[#0D1117]">
        <summary className="cursor-pointer px-4 py-3 font-semibold">Barcodes ({product.barcodes.length})</summary>
        <div className="grid gap-3 border-t border-white/10 p-4 lg:grid-cols-2 xl:grid-cols-3">
          {product.barcodes.map((barcode) => (
            <article key={barcode.id} className="rounded border border-white/10 bg-[#080D12] p-3">
              <p className="font-mono text-base font-semibold">{barcode.labelBarcode}</p>
              <p className="mt-1 text-xs text-text-muted">{titleCase(barcode.format)} · GTIN-14 {barcode.gtin14}</p>
              <p className="mt-3 text-sm text-text-secondary">{packageDescription(barcode)}</p>
              <p className="mt-2 text-xs text-text-muted">Revision {barcode.revision} · updated {formatDate(barcode.updatedAt)}</p>
              <p className="mt-1 text-xs text-text-muted">Created {formatDate(barcode.createdAt)}</p>
              <p className="mt-2 break-all font-mono text-[10px] text-text-muted">ID {barcode.id}</p>
            </article>
          ))}
          {product.barcodes.length === 0 ? <p className="text-sm text-text-muted">No barcodes recorded.</p> : null}
        </div>
      </details>

      <details className="rounded border border-white/10 bg-[#0D1117]">
        <summary className="cursor-pointer px-4 py-3 font-semibold">Formula components ({product.activeLeafCount} active ingredients)</summary>
        <ol className="space-y-2 border-t border-white/10 p-4">
          {product.components.map((component) => <ComponentRow key={component.id} component={component} />)}
        </ol>
      </details>

      <details className="rounded border border-white/10 bg-[#0D1117]">
        <summary className="cursor-pointer px-4 py-3 font-semibold">Nutrition facts ({product.nutritionFacts.length})</summary>
        <div className="overflow-x-auto border-t border-white/10">
          {product.nutritionFacts.length > 0 ? (
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-[#080D12] text-xs uppercase tracking-[0.1em] text-text-muted">
                <tr><th className="px-4 py-3">Order</th><th className="px-4 py-3">Label</th><th className="px-4 py-3">Key</th><th className="px-4 py-3">Exact amount</th><th className="px-4 py-3">Parsed value</th><th className="px-4 py-3">Daily value</th><th className="px-4 py-3">Updated</th></tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {product.nutritionFacts.map((fact) => (
                  <tr key={fact.id}>
                    <td className="px-4 py-3 text-text-muted">{fact.sortOrder + 1}</td>
                    <td className="px-4 py-3 font-semibold">{fact.labelName}</td>
                    <td className="px-4 py-3 text-text-muted">{titleCase(fact.factKey)}</td>
                    <td className="px-4 py-3">{fact.amountText}</td>
                    <td className="px-4 py-3">{fact.amountValue} {fact.amountUnit}</td>
                    <td className="px-4 py-3">{fact.dailyValuePercent == null ? "—" : `${fact.dailyValuePercent}%`}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-text-muted" title={`Created ${formatDate(fact.createdAt)} · ID ${fact.id}`}>{formatDate(fact.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="p-4 text-sm text-text-muted">No nutrition facts recorded.</p>}
        </div>
      </details>

      <details className="rounded border border-white/10 bg-[#0D1117]" onToggle={onImagesToggle}>
        <summary className="cursor-pointer px-4 py-3 font-semibold">Evidence images ({product.images.length})</summary>
        {imagesExpanded ? (
          <div className="border-t border-white/10 p-4">
            {product.images.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {product.images.map((image) => <EvidenceImage
                  key={image.id}
                  image={image}
                  access={imageAccess[image.id]}
                  barcodeLabel={product.barcodes.find((barcode) => barcode.id === image.barcodeId)?.labelBarcode}
                />)}
              </div>
            ) : <p className="text-sm text-text-muted">No retained evidence.</p>}
            {Object.values(imageAccess).some((access) => access.state === "error") ? (
              <button type="button" onClick={() => void loadImages(true)} className="mt-4 rounded-full border border-white/15 px-3 py-2 text-xs font-semibold">
                Retry unavailable images
              </button>
            ) : null}
          </div>
        ) : null}
      </details>
    </div>
  );
}

export default function CatalogDatabase() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [{ filters: initialFilters, sort: initialSort }] = useState(() => (
    catalogDatabaseStateFromParams(new URLSearchParams(searchParams.toString()))
  ));
  const [products, setProducts] = useState<CatalogProductBrowserSummaryDto[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [details, setDetails] = useState<Record<string, DetailLoadState>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<CatalogDatabaseFilters>(initialFilters);
  const [debouncedQuery, setDebouncedQuery] = useState(initialFilters.query);
  const [sort, setSort] = useState<CatalogDatabaseSort>(initialSort);
  const requestSerial = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(filters.query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [filters.query]);

  useEffect(() => {
    const nextFilters = { ...filters, query: debouncedQuery };
    const nextParams = catalogDatabaseUrlParams(
      new URLSearchParams(searchParams.toString()),
      nextFilters,
      sort,
    );
    if (nextParams.toString() !== searchParams.toString()) {
      router.replace(`${pathname}?${nextParams.toString()}`, { scroll: false });
    }
  }, [debouncedQuery, filters, pathname, router, searchParams, sort]);

  const loadProducts = useCallback(async (cursor?: string, append = false) => {
    const serial = ++requestSerial.current;
    setLoading(true);
    setError(null);
    try {
      const response = await searchCatalogProducts({
        q: debouncedQuery || undefined,
        status: filters.status,
        productType: filters.productType === "all" ? undefined : filters.productType,
        needsFollowUp: filters.review === "all" ? undefined : filters.review === "needs-review",
        evidence: filters.evidence === "all" ? undefined : filters.evidence,
        sortBy: sort?.key,
        sortDirection: sort?.direction,
        cursor,
        limit: 50,
      });
      if (serial !== requestSerial.current) return;
      setProducts((current) => {
        const combined = append ? [...current, ...response.results] : response.results;
        return [...new Map(combined.map((product) => [product.id, product])).values()];
      });
      setNextCursor(response.nextCursor);
    } catch (caught) {
      if (serial !== requestSerial.current) return;
      setError(caught instanceof Error ? caught.message : "The catalog database could not be loaded.");
    } finally {
      if (serial === requestSerial.current) setLoading(false);
    }
  }, [debouncedQuery, filters.evidence, filters.productType, filters.review, filters.status, sort]);

  useEffect(() => {
    setExpanded(new Set());
    setDetails({});
    void loadProducts();
  }, [loadProducts]);

  async function loadDetail(productId: string) {
    setDetails((current) => ({ ...current, [productId]: { state: "loading" } }));
    try {
      const product = await getCatalogProduct(productId);
      setDetails((current) => ({ ...current, [productId]: { state: "ready", product } }));
    } catch (caught) {
      setDetails((current) => ({
        ...current,
        [productId]: {
          state: "error",
          message: caught instanceof Error ? caught.message : "Product details could not be loaded.",
        },
      }));
    }
  }

  function toggleProduct(productId: string) {
    const willExpand = !expanded.has(productId);
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
    if (willExpand && !details[productId]) void loadDetail(productId);
  }

  function toggleSort(column: CatalogDatabaseSortKey) {
    setSort((current) => nextCatalogDatabaseSort(current, column));
  }

  function updateFilters(patch: Partial<CatalogDatabaseFilters>) {
    setFilters((current) => ({ ...current, ...patch }));
  }

  function clearQuery() {
    updateFilters({ query: "" });
    setDebouncedQuery("");
  }

  function clearFilters() {
    setFilters({ ...defaultCatalogDatabaseFilters });
    setDebouncedQuery("");
  }

  const hasActiveFilters = catalogDatabaseHasActiveFilters(filters);

  return (
    <section className="rounded-[8px] border border-white/10 bg-[#0D1117] shadow-2xl shadow-black/20">
      <div className="border-b border-white/10 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Ground truth</p>
        <h2 className="mt-1 font-headline text-2xl font-bold">Catalog database</h2>
        <p className="mt-2 text-sm text-text-secondary">Every lifecycle status is shown. Expand a product to inspect its complete read-only catalog record.</p>
      </div>

      <div className="border-b border-white/10 p-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(280px,2fr)_repeat(4,minmax(150px,1fr))_auto] xl:items-end">
          <label className="text-xs font-semibold uppercase tracking-[0.1em] text-text-muted">
            Search catalog
            <input
              type="search"
              value={filters.query}
              maxLength={160}
              onChange={(event) => updateFilters({ query: event.target.value })}
              className={databaseFilterClass}
              placeholder="Product, brand, identity, or barcode"
            />
          </label>
          <label className="text-xs font-semibold uppercase tracking-[0.1em] text-text-muted">
            Status
            <select value={filters.status} onChange={(event) => updateFilters({ status: event.target.value as CatalogDatabaseFilters["status"] })} className={databaseFilterClass}>
              <option value="all">All statuses</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="retired">Retired</option>
            </select>
          </label>
          <label className="text-xs font-semibold uppercase tracking-[0.1em] text-text-muted">
            Type
            <select value={filters.productType} onChange={(event) => updateFilters({ productType: event.target.value as CatalogDatabaseFilters["productType"] })} className={databaseFilterClass}>
              <option value="all">All types</option>
              <option value="supplement">Supplement</option>
              <option value="blend">Blend</option>
            </select>
          </label>
          <label className="text-xs font-semibold uppercase tracking-[0.1em] text-text-muted">
            Review
            <select value={filters.review} onChange={(event) => updateFilters({ review: event.target.value as CatalogDatabaseFilters["review"] })} className={databaseFilterClass}>
              <option value="all">All review states</option>
              <option value="needs-review">Needs review</option>
              <option value="clear">Clear</option>
            </select>
          </label>
          <label className="text-xs font-semibold uppercase tracking-[0.1em] text-text-muted">
            Evidence
            <select value={filters.evidence} onChange={(event) => updateFilters({ evidence: event.target.value as CatalogDatabaseFilters["evidence"] })} className={databaseFilterClass}>
              <option value="all">All evidence</option>
              <option value="present">Has evidence</option>
              <option value="missing">Missing evidence</option>
            </select>
          </label>
          <button
            type="button"
            disabled={!hasActiveFilters}
            onClick={clearFilters}
            className="rounded-full border border-white/15 px-4 py-2.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40"
          >
            Clear filters
          </button>
        </div>
        {hasActiveFilters ? (
          <div className="mt-4 flex flex-wrap items-center gap-2" aria-label="Active catalog filters">
            <span className="text-xs text-text-muted">Active:</span>
            {filters.query.trim() ? <ActiveFilterChip label={`Search: ${filters.query.trim()}`} onRemove={clearQuery} /> : null}
            {filters.status !== "all" ? <ActiveFilterChip label={`Status: ${titleCase(filters.status)}`} onRemove={() => updateFilters({ status: "all" })} /> : null}
            {filters.productType !== "all" ? <ActiveFilterChip label={`Type: ${titleCase(filters.productType)}`} onRemove={() => updateFilters({ productType: "all" })} /> : null}
            {filters.review !== "all" ? <ActiveFilterChip label={filters.review === "needs-review" ? "Needs review" : "Review clear"} onRemove={() => updateFilters({ review: "all" })} /> : null}
            {filters.evidence !== "all" ? <ActiveFilterChip label={filters.evidence === "present" ? "Has evidence" : "Missing evidence"} onRemove={() => updateFilters({ evidence: "all" })} /> : null}
          </div>
        ) : null}
      </div>

      {error ? (
        <div role="alert" className="m-5 rounded border border-error/30 bg-error/5 p-4 text-sm text-error">
          <p>{error}</p>
          <button type="button" disabled={loading} onClick={() => void loadProducts()} className="mt-3 rounded-full border border-error/40 px-3 py-2 text-xs font-semibold disabled:opacity-40">Retry</button>
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1360px] border-collapse text-left text-sm">
          <thead className="bg-[#080D12] text-[11px] uppercase tracking-[0.1em] text-text-muted">
            <tr>
              <SortableHeader column="product" label="Product" sort={sort} onSort={toggleSort} />
              <SortableHeader column="brand" label="Brand" sort={sort} onSort={toggleSort} />
              <SortableHeader column="type" label="Type" sort={sort} onSort={toggleSort} />
              <SortableHeader column="status" label="Status" sort={sort} onSort={toggleSort} />
              <SortableHeader column="identity" label="Primary identity" sort={sort} onSort={toggleSort} />
              <SortableHeader column="barcodes" label="Barcodes" sort={sort} onSort={toggleSort} align="right" />
              <SortableHeader column="ingredients" label="Ingredients" sort={sort} onSort={toggleSort} align="right" />
              <SortableHeader column="evidence" label="Evidence" sort={sort} onSort={toggleSort} />
              <SortableHeader column="followUp" label="Follow-up" sort={sort} onSort={toggleSort} />
              <SortableHeader column="updated" label="Updated" sort={sort} onSort={toggleSort} />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {products.map((product) => {
              const isExpanded = expanded.has(product.id);
              const detail = details[product.id];
              return (
                <Fragment key={product.id}>
                  <tr className={isExpanded ? "bg-accent/[0.03]" : "hover:bg-white/[0.02]"}>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        aria-expanded={isExpanded}
                        onClick={() => toggleProduct(product.id)}
                        className="flex max-w-xs items-start gap-3 text-left font-semibold hover:text-accent"
                      >
                        <span aria-hidden="true" className="mt-0.5 w-3 text-xs text-accent">{isExpanded ? "▼" : "▶"}</span>
                        <span>{product.labelName}{product.variant ? <span className="mt-1 block text-xs font-normal text-text-muted">{product.variant}</span> : null}</span>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{product.brandName}</td>
                    <td className="px-4 py-3">{titleCase(product.productType)}</td>
                    <td className="px-4 py-3"><span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${statusClasses[product.status]}`}>{titleCase(product.status)}</span></td>
                    <td className="max-w-52 break-words px-4 py-3 text-text-secondary">{catalogPrimaryIdentity(product)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{product.barcodeCount}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{product.activeLeafCount}</td>
                    <td className={`px-4 py-3 ${product.imageCount === 0 ? "text-warning" : "text-text-secondary"}`}>{catalogEvidenceSummary(product)}</td>
                    <td className="px-4 py-3">{product.needsFollowUp ? <span className="text-warning">Needs review</span> : <span className="text-text-muted">Clear</span>}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-text-muted">{formatDate(product.updatedAt)}</td>
                  </tr>
                  {isExpanded ? (
                    <tr className="bg-[#080D12]/50">
                      <td colSpan={10} className="p-0">
                        {detail?.state === "ready" ? <CatalogDatabaseDetails product={detail.product} /> : null}
                        {detail?.state === "error" ? (
                          <div role="alert" className="m-4 rounded border border-error/30 bg-error/5 p-4 text-sm text-error">
                            <p>{detail.message}</p>
                            <button type="button" onClick={() => void loadDetail(product.id)} className="mt-3 rounded-full border border-error/40 px-3 py-2 text-xs font-semibold">Retry details</button>
                          </div>
                        ) : null}
                        {!detail || detail.state === "loading" ? <p role="status" className="p-5 text-sm text-text-muted">Loading complete product record…</p> : null}
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {!loading && products.length === 0 && !error ? (
        <p className="p-8 text-center text-sm text-text-muted">
          {hasActiveFilters ? "No products match the current search and filters." : "The catalog is empty."}
        </p>
      ) : null}
      <div className="flex items-center justify-between gap-3 border-t border-white/10 p-4">
        <p className="text-xs text-text-muted">{products.length} product{products.length === 1 ? "" : "s"} loaded</p>
        {nextCursor ? (
          <button type="button" disabled={loading} onClick={() => void loadProducts(nextCursor, true)} className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold disabled:opacity-40">
            {loading ? "Loading…" : "Load more products"}
          </button>
        ) : loading ? <span role="status" className="text-xs text-text-muted">Loading products…</span> : null}
      </div>
    </section>
  );
}
