// Illustrative mockups for /patients. Generic values only, no names, no brands,
// no benefit or outcome text. Catalogued in docs/MOCKUP_COPY.md.

function Check({ done }: { done: boolean }) {
  return (
    <span
      className={`w-5 h-5 shrink-0 rounded-md border flex items-center justify-center ${
        done ? "bg-accent border-accent text-bg-primary" : "border-white/20"
      }`}
      aria-hidden="true"
    >
      {done && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </span>
  );
}

const ITEMS = [
  { name: "Magnesium", detail: "Evening", done: true },
  { name: "Vitamin D3", detail: "Morning", done: true },
  { name: "Evening walk", detail: "Habit", done: false },
];

const SCORES = [
  { label: "Sleep", value: 6 },
  { label: "Energy", value: 7 },
  { label: "Mood", value: 7 },
];

export function CheckInMockup() {
  return (
    <div
      className="mx-auto max-w-[400px] rounded-[2rem] bg-bg-secondary border border-white/[0.06] p-6 shadow-2xl shadow-black/30"
      role="img"
      aria-label="Illustration of a daily check-in"
    >
      <div className="flex items-center justify-between">
        <p className="font-headline font-bold text-lg text-text-primary">Today&apos;s check-in</p>
        <span className="text-[11px] text-text-muted">Day 12</span>
      </div>

      <p className="mt-5 text-[10px] uppercase tracking-[0.15em] text-text-muted mb-2">What you took and did</p>
      <ul className="space-y-2">
        {ITEMS.map((it) => (
          <li key={it.name} className="flex items-center gap-3 rounded-xl bg-bg-primary/60 border border-white/[0.05] px-3 py-2.5">
            <Check done={it.done} />
            <span className="text-[13px] text-text-primary">{it.name}</span>
            <span className="ml-auto text-[11px] text-text-muted">{it.detail}</span>
          </li>
        ))}
      </ul>

      <p className="mt-5 text-[10px] uppercase tracking-[0.15em] text-text-muted mb-2">How you feel</p>
      <div className="space-y-2.5">
        {SCORES.map((s) => (
          <div key={s.label}>
            <div className="flex justify-between text-[12px]">
              <span className="text-text-secondary">{s.label}</span>
              <span className="text-text-muted tabular-nums">{s.value} of 10</span>
            </div>
            <div className="mt-1.5 h-1 rounded-full bg-white/[0.06]">
              <div className="h-1 rounded-full bg-accent/80" style={{ width: `${s.value * 10}%` }} />
            </div>
          </div>
        ))}
      </div>

      <p className="mt-5 text-[10px] uppercase tracking-[0.15em] text-text-muted mb-2">Did you do anything different today?</p>
      <div className="rounded-xl bg-bg-primary/60 border border-accent/20 px-3 py-2.5 text-[13px] text-text-primary">
        Long travel day.
      </div>
    </div>
  );
}

const CARE_ROWS = [
  { label: "Your plan", detail: "3 items from your practitioner" },
  { label: "Your daily record", detail: "Day 12" },
  { label: "Reminders", detail: "At times you set" },
];

export function CareMockup() {
  return (
    <div
      className="mx-auto max-w-[400px] rounded-3xl bg-bg-secondary border border-white/[0.06] p-6 shadow-2xl shadow-black/30"
      role="img"
      aria-label="Illustration of an app account set up by a practice"
    >
      <div className="flex items-center justify-between">
        <p className="font-headline font-bold text-lg text-text-primary">Your practice</p>
        <span className="rounded-full bg-accent/10 border border-accent/20 px-2.5 py-0.5 text-[11px] text-accent">
          Connected
        </span>
      </div>
      <p className="mt-1 text-[12px] text-text-muted">Set up as part of your care.</p>

      <ul className="mt-5 space-y-2">
        {CARE_ROWS.map((r) => (
          <li
            key={r.label}
            className="flex items-center justify-between gap-3 rounded-2xl bg-bg-primary/60 border border-white/[0.05] px-4 py-3"
          >
            <span className="text-[13px] text-text-primary">{r.label}</span>
            <span className="text-[11px] text-text-muted text-right">{r.detail}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
