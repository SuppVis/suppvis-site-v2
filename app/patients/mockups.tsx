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

export function SharingMockup() {
  return (
    <div
      className="mx-auto max-w-[400px] rounded-3xl bg-bg-secondary border border-white/[0.06] p-6 shadow-2xl shadow-black/30"
      role="img"
      aria-label="Illustration of account sharing settings"
    >
      <p className="font-headline font-bold text-lg text-text-primary">Sharing</p>
      <p className="mt-1 text-[12px] text-text-muted">You decide who sees your record.</p>

      <div className="mt-5 rounded-2xl bg-bg-primary/60 border border-white/[0.05] p-4">
        <p className="text-[10px] uppercase tracking-[0.15em] text-text-muted">Invite code</p>
        <p className="mt-2 font-headline font-bold text-xl tracking-[0.3em] text-text-primary">&bull;&bull;&bull;&bull; &bull;&bull;&bull;&bull;</p>
      </div>

      <div className="mt-3 flex items-center justify-between rounded-2xl bg-bg-primary/60 border border-white/[0.05] p-4">
        <div>
          <p className="text-[13px] text-text-primary">Your practitioner</p>
          <p className="text-[11px] text-accent mt-0.5">Sharing on</p>
        </div>
        <span className="relative inline-flex h-6 w-11 rounded-full bg-accent" aria-hidden="true">
          <span className="absolute right-0.5 top-0.5 h-5 w-5 rounded-full bg-bg-primary" />
        </span>
      </div>

      <p className="mt-4 text-center text-[12px] font-medium text-text-secondary">Stop sharing at any time</p>
    </div>
  );
}
