"use client";

import { useScrollReveal } from "../../hooks/useScrollReveal";
import { BOOK_DEMO_HREF, FOUNDING_FORM_ID } from "../config";
import { primaryButton, secondaryButton } from "../ui";
import HeroSplitVisual from "./HeroSplitVisual";

export default function ClinicsHero() {
  const headRef = useScrollReveal<HTMLHeadingElement>();
  const subRef = useScrollReveal<HTMLParagraphElement>(0.15);
  const ctaRef = useScrollReveal(0.25);
  const vizRef = useScrollReveal(0.35);

  return (
    <section className="relative pt-32 pb-24 md:pt-44 md:pb-32 px-6 overflow-hidden">
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(20,184,166,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(20,184,166,0.4) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
      </div>
      <div
        className="absolute top-[30%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[700px] rounded-full opacity-[0.07] pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(20,184,166,0.5) 0%, transparent 70%)" }}
      />

      <div className="relative max-w-[1200px] mx-auto">
        <div className="max-w-[860px] mx-auto text-center">
          <h1
            ref={headRef}
            className="scroll-reveal font-headline font-extrabold text-4xl sm:text-5xl md:text-6xl lg:text-7xl text-text-primary leading-[1.05] tracking-tight"
          >
            Walk in with the history already taken.
          </h1>
          <p
            ref={subRef}
            className="scroll-reveal mt-8 max-w-[680px] mx-auto text-lg md:text-xl text-text-secondary leading-relaxed"
          >
            Most of a visit goes to reconstructing what happened since the last
            one. SuppVis builds that history from what your patient actually
            did, every day, and hands it to you as a pre-visit brief before
            they sit down. The visit starts where your judgment matters.
          </p>
          <div ref={ctaRef} className="scroll-reveal mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href={BOOK_DEMO_HREF} className={primaryButton}>
              Book a demo
            </a>
            <a href={`#${FOUNDING_FORM_ID}`} className={secondaryButton}>
              Join the founding practices
            </a>
          </div>
        </div>

        <div ref={vizRef} className="scroll-reveal-scale mt-16 md:mt-20 max-w-[1040px] mx-auto">
          <HeroSplitVisual />
        </div>
      </div>
    </section>
  );
}
