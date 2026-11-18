import { BOOK_DEMO_HREF, FOUNDING_FORM_ID } from "@/app/lib/site";
import FoundingPracticeForm from "../FoundingPracticeForm";
import { Reveal, SectionDivider, SectionHeading, primaryButton, secondaryButton } from "@/app/components/ui";

export default function ClinicsCta() {
  return (
    <section className="relative py-24 md:py-32 px-6">
      <SectionDivider />
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] opacity-[0.06] pointer-events-none"
        style={{ background: "radial-gradient(ellipse, rgba(20,184,166,0.6) 0%, transparent 70%)" }}
      />
      <div className="relative max-w-[760px] mx-auto text-center">
        <SectionHeading>Open your next visit with the brief.</SectionHeading>
        <Reveal delay={0.1}>
          <p className="mt-6 text-lg text-text-secondary leading-relaxed">
            SuppVis is partnering with a small group of founding practices.
            Demos are live; founding spots are limited.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href={BOOK_DEMO_HREF} className={primaryButton}>
              Book a demo
            </a>
            <a href={`#${FOUNDING_FORM_ID}`} className={secondaryButton}>
              Join the founding practices
            </a>
          </div>
        </Reveal>

        <div id={FOUNDING_FORM_ID} className="scroll-mt-28 mt-16">
          <Reveal delay={0.15}>
            <div className="relative rounded-3xl bg-bg-secondary border border-accent/15 p-6 sm:p-10">
              <FoundingPracticeForm />
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
