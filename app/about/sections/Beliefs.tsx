"use client";

import { useScrollReveal } from "../../hooks/useScrollReveal";

const beliefs = [
  {
    headline: "Judgment stays with the clinician.",
    body: "SuppVis assembles the record and proposes associations, labeled as associations. What they mean, and what to do about them, is the practitioner\u2019s call. The brief stops where clinical judgment starts.",
  },
  {
    headline: "The patient owns the record.",
    body: "Every account belongs to the person who keeps it. They choose whether to share it, and with whom, and they can stop sharing at any time.",
  },
  {
    headline: "Science you can audit.",
    body: "Every insight traces to a research library of 33,000+ peer-reviewed studies, browsable publicly. Not influencer opinions. Not marketing claims. When the record isn\u2019t sufficient to say something, SuppVis says so.",
  },
];

export default function Beliefs() {
  const headerRef = useScrollReveal();

  return (
    <section className="py-[120px] md:py-[160px] px-6">
      <div className="max-w-[1200px] mx-auto">
        <h2
          ref={headerRef}
          className="scroll-reveal font-headline font-bold text-[28px] sm:text-[32px] md:text-[36px] lg:text-[42px] text-text-primary mb-12 md:mb-16 md:text-center"
        >
          What drives every decision we make
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {beliefs.map((belief, i) => (
            <BeliefCard key={i} belief={belief} delay={i * 0.1} />
          ))}
        </div>
      </div>
    </section>
  );
}

function BeliefCard({
  belief,
  delay,
}: {
  belief: (typeof beliefs)[number];
  delay: number;
}) {
  const ref = useScrollReveal(delay);

  return (
    <div
      ref={ref}
      className="scroll-reveal rounded-[18px] bg-bg-secondary border border-white/[0.06] p-8 md:p-10"
    >
      <h3 className="font-headline font-bold text-lg text-accent mb-3">
        {belief.headline}
      </h3>
      <p className="text-[15px] text-text-secondary leading-[1.65]">
        {belief.body}
      </p>
    </div>
  );
}
