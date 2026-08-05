"use client";

import { useScrollReveal } from "../../hooks/useScrollReveal";
import StackPreview from "./StackPreview";
import InsightsPreview from "./InsightsPreview";
import GoalAnalysisPreview from "./GoalAnalysisPreview";

const featureHighlights = [
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><path d="M8 12h8" /><path d="M12 8v8" />
      </svg>
    ),
    text: "22 health dimensions in your personalized model",
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20V10" /><path d="M18 20V4" /><path d="M6 20v-4" />
      </svg>
    ),
    text: "9 daily-tracked goals with subjective scoring",
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
      </svg>
    ),
    text: "Correlations across supplements, meds, and habits",
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><path d="M8 12h8" /><path d="M12 8v8" />
      </svg>
    ),
    text: "Synergy and tolerance detection",
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    ),
    text: "Streak tracking with smart reminders",
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 7V5a2 2 0 0 1 2-2h2" /><path d="M17 3h2a2 2 0 0 1 2 2v2" />
        <path d="M21 17v2a2 2 0 0 1-2 2h-2" /><path d="M7 21H5a2 2 0 0 1-2-2v-2" />
        <path d="M8 7v10" /><path d="M12 7v10" /><path d="M16 7v10" />
      </svg>
    ),
    text: "Scan any bottle. See what it means for you.",
  },
];

function ShowcasePanel({
  visual,
  title,
  subtitle,
  body,
  reversed,
  delay,
}: {
  visual: React.ReactNode;
  title: string;
  subtitle: string;
  body: string;
  reversed?: boolean;
  delay: number;
}) {
  const textRef = useScrollReveal(delay);
  const vizRef = useScrollReveal(delay + 0.1);

  return (
    <div className={`grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center ${reversed ? "" : ""}`}>
      <div ref={vizRef} className={`scroll-reveal ${reversed ? "lg:order-2" : "lg:order-1"}`}>
        {visual}
      </div>
      <div ref={textRef} className={`scroll-reveal ${reversed ? "lg:order-1" : "lg:order-2"}`}>
        <h3 className="font-headline font-bold text-2xl sm:text-3xl text-text-primary mb-4">
          {subtitle}
        </h3>
        <p className="text-text-secondary text-base leading-relaxed">
          {body}
        </p>
      </div>
    </div>
  );
}

export default function FindYourFrequency() {
  const headRef = useScrollReveal();
  const subRef = useScrollReveal(0.1);
  const featRef = useScrollReveal(0.15);

  return (
    <section className="py-24 md:py-32 px-6 relative">
      {/* Subtle gradient divider at top */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

      <div className="max-w-[1200px] mx-auto">
        {/* Section Header */}
        <div className="max-w-[720px] mb-16 md:mb-20">
          <h2
            ref={headRef}
            className="scroll-reveal font-headline font-bold text-3xl sm:text-4xl md:text-5xl text-text-primary leading-tight mb-5"
          >
            Find Your Frequency
          </h2>
          <p
            ref={subRef}
            className="scroll-reveal text-text-secondary text-lg leading-relaxed"
          >
            Every day you log builds a clearer picture. SuppVis watches for patterns
            you can&apos;t see: correlations, synergies, tolerances, and anomalies
            across everything you track.
          </p>
        </div>

        {/* Panel A: Your Daily Stack */}
        <div className="mb-20 md:mb-28">
          <ShowcasePanel
            visual={<StackPreview />}
            title="Your Daily Stack"
            subtitle="Your stack, organized by when to take it"
            body="Supplements grouped by optimal timing: morning, with food, afternoon, and evening. Doses, goal tags, and specific instructions at a glance. Track habits alongside supplements, including training, sunlight, and cold exposure, because the full picture matters. Check off what you take. Skip what you miss. The data stays honest either way."
            delay={0}
          />
        </div>

        {/* Panel B: Your Insights */}
        <div className="mb-20 md:mb-28">
          <ShowcasePanel
            visual={<InsightsPreview />}
            title="Your Insights"
            subtitle="See exactly what's helping and what's hurting"
            body="Every supplement and habit scored against every goal you track. Positive and negative correlations surfaced automatically from your personal data. Synergy detection finds when two things work better together. Tolerance detection catches when something stops working. Built on your data, not population averages. The longer you track, the sharper it gets."
            reversed
            delay={0}
          />
        </div>

        {/* Panel C: Goal Analysis (THE MONEY SCREEN) */}
        <div className="mb-20 md:mb-28">
          <ShowcasePanel
            visual={<GoalAnalysisPreview />}
            title="Goal Analysis"
            subtitle="Full analysis of what contributes to your goals."
            body="Deep analysis for every goal you care about. See which supplements are helping, which are hurting, and by how much. Each one rated with your days of tracking data. Research context alongside personal results, with your dose checked against clinical ranges. Personalized recommendations based on what your data actually shows. One tap to ask AI for a deeper explanation."
            delay={0}
          />
        </div>

        {/* Feature Highlights */}
        <div ref={featRef} className="scroll-reveal grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-5">
          {featureHighlights.map((f, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent mt-0.5">
                {f.icon}
              </div>
              <span className="text-text-secondary text-sm leading-snug">{f.text}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
