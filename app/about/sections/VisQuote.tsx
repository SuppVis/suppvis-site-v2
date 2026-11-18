"use client";

import { useScrollReveal } from "../../hooks/useScrollReveal";

export default function VisQuote() {
  const ref = useScrollReveal();

  return (
    <section className="py-[120px] md:py-[160px] px-6">
      <div ref={ref} className="scroll-reveal-scale max-w-[720px] mx-auto">
        <div className="relative pl-8 md:pl-10">
          {/* Teal vertical line */}
          <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-full bg-accent/60" />

          <blockquote className="font-body text-[20px] sm:text-[22px] md:text-[26px] italic text-accent leading-relaxed">
            &ldquo;Vis&rdquo; is the vital force in naturopathic medicine. The
            biological intelligence that governs your body&rsquo;s balance
            between resilience and vulnerability.
          </blockquote>
        </div>

        <p className="mt-8 text-text-secondary text-base md:text-lg md:text-center pl-8 md:pl-0">
          SuppVis was built to make that force easier to see. Through a daily
          record, not guesswork.
        </p>
      </div>
    </section>
  );
}
