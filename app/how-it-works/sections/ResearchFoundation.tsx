"use client";

import { useScrollReveal } from "../../hooks/useScrollReveal";

function StatBlock({
  value,
  label,
  delay,
}: {
  value: string;
  label: string;
  delay: number;
}) {
  const ref = useScrollReveal(delay);

  return (
    <div ref={ref} className="scroll-reveal text-center">
      <div className="font-headline font-extrabold text-4xl sm:text-5xl md:text-6xl text-accent leading-none">
        {value}
      </div>
      <div className="mt-3 text-text-secondary text-sm md:text-base">
        {label}
      </div>
    </div>
  );
}

export default function ResearchFoundation() {
  const copyRef = useScrollReveal(0.1);
  const tiersRef = useScrollReveal(0.2);

  return (
    <section className="py-24 md:py-32 px-6 relative">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

      <div className="max-w-[1200px] mx-auto">
        {/* Stats bar */}
        <div className="rounded-[18px] bg-bg-secondary border border-white/[0.06] py-12 md:py-16 px-8 mb-14 md:mb-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10 md:gap-6">
            <StatBlock delay={0} value="33,000+" label="peer-reviewed studies" />
            <StatBlock delay={0.1} value="433" label="supplements profiled" />
            <StatBlock delay={0.15} value="22" label="health dimensions" />
            <StatBlock delay={0.2} value="14,000+" label="drug interactions checked" />
          </div>
        </div>

        {/* Copy */}
        <div className="max-w-[720px] mx-auto text-center">
          <p
            ref={copyRef}
            className="scroll-reveal text-text-secondary text-base md:text-lg leading-relaxed mb-4"
          >
            Every recommendation traces back to peer-reviewed research. We index
            studies from PubMed and Semantic Scholar, classify by study type and
            evidence quality, and use them to power your personalized insights.
            The science is the product.
          </p>

          <a
            href="/sources"
            className="scroll-reveal block mt-4 mb-10 text-sm text-accent hover:text-accent-hover hover:underline underline-offset-4 transition-colors"
          >
            See our research sources →
          </a>

          {/* Evidence tier visual */}
          <div ref={tiersRef} className="scroll-reveal inline-flex flex-wrap justify-center gap-3">
            {[
              "Regulatory",
              "Clinical Trial",
              "Observational",
              "Animal",
              "Mechanistic",
            ].map((tier, i) => (
              <span
                key={tier}
                className="px-4 py-2 rounded-full text-sm border transition-colors"
                style={{
                  borderColor: `rgba(20,184,166,${0.3 - i * 0.05})`,
                  color: `rgba(240,244,248,${0.9 - i * 0.12})`,
                  backgroundColor: `rgba(20,184,166,${0.08 - i * 0.012})`,
                }}
              >
                {tier}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
