"use client";

import { useState, useEffect } from "react";

export default function Hero() {
  const [chevronVisible, setChevronVisible] = useState(true);

  useEffect(() => {
    const onScroll = () => setChevronVisible(window.scrollY < 100);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <section className="relative min-h-[75vh] flex flex-col items-center justify-center px-6 pt-20">
      <div className="max-w-[1200px] mx-auto text-center">
        <h1
          className="font-headline font-extrabold text-4xl sm:text-5xl md:text-6xl lg:text-7xl leading-tight text-text-primary animate-fade-in-up"
        >
          Prove your stack.
        </h1>

        <p
          className="mt-6 max-w-[600px] mx-auto text-lg sm:text-xl text-text-secondary animate-fade-in"
          style={{ animationDelay: "0.15s" }}
        >
          Stop guessing whether your stack is working. SuppVis correlates your
          supplements against how you feel, every day, and shows you the verdict
          in weeks.
        </p>

        <div
          className="mt-8 animate-fade-in"
          style={{ animationDelay: "0.3s" }}
        >
          <a
            href="#waitlist"
            className="inline-flex items-center px-10 py-4.5 rounded-full bg-accent text-bg-primary text-lg font-semibold hover:bg-accent-hover transition-all hover:shadow-[0_0_20px_rgba(20,184,166,0.3)]"
          >
            Get Early Access
          </a>
        </div>

        {/* Trust bar */}
        <div
          className="mt-12 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm text-text-muted animate-fade-in"
          style={{ animationDelay: "0.45s" }}
        >
          <span className="whitespace-nowrap">Brand-Agnostic</span>
          <span className="text-text-muted/40">&middot;</span>
          <a href="/sources" className="whitespace-nowrap hover:text-accent hover:underline underline-offset-4 transition-colors">Evidence-Based</a>
          <span className="text-text-muted/40">&middot;</span>
          <span className="whitespace-nowrap">24,500+ Studies on Supplements</span>
          <span className="text-text-muted/40">&middot;</span>
          <span className="whitespace-nowrap">2,300+ Drug-Supplement Interactions</span>
        </div>

        {/* Scroll indicator */}
        <div
          className={`mt-10 flex justify-center animate-bounce-down transition-opacity duration-500 pointer-events-none md:mt-12 ${
            chevronVisible ? "opacity-100" : "opacity-0"
          }`}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-text-muted"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>
    </section>
  );
}
