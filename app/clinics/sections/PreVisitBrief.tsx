"use client";

import { useEffect, useRef, useState } from "react";
import { Reveal, SectionDivider, SectionHeading, TealRule } from "../ui";
import { BriefBlock, BriefHeader, BRIEF_BLOCKS } from "./BriefMockup";

const CALLOUTS = [
  {
    title: "At a glance.",
    body: "Flagged incidents, the biggest score changes since the last visit, check-in coverage, and open flags, so the likely reasons for the visit surface first.",
  },
  {
    title: "Incidents, and what changed before them.",
    body: "When a patient logs something out of the ordinary, SuppVis looks backward: items started, stopped, or missed; sleep and mood shifts; the patient's own “anything different” notes. It proposes the timing associations around each incident, labeled as associations. Which ones matter is your call.",
  },
  {
    title: "Regimen: plan versus actual.",
    body: "Your treatment plan items stand apart from anything the patient added on their own. Every medication, supplement, and peptide with dose, frequency, and days actually taken. Interactions flagged as logged.",
  },
  {
    title: "The whole person.",
    body: "One row per domain of the patient's life, marked stable or changed, acute or chronic: sleep, nutrition and hydration, movement, mind and mood, substances, environment and cycles, gut, medications and supplements. The determinants a thorough intake covers, pre-assembled from the record.",
  },
  {
    title: "What's supporting them, and what's in the way.",
    body: "The habits and items associated with their better days, and the items most often skipped, the gaps in logging, the barriers they've noted.",
  },
  {
    title: "Questions for the visit.",
    body: "Generated from what the record doesn't show, so intake time goes to the gaps, not to retelling history.",
  },
];

export default function PreVisitBrief() {
  const [active, setActive] = useState(0);
  const [shift, setShift] = useState(0);
  const refs = useRef<(HTMLLIElement | null)[]>([]);
  const viewportRef = useRef<HTMLDivElement>(null);
  const docRef = useRef<HTMLDivElement>(null);

  // Slide the sticky brief so the active block sits near the top of view.
  useEffect(() => {
    const viewport = viewportRef.current;
    const doc = docRef.current;
    if (!viewport || !doc) return;
    const block = doc.children[active] as HTMLElement | undefined;
    if (!block) return;
    const maxShift = Math.max(0, doc.scrollHeight - viewport.clientHeight);
    setShift(Math.min(maxShift, Math.max(0, block.offsetTop - 12)));
  }, [active]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            const i = Number((e.target as HTMLElement).dataset.index);
            setActive(i);
          }
        });
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    refs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <section id="pre-visit-brief" className="relative py-24 md:py-32 px-6 scroll-mt-0">
      <SectionDivider />
      <div
        className="absolute top-1/3 right-0 w-[700px] h-[700px] rounded-full opacity-[0.05] pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(20,184,166,0.6) 0%, transparent 70%)" }}
      />
      <div className="relative max-w-[1200px] mx-auto">
        <div className="max-w-[760px]">
          <TealRule />
          <SectionHeading>The brief reads the way you think.</SectionHeading>
          <Reveal delay={0.1}>
            <p className="mt-6 text-lg text-text-secondary leading-relaxed">
              Before each visit, the portal assembles one document from the
              patient&apos;s record, ordered the way a clinician works a case:
              what&apos;s going on, what changed, what they take, the whole
              person, then what&apos;s still unknown.
            </p>
          </Reveal>
        </div>

        <div className="mt-16 lg:mt-20 grid grid-cols-1 lg:grid-cols-[1fr_1.05fr] gap-12 lg:gap-16">
          {/* Callouts */}
          <ol className="lg:pt-6 lg:pb-[200px] space-y-12 lg:space-y-[200px]">
            {CALLOUTS.map((c, i) => (
              <li
                key={c.title}
                data-index={i}
                ref={(el) => {
                  refs.current[i] = el;
                }}
              >
                <div
                  className={`flex gap-5 transition-opacity duration-500 ${
                    active === i ? "lg:opacity-100" : "lg:opacity-45"
                  }`}
                >
                  <span
                    className={`shrink-0 flex items-center justify-center w-9 h-9 rounded-full font-headline font-bold text-sm transition-colors duration-500 ${
                      active === i
                        ? "bg-accent text-bg-primary"
                        : "bg-accent/10 text-accent"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="font-headline font-bold text-xl md:text-2xl text-text-primary leading-snug">
                      {c.title}
                    </h3>
                    <p className="mt-3 text-[15.5px] text-text-secondary leading-relaxed">{c.body}</p>
                  </div>
                </div>
                {/* Mobile: show the matching brief block inline */}
                <div className="lg:hidden mt-6 rounded-2xl bg-bg-secondary border border-white/[0.06] p-2">
                  <BriefBlock index={i} />
                </div>
              </li>
            ))}
          </ol>

          {/* Desktop: sticky brief document */}
          <div className="hidden lg:block">
            <div className="sticky top-24">
              <div className="rounded-3xl bg-bg-secondary border border-white/[0.06] shadow-2xl shadow-black/40 overflow-hidden">
                <BriefHeader />
                <div ref={viewportRef} className="relative h-[calc(100vh-11rem)] max-h-[720px] overflow-hidden">
                  <div
                    ref={docRef}
                    className="p-3 space-y-2 transition-transform duration-700 ease-out"
                    style={{ transform: `translateY(-${shift}px)` }}
                  >
                    {BRIEF_BLOCKS.map((_, i) => (
                      <BriefBlock key={i} index={i} active={active === i} />
                    ))}
                  </div>
                  <div className="pointer-events-none absolute bottom-0 inset-x-0 h-16 bg-gradient-to-t from-bg-secondary to-transparent" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <Reveal className="mt-20 lg:mt-28 max-w-[860px] mx-auto text-center">
          <p className="font-headline font-bold text-2xl md:text-3xl text-text-primary leading-snug">
            The brief stops where clinical judgment starts.{" "}
            <span className="text-accent">Diagnosis and the treatment plan stay with you.</span>
          </p>
        </Reveal>
      </div>
    </section>
  );
}
