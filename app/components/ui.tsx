"use client";

import type { ReactNode } from "react";
import { useScrollReveal } from "../hooks/useScrollReveal";

export function Reveal({
  children,
  delay = 0,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "h2" | "p";
}) {
  const ref = useScrollReveal<HTMLElement>(delay);
  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <Tag ref={ref as any} className={`scroll-reveal ${className}`}>
      {children}
    </Tag>
  );
}

export function SectionDivider() {
  return (
    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
  );
}

export function SectionHeading({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <Reveal
      as="h2"
      className={`font-headline font-bold text-3xl sm:text-4xl md:text-5xl text-text-primary leading-[1.1] tracking-tight ${className}`}
    >
      {children}
    </Reveal>
  );
}

export function TealRule({ className = "" }: { className?: string }) {
  return <div className={`h-1 w-10 rounded-full bg-accent mb-8 ${className}`} />;
}

export const primaryButton =
  "inline-flex items-center justify-center px-8 py-3.5 rounded-full bg-accent hover:bg-accent-hover text-bg-primary font-semibold text-base transition-colors duration-200";

export const secondaryButton =
  "inline-flex items-center justify-center px-8 py-3.5 rounded-full border border-accent/50 text-accent hover:bg-accent/10 hover:border-accent font-semibold text-base transition-colors duration-200";
