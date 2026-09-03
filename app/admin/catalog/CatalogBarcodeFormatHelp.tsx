"use client";

import { useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export default function CatalogBarcodeFormatHelp({ children }: { children: ReactNode }) {
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const tooltip = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [top, setTop] = useState(16);

  useLayoutEffect(() => {
    if (!open) return;
    const position = () => {
      if (!button.current || !tooltip.current) return;
      const anchor = button.current.getBoundingClientRect();
      const height = tooltip.current.getBoundingClientRect().height;
      const below = anchor.bottom + 8;
      setTop(Math.max(16, below + height <= window.innerHeight - 16
        ? below : anchor.top - height - 8));
    };
    position();
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    return () => {
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
    };
  }, [open]);

  return <span className="inline-flex" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
    <button ref={button} type="button" aria-label="About barcode formats" aria-describedby={open ? id : undefined}
      onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }}
      className="flex h-4 w-4 items-center justify-center rounded-full border border-white/20 text-[10px] text-text-muted hover:border-accent hover:text-accent focus:border-accent focus:text-accent focus:outline-none">?</button>
    {open ? createPortal(
      <span ref={tooltip} id={id} role="tooltip" style={{ top }}
        className="pointer-events-none fixed inset-x-4 z-50 rounded border border-white/15 bg-[#111820] p-3 text-left text-xs font-normal leading-5 text-text-secondary shadow-xl">
        {children}
      </span>, document.body,
    ) : null}
  </span>;
}
