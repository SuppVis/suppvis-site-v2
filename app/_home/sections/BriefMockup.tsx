// Illustrative pre-visit brief. Generic, round values, relative days only, no
// names, no brands, no outcome language. Every string here is catalogued in
// docs/MOCKUP_COPY.md for clinical review.

import type { ReactNode } from "react";

const label = "text-[10px] uppercase tracking-[0.15em] text-text-muted";

function Src({ children }: { children: ReactNode }) {
  return (
    <span className="ml-auto shrink-0 text-[10px] text-accent/70 underline decoration-accent/30 underline-offset-2">
      {children}
    </span>
  );
}

function Chip({ children, tone }: { children: ReactNode; tone: "teal" | "amber" | "muted" }) {
  const cls =
    tone === "teal"
      ? "bg-accent/10 text-accent"
      : tone === "amber"
        ? "bg-warning/10 text-warning"
        : "bg-white/[0.05] text-text-muted";
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>{children}</span>;
}

function AtAGlance() {
  const tiles = [
    { k: "Incidents logged", v: "3", tone: "text-warning" },
    { k: "Largest score change", v: "Sleep, down 12", tone: "text-text-primary" },
    { k: "Check-in coverage", v: "26 of 30 days", tone: "text-accent" },
    { k: "Open flags", v: "2", tone: "text-warning" },
  ];
  return (
    <div className="grid grid-cols-2 gap-2">
      {tiles.map((t) => (
        <div key={t.k} className="rounded-xl bg-white/[0.03] border border-white/[0.05] p-3">
          <p className="text-[10.5px] text-text-muted">{t.k}</p>
          <p className={`mt-1 font-headline font-bold text-[15px] ${t.tone}`}>{t.v}</p>
        </div>
      ))}
    </div>
  );
}

function Incidents() {
  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/[0.05] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Chip tone="amber">Incident</Chip>
        <span className="text-[12.5px] font-semibold text-text-primary">Dizziness, day 18</span>
        <span className="text-[11px] text-text-muted">Severity 3 of 5</span>
      </div>
      <p className={`${label} mt-4 mb-2`}>In the 72 hours before</p>
      <ul className="space-y-1.5 text-[12px] text-text-secondary">
        <li className="flex gap-2"><span className="text-accent">+</span>Started: herbal extract, patient-added, day 16<Src>log</Src></li>
        <li className="flex gap-2"><span className="text-warning">&minus;</span>Missed: morning item, 2 of 3 days<Src>log</Src></li>
        <li className="flex gap-2"><span className="text-text-muted">~</span>Sleep: 5.5 h, against a 7 h average<Src>wearable</Src></li>
        <li className="flex gap-2"><span className="text-text-muted">&ldquo;</span>Patient note: &ldquo;Long travel day.&rdquo;<Src>check-in</Src></li>
      </ul>
      <div className="mt-4 flex items-center gap-2 rounded-lg border border-dashed border-accent/25 px-3 py-2">
        <Chip tone="teal">Association</Chip>
        <span className="text-[11.5px] text-text-secondary">Timing only, not a conclusion</span>
      </div>
    </div>
  );
}

function Regimen() {
  const row = (name: string, dose: string, taken: string, extra?: ReactNode) => (
    <div className="flex items-center gap-3 py-2 border-b border-white/[0.05] last:border-0">
      <div className="min-w-0">
        <p className="text-[12px] text-text-primary truncate">{name}</p>
        <p className="text-[10.5px] text-text-muted">{dose}</p>
      </div>
      <div className="ml-auto flex items-center gap-2 shrink-0">
        {extra}
        <span className="text-[11px] tabular-nums text-text-secondary">{taken}</span>
      </div>
    </div>
  );
  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-white/[0.03] border border-accent/15 px-4 py-2">
        <p className={`${label} pt-2 pb-1 text-accent/80`}>Treatment plan</p>
        {row("Magnesium", "200 mg, evening", "27 of 30 days")}
        {row("Vitamin D3", "2,000 IU, morning", "22 of 30 days")}
        {row("Medication A", "As prescribed, daily", "30 of 30 days")}
        {row("Peptide B", "3 times weekly", "10 of 12 doses")}
      </div>
      <div className="rounded-xl bg-white/[0.03] border border-white/[0.05] px-4 py-2">
        <p className={`${label} pt-2 pb-1`}>Added by patient</p>
        {row("Herbal extract", "1 capsule, daily", "14 of 14 days", <Chip tone="amber">Interaction flagged</Chip>)}
      </div>
    </div>
  );
}

function WholePerson() {
  const rows: [string, "Stable" | "Changed", ("Acute" | "Chronic")?][] = [
    ["Sleep", "Changed", "Acute"],
    ["Nutrition and hydration", "Stable"],
    ["Movement", "Changed", "Chronic"],
    ["Mind and mood", "Stable"],
    ["Substances", "Stable"],
    ["Environment and cycles", "Changed", "Acute"],
    ["Gut", "Stable"],
    ["Medications and supplements", "Changed", "Acute"],
  ];
  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/[0.05] px-4 py-1">
      {rows.map(([d, s, c]) => (
        <div key={d} className="flex items-center gap-2 py-2 border-b border-white/[0.05] last:border-0">
          <span className={`w-1.5 h-1.5 rounded-full ${s === "Changed" ? "bg-warning" : "bg-accent/60"}`} />
          <span className="text-[12px] text-text-secondary">{d}</span>
          <span className="ml-auto flex gap-1.5">
            <Chip tone={s === "Changed" ? "amber" : "muted"}>{s}</Chip>
            {c && <Chip tone="muted">{c}</Chip>}
          </span>
        </div>
      ))}
    </div>
  );
}

function SupportAndBarriers() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      <div className="rounded-xl bg-white/[0.03] border border-white/[0.05] p-4">
        <p className={`${label} mb-2 text-accent/80`}>Associated with better days</p>
        <ul className="space-y-1.5 text-[12px] text-text-secondary">
          <li>Evening walk logged</li>
          <li>Consistent bedtime</li>
          <li>Check-in before noon</li>
        </ul>
      </div>
      <div className="rounded-xl bg-white/[0.03] border border-white/[0.05] p-4">
        <p className={`${label} mb-2 text-warning/80`}>In the way</p>
        <ul className="space-y-1.5 text-[12px] text-text-secondary">
          <li>Most skipped: midday item, 9 of 30 days</li>
          <li>Logging gap: days 20 to 23</li>
          <li>Noted barrier: &ldquo;Hard to fit around work.&rdquo;</li>
        </ul>
      </div>
    </div>
  );
}

function Questions() {
  const qs = [
    "What happened on days 20 to 23, when check-ins paused?",
    "Is the patient-added herbal extract still being taken?",
    "Was anything else different on the day 18 travel day?",
  ];
  return (
    <ol className="space-y-2">
      {qs.map((q, i) => (
        <li key={q} className="flex gap-3 rounded-xl bg-white/[0.03] border border-white/[0.05] px-4 py-3">
          <span className="font-headline font-bold text-[12px] text-accent">Q{i + 1}</span>
          <span className="text-[12.5px] text-text-primary/90 leading-snug">{q}</span>
        </li>
      ))}
    </ol>
  );
}

export const BRIEF_BLOCKS: { title: string; render: () => ReactNode }[] = [
  { title: "At a glance", render: AtAGlance },
  { title: "Incidents", render: Incidents },
  { title: "Regimen: plan vs actual", render: Regimen },
  { title: "The whole person", render: WholePerson },
  { title: "Supporting and in the way", render: SupportAndBarriers },
  { title: "Questions for the visit", render: Questions },
];

export function BriefBlock({ index, active = true }: { index: number; active?: boolean }) {
  const b = BRIEF_BLOCKS[index];
  return (
    <div
      className={`relative rounded-2xl p-4 sm:p-5 transition-all duration-500 ${
        active
          ? "bg-accent/[0.04] ring-1 ring-accent/40 opacity-100"
          : "ring-1 ring-transparent opacity-40"
      }`}
    >
      <div className="flex items-center gap-2.5 mb-3">
        <span
          className={`flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold transition-colors duration-500 ${
            active ? "bg-accent text-bg-primary" : "bg-white/[0.08] text-text-muted"
          }`}
        >
          {index + 1}
        </span>
        <span className="text-[12px] font-semibold text-text-primary">{b.title}</span>
      </div>
      {b.render()}
    </div>
  );
}

export function BriefHeader() {
  return (
    <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-white/[0.06]">
      <div>
        <p className="font-headline font-bold text-[15px] text-text-primary">Pre-visit brief</p>
        <p className="text-[11px] text-text-muted">30 days since last visit &middot; shared by the patient</p>
      </div>
      <div className="flex gap-1.5" aria-hidden="true">
        <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
        <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
        <span className="w-2.5 h-2.5 rounded-full bg-accent/60" />
      </div>
    </div>
  );
}
