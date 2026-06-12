"use client";

import { useScrollReveal } from "../hooks/useScrollReveal";

export default function Founders() {
  const sectionRef = useScrollReveal();

  return (
    <section className="py-24 md:py-32 px-6">
      <div ref={sectionRef} className="scroll-reveal max-w-[1200px] mx-auto">
        <h2 className="font-headline font-bold text-3xl sm:text-4xl md:text-5xl text-text-primary mb-12 md:mb-16">
          Built by two brothers who needed this to exist.
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 items-start">
          {/* Founders photo */}
          <div className="w-full aspect-[4/3] rounded-2xl overflow-hidden">
            <img
              src="/homecontan.jpg"
              alt="Connor and Tanner Haslinger, co-founders of SuppVis"
              className="w-full h-full object-cover"
            />
          </div>

          {/* Text */}
          <div className="flex flex-col gap-6">
            <p className="text-text-secondary leading-relaxed">
              Tanner was diagnosed with Type 1 diabetes and needed to know
              exactly how every supplement affected his body. Not what a brand
              claimed. Not what an influencer promoted. What actually worked, for
              him, backed by real data.
            </p>
            <p className="text-text-secondary leading-relaxed">
              Connor is studying naturopathic medicine and kept seeing patients
              confused by contradictory supplement advice with no way to track
              what was actually helping.
            </p>
            <p className="text-text-secondary leading-relaxed">
              They built SuppVis to solve both problems. No brand affiliations
              dictating recommendations. No generic advice. Just a system that
              watches what you take, tracks how you respond, and tells you the
              truth.
            </p>
            <p className="text-text-primary font-semibold text-lg leading-relaxed">
              SuppVis isn&rsquo;t funded by supplement companies. It&rsquo;s built by
              two people who take supplements and got tired of guessing.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
