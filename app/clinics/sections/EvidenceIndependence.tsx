import { Reveal, SectionDivider, SectionHeading, TealRule } from "../ui";

export function EvidenceHonesty() {
  return (
    <section className="relative py-24 md:py-32 px-6 bg-bg-secondary/40">
      <SectionDivider />
      <div className="max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-10 lg:gap-20">
        <div>
          <TealRule />
          <SectionHeading>Built on evidence. Honest about uncertainty.</SectionHeading>
        </div>
        <Reveal delay={0.1}>
          <p className="text-lg text-text-secondary leading-relaxed">
            Every line in the brief links back to the log or record it came
            from. The AI writes the sentences, never the facts. Every insight
            traces to a research library of 33,000+ peer-reviewed studies,
            browsable publicly at{" "}
            <a
              href="/research"
              className="text-accent underline decoration-accent/40 underline-offset-4 hover:decoration-accent transition-colors"
            >
              suppvis.health/research
            </a>
            . Associations are labeled as associations, never causes. And when
            the record isn&apos;t sufficient to say something, SuppVis says so,
            including on its own safety rules: any flag from a rule still
            awaiting clinical review is labeled unreviewed. You&apos;ve seen tools
            that always have an answer.{" "}
            <span className="text-text-primary font-medium">
              This one tells the truth instead.
            </span>
          </p>
        </Reveal>
      </div>
    </section>
  );
}

export function Independence() {
  return (
    <section className="relative py-24 md:py-32 px-6">
      <SectionDivider />
      <div className="max-w-[900px] mx-auto text-center">
        <SectionHeading>No dispensary. No brand money in recommendations.</SectionHeading>
        <Reveal delay={0.1}>
          <p className="mt-8 text-lg text-text-secondary leading-relaxed">
            SuppVis is brand-agnostic and non-dispensing. We don&rsquo;t sell
            supplements, and no company pays to influence what the platform
            surfaces. Whatever dispensary your practice runs, SuppVis works
            alongside it: you prescribe the protocol, we show you whether
            it&rsquo;s followed and what it&rsquo;s associated with.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

export function WhoItsFor() {
  return (
    <section className="relative py-24 md:py-32 px-6 bg-bg-secondary/40">
      <SectionDivider />
      <div className="max-w-[900px] mx-auto text-center">
        <SectionHeading>Built for the clinicians who take the whole person seriously.</SectionHeading>
        <Reveal delay={0.1}>
          <p className="mt-8 text-lg text-text-secondary leading-relaxed">
            SuppVis serves individual practitioners first: naturopathic doctors,
            integrative and functional MDs and DOs, nurse practitioners.
            Practice-wide plans grow from there.{" "}
            <span className="text-text-primary font-medium">
              If your visits spend their first twenty minutes rebuilding
              history, this was built for you.
            </span>
          </p>
        </Reveal>
      </div>
    </section>
  );
}

export function BoundaryStatement() {
  // Section 13: verbatim, non-negotiable.
  return (
    <section className="px-6 pb-16">
      <div className="max-w-[900px] mx-auto rounded-2xl border border-white/[0.06] bg-bg-secondary/60 px-6 py-6 sm:px-8">
        <p className="text-[13px] text-text-muted leading-relaxed">
          SuppVis provides wellness information and decision support for
          licensed professionals and their patients. It does not diagnose,
          treat, cure, or prevent any disease, and it never replaces clinical
          judgment. Associations shown in SuppVis reflect timing in the
          patient&apos;s own record, not causation. Medication information is
          used for safety screening and analysis context only; SuppVis never
          advises on medications.
        </p>
      </div>
    </section>
  );
}
