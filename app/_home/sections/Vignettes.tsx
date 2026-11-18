import { Reveal, SectionDivider, TealRule } from "@/app/components/ui";

// Decorative, text-free timelines (aria-hidden). No data is implied.

function PregnancyTimeline() {
  const days = 270;
  const visits = 12;
  return (
    <svg viewBox="0 0 540 64" className="w-full h-auto" aria-hidden="true">
      {Array.from({ length: days }).map((_, i) => (
        <rect key={i} x={i * 2} y={22} width={1} height={20} rx={0.5} fill="rgba(20,184,166,0.35)" />
      ))}
      {Array.from({ length: visits }).map((_, i) => {
        const x = Math.round(((i + 0.5) / visits) * days) * 2;
        return (
          <g key={i}>
            <rect x={x - 1} y={8} width={3} height={48} rx={1.5} fill="#F0F4F8" />
            <circle cx={x + 0.5} cy={8} r={3.5} fill="#F0F4F8" />
          </g>
        );
      })}
    </svg>
  );
}

function IncidentTimeline() {
  const episodes = [46, 131, 168, 279, 322, 447];
  return (
    <svg viewBox="0 0 540 64" className="w-full h-auto" aria-hidden="true">
      <line x1={0} y1={44} x2={540} y2={44} stroke="rgba(255,255,255,0.12)" strokeWidth={1} />
      {episodes.map((x) => (
        <g key={x}>
          <rect x={x - 36} y={20} width={36} height={24} rx={4} fill="rgba(20,184,166,0.12)" stroke="rgba(20,184,166,0.35)" strokeDasharray="3 3" />
          <circle cx={x} cy={44} r={5} fill="#FF8C42" />
          <line x1={x} y1={44} x2={x} y2={14} stroke="rgba(255,140,66,0.5)" strokeWidth={1} />
        </g>
      ))}
    </svg>
  );
}

function Vignette({
  heading,
  children,
  visual,
}: {
  heading: string;
  children: React.ReactNode;
  visual: React.ReactNode;
}) {
  return (
    <Reveal>
      <article className="relative rounded-3xl bg-bg-secondary border border-white/5 p-8 sm:p-10 md:p-14 overflow-hidden">
        <div
          className="absolute -top-32 -right-32 w-[420px] h-[420px] rounded-full opacity-[0.06] pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(20,184,166,0.7) 0%, transparent 70%)" }}
        />
        <div className="relative">
          <TealRule />
          <h2 className="font-headline font-bold text-2xl sm:text-3xl md:text-4xl text-text-primary leading-[1.15] tracking-tight max-w-[820px]">
            {heading}
          </h2>
          <div className="mt-10 mb-10 opacity-90">{visual}</div>
          <p className="text-[16.5px] md:text-lg text-text-secondary leading-relaxed max-w-[860px]">{children}</p>
        </div>
      </article>
    </Reveal>
  );
}

export default function Vignettes() {
  return (
    <section className="relative py-24 md:py-32 px-6">
      <SectionDivider />
      <div className="max-w-[1200px] mx-auto space-y-6 md:space-y-8">
        {/* Vignette one. Compliance: no outcome language; Connor reviews word by word. */}
        <Vignette
          heading="Nine months. Twelve visits. Two hundred seventy days of signal."
          visual={<PregnancyTimeline />}
        >
          A patient sees her OB monthly through pregnancy. Between those visits,
          SuppVis holds the whole story: the prenatal she takes daily and the
          medications alongside it, every combination screened as it&apos;s
          logged. Her walks, her yoga, the week she stopped exercising. The
          mornings nausea hit, the dizzy spells, the appetite swings, each
          logged as an incident the day it happened with everything that
          preceded it, not recalled weeks later. Her cycle history before
          conception, her sleep from her watch, her labs trended across draws.
          Her OB opens each visit with the complete record of the month, not a
          reconstruction of it.
        </Vignette>

        <Vignette
          heading="Irregular symptoms have regular patterns more often than they seem."
          visual={<IncidentTimeline />}
        >
          A patient gets dizzy spells. No schedule, no obvious trigger, no
          answer. Alone, each episode is an anecdote. Logged as incidents, they
          become a record. For every episode, the brief shows what surrounded
          it: what was taken that day and the days before, including the herb
          whose secondary mechanism nobody thought to mention. Sleep and
          recovery from their wearable. Habits kept and skipped. What they said
          was different that day. SuppVis proposes the timing associations,
          labeled as associations, never conclusions. Instead of starting from
          &ldquo;it happens randomly,&rdquo; you start from the pattern. The
          judgment call stays where it belongs: with you.
        </Vignette>
      </div>
    </section>
  );
}
