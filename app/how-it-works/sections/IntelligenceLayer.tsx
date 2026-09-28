"use client";

import { useScrollReveal } from "../../hooks/useScrollReveal";

function IntelCard({
  title,
  description,
  icon,
  delay,
  link,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  delay: number;
  link?: { href: string; label: string };
}) {
  const ref = useScrollReveal(delay);

  return (
    <div
      ref={ref}
      className="scroll-reveal rounded-[18px] bg-bg-secondary border border-white/[0.06] p-8 md:p-10 flex flex-col"
    >
      <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-accent/10 flex items-center justify-center text-accent mb-5">
        {icon}
      </div>
      <h3 className="font-headline font-bold text-lg text-text-primary mb-3">
        {title}
      </h3>
      <p className="text-text-secondary text-[15px] leading-relaxed">
        {description}
      </p>
      {link && (
        <a
          href={link.href}
          className="mt-4 inline-block text-sm text-accent hover:underline underline-offset-4 transition-colors"
        >
          {link.label}
        </a>
      )}
    </div>
  );
}

export default function IntelligenceLayer() {
  const headRef = useScrollReveal();
  const subRef = useScrollReveal(0.1);

  return (
    <section className="py-24 md:py-32 px-6 relative">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

      <div className="max-w-[1200px] mx-auto">
        {/* Section header */}
        <div className="text-center max-w-[720px] mx-auto mb-16 md:mb-20">
          <h2
            ref={headRef}
            className="scroll-reveal font-headline font-bold text-3xl sm:text-4xl md:text-5xl text-text-primary leading-tight mb-5"
          >
            Three things nothing else does.
          </h2>
          <p
            ref={subRef}
            className="scroll-reveal text-text-secondary text-lg leading-relaxed"
          >
            Everything else is table stakes. These are the moats.
          </p>
        </div>

        {/* Three cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <IntelCard
            delay={0}
            title="Interaction Safety"
            description="Checks every supplement in your stack against your medications. 2,300+ documented drug-supplement interactions, across 14,000+ drug ingredients and 433 supplements. Catches conflicts most people don't know to ask about."
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            }
          />

          <IntelCard
            delay={0.1}
            title="Condition Cross-Reference"
            description="Every supplement cross-checked against your health conditions. 2,500+ supplement-condition interactions across 300+ conditions. Catches supplements that look helpful in isolation but conflict with what's already happening in your body."
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            }
          />

          <IntelCard
            delay={0.2}
            title="Research Transparency"
            description="Every recommendation traces back to peer-reviewed research. Studies indexed from PubMed and Semantic Scholar, classified by evidence tier, with the source and the strength visible. No black boxes."
            link={{ href: "/sources", label: "See our research sources \u2192" }}
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
              </svg>
            }
          />
        </div>
      </div>
    </section>
  );
}
