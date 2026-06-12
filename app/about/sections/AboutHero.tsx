"use client";

import { useScrollReveal } from "../../hooks/useScrollReveal";

export default function AboutHero() {
  const ref = useScrollReveal();

  return (
    <section className="min-h-screen flex items-center px-6 pt-24 pb-16 md:pt-32 md:pb-24">
      <div ref={ref} className="scroll-reveal max-w-[1200px] mx-auto w-full">
        <h1 className="font-headline font-extrabold text-[32px] sm:text-[40px] md:text-[48px] lg:text-[56px] leading-tight text-text-primary mb-10 md:mb-14 max-w-4xl">
          We didn&rsquo;t start a company. We built the tool we needed.
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-14 items-center">
          {/* Founders photo placeholder */}
          <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden">
            <img
              src="/abouttancon.jpeg"
              alt="Connor and Tanner Haslinger, co-founders of SuppVis"
              className="absolute inset-0 w-full h-full object-cover"
            />
            {/* Teal-tinted gradient overlay on edges */}
            <div className="absolute inset-0 bg-gradient-to-r from-bg-primary/40 via-transparent to-bg-primary/40" />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-bg-primary/50" />
          </div>

          <p className="text-lg md:text-xl text-text-secondary leading-relaxed max-w-[600px]">
            SuppVis was built by two brothers. One managing Type 1 diabetes, the
            other studying naturopathic medicine. Both frustrated by an industry
            that sells confidence but delivers confusion.
          </p>
        </div>
      </div>
    </section>
  );
}
