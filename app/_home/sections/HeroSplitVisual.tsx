// Hero visual: the first 20 minutes of a visit today (left) versus the
// pre-visit brief, already complete (right). All text here is illustrative
// mockup copy and is catalogued in docs/MOCKUP_COPY.md.

const INTAKE_QUESTIONS = [
  { min: 1, q: "So, what's been going on since last time?" },
  { min: 4, q: "Which supplements are you taking right now?" },
  { min: 7, q: "Are you still on the full dose?" },
  { min: 10, q: "When did that first start?" },
  { min: 13, q: "Better or worse than last month?" },
  { min: 16, q: "How has your sleep been?" },
  { min: 19, q: "Did anything else change?" },
];

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function ClockFace() {
  const cx = 100;
  const cy = 100;
  const r = 78;
  // 20 minutes = 120 degrees of the dial
  const end = polar(cx, cy, r, 120);
  const hand = polar(cx, cy, 60, 120);

  return (
    <svg viewBox="0 0 200 200" className="w-full h-full" aria-hidden="true">
      <circle cx={cx} cy={cy} r={90} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
      <circle cx={cx} cy={cy} r={r} fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5" />
      <path
        d={`M ${cx} ${cy} L ${cx} ${cy - r} A ${r} ${r} 0 0 1 ${end.x} ${end.y} Z`}
        fill="rgba(255,140,66,0.18)"
        stroke="rgba(255,140,66,0.55)"
        strokeWidth="1"
      />
      {Array.from({ length: 60 }).map((_, i) => {
        const major = i % 5 === 0;
        const a = polar(cx, cy, r - (major ? 9 : 4), i * 6);
        const b = polar(cx, cy, r - 1, i * 6);
        return (
          <line
            key={i}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke={major ? "rgba(240,244,248,0.45)" : "rgba(240,244,248,0.15)"}
            strokeWidth={major ? 1.5 : 1}
            strokeLinecap="round"
          />
        );
      })}
      {INTAKE_QUESTIONS.map(({ min }) => {
        const p = polar(cx, cy, r - 22, min * 6);
        return <circle key={min} cx={p.x} cy={p.y} r={2.5} fill="#FF8C42" />;
      })}
      <line x1={cx} y1={cy} x2={cx} y2={cy - 48} stroke="#F0F4F8" strokeWidth="3" strokeLinecap="round" />
      <line x1={cx} y1={cy} x2={hand.x} y2={hand.y} stroke="#FF8C42" strokeWidth="2" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={4} fill="#0D1117" stroke="#F0F4F8" strokeWidth="2" />
    </svg>
  );
}

function BriefRow({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "flag" | "teal" }) {
  const valueClass =
    tone === "flag" ? "text-warning" : tone === "teal" ? "text-accent" : "text-text-primary";
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-white/[0.05] last:border-0">
      <span className="text-[12px] text-text-secondary">{label}</span>
      <span className={`text-[12px] font-semibold tabular-nums ${valueClass}`}>{value}</span>
    </div>
  );
}

export default function HeroSplitVisual() {
  return (
    <div className="relative grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-0 rounded-3xl border border-white/[0.06] bg-bg-secondary/60 overflow-hidden shadow-2xl shadow-black/30">
      {/* Left: today */}
      <div className="relative p-6 sm:p-8 md:border-r border-white/[0.06]">
        <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-warning/90">
          The first 20 minutes of a visit today
        </p>
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-[150px_1fr] gap-5 items-start">
          <div className="aspect-square w-[140px] sm:w-auto mx-auto sm:mx-0">
            <ClockFace />
          </div>
          <ul className="space-y-2">
            {INTAKE_QUESTIONS.map(({ min, q }) => (
              <li key={min} className="flex items-start gap-2.5">
                <span className="mt-[3px] shrink-0 w-11 text-[10px] font-medium text-text-muted tabular-nums">
                  min {min}
                </span>
                <span className="text-[12.5px] leading-snug text-text-secondary">{q}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Right: with SuppVis */}
      <div className="relative p-6 sm:p-8 bg-gradient-to-br from-accent/[0.07] to-transparent">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-accent">
            Pre-visit brief
          </p>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-2.5 py-1 text-[10px] font-semibold text-accent">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Ready before the visit
          </span>
        </div>

        <div className="mt-6 rounded-2xl bg-bg-primary/70 border border-white/[0.06] p-5">
          <p className="text-[10px] uppercase tracking-[0.15em] text-text-muted mb-2">At a glance</p>
          <BriefRow label="Incidents logged" value="3" tone="flag" />
          <BriefRow label="Largest score change" value="Sleep, down 12" />
          <BriefRow label="Check-in coverage" value="26 of 30 days" tone="teal" />
          <BriefRow label="Open flags" value="2" tone="flag" />

          <p className="text-[10px] uppercase tracking-[0.15em] text-text-muted mt-5 mb-2">Regimen, plan vs actual</p>
          {[
            { name: "Magnesium, evening", pct: 90 },
            { name: "Vitamin D3, morning", pct: 73 },
            { name: "Omega-3, with meals", pct: 50 },
          ].map((r) => (
            <div key={r.name} className="py-1.5">
              <div className="flex justify-between text-[11.5px]">
                <span className="text-text-secondary">{r.name}</span>
                <span className="text-text-muted tabular-nums">{Math.round((r.pct / 100) * 30)} of 30 days</span>
              </div>
              <div className="mt-1.5 h-1 rounded-full bg-white/[0.06]">
                <div className="h-1 rounded-full bg-accent/80" style={{ width: `${r.pct}%` }} />
              </div>
            </div>
          ))}

          <p className="text-[10px] uppercase tracking-[0.15em] text-text-muted mt-5 mb-2">Questions for the visit</p>
          <ul className="space-y-1.5 text-[12px] text-text-primary/90 leading-snug">
            <li className="flex gap-2"><span className="text-accent">?</span>What happened on days 20 to 23, when check-ins paused?</li>
            <li className="flex gap-2"><span className="text-accent">?</span>Is the patient-added herbal extract still being taken?</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
