import type { Metadata } from "next";
import type { ReactNode } from "react";
import Nav from "../components/Nav";
import Footer from "../components/Footer";
import PortalFrame from "../components/PortalFrame";
import {
  Reveal,
  SectionDivider,
  SectionHeading,
  TealRule,
  primaryButton,
  secondaryButton,
} from "../components/ui";
import { BOOK_DEMO_HREF, FOUNDING_FORM_HREF } from "../lib/site";

// All copy on this page is catalogued in docs/MOCKUP_COPY.md for clinical and
// counsel review. Each PortalFrame is a placeholder until real portal captures
// exist; pass `src` to swap one in.
const TITLE = "How the portal works - SuppVis";
const DESCRIPTION =
  "A full roster and no time to prepare. The SuppVis portal gives you one page per patient, so you walk into each visit current.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "https://suppvis.health/portal",
    siteName: "SuppVis",
    type: "website",
  },
  alternates: { canonical: "/portal" },
};

const linkClass =
  "text-accent underline decoration-accent/40 underline-offset-4 hover:decoration-accent transition-colors";

type Section = {
  id: string;
  heading: string;
  body: ReactNode;
  caption: string;
};

const SECTIONS: Section[] = [
  {
    id: "roster",
    heading: "Your roster",
    body: (
      <>
        <p>
          Your day starts with a list of names and very little else. Who checked
          in this month? Who went quiet? Who added something new?
        </p>
        <p>
          The roster answers that in one view. Every patient your practice has
          enrolled, with recent check-in coverage and open flags beside each
          name.
        </p>
      </>
    ),
    caption: "The roster: every enrolled patient, with coverage and open flags.",
  },
  {
    id: "brief",
    heading: "The pre-visit brief",
    body: (
      <>
        <p>
          Before each visit, the portal assembles one brief from the
          patient&apos;s record, ordered the way you work a case. See the{" "}
          <a href="/#pre-visit-brief" className={linkClass}>
            full walkthrough of the brief
          </a>{" "}
          on the practices page.
        </p>
      </>
    ),
    caption: "A pre-visit brief, opened from the roster.",
  },
  {
    id: "plan-versus-actual",
    heading: "Plan versus actual",
    body: (
      <>
        <p>
          You write a protocol. Then you wait a month to hear how it went, and
          what you hear is a guess.
        </p>
        <p>
          The portal sets your plan beside what the patient actually took, day
          by day, with dose and frequency. Anything they added on their own sits
          apart, marked as an extra.
        </p>
      </>
    ),
    caption: "Your plan items beside days actually taken, with extras kept separate.",
  },
  {
    id: "interaction-flags",
    heading: "Interaction flags",
    body: (
      <>
        <p>
          Patients add things between visits. You often hear about it late, or
          not at all.
        </p>
        <p>
          Every logged combination is screened against a clinically reviewed
          interaction library and flagged as it is logged. Any flag from a rule
          still awaiting clinical review is labeled unreviewed. What a flag
          means for the patient is your call.
        </p>
      </>
    ),
    caption: "A flag on a newly logged item, with its review status shown.",
  },
  {
    id: "timeline",
    heading: "The timeline",
    body: (
      <>
        <p>
          Recall collapses a month into one sentence. The timeline keeps it in
          order.
        </p>
        <p>
          Items started, stopped, and missed. Incidents with severity and the
          patient&apos;s notes. Sleep and activity from their wearable. Open it
          when you choose, flag anything, and your flag surfaces at the top of
          their next brief.
        </p>
      </>
    ),
    caption: "One patient's month, in order, with your flags pinned for the next visit.",
  },
  {
    id: "patterns",
    heading: "Patterns and key findings",
    body: (
      <>
        <p>
          Some changes only show up across weeks, and no one has time to read
          weeks of logs.
        </p>
        <p>
          The portal proposes timing associations from the patient&apos;s own
          record, labeled as associations, never causes. Each one links back to
          the entries it came from. Which ones matter is yours to judge.
        </p>
      </>
    ),
    caption: "Proposed associations, each linked to the entries behind it.",
  },
];

function PortalSection({ section, index }: { section: Section; index: number }) {
  const flip = index % 2 === 1;
  return (
    <section
      id={section.id}
      className={`relative py-24 md:py-32 px-6 scroll-mt-20 ${flip ? "bg-bg-secondary/40" : ""}`}
    >
      <SectionDivider />
      <div className="max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-[1fr_1.25fr] gap-10 lg:gap-16 items-center">
        <div className={flip ? "lg:order-2" : ""}>
          <TealRule />
          <SectionHeading>{section.heading}</SectionHeading>
          <Reveal delay={0.1}>
            <div className="mt-6 space-y-4 text-lg text-text-secondary leading-relaxed">
              {section.body}
            </div>
          </Reveal>
        </div>
        <Reveal delay={0.15} className={flip ? "lg:order-1" : ""}>
          <PortalFrame caption={section.caption} />
        </Reveal>
      </div>
    </section>
  );
}

export default function PortalPage() {
  return (
    <>
      <Nav />
      <main>
        {/* Hero */}
        <section className="relative pt-32 pb-20 md:pt-44 md:pb-28 px-6 overflow-hidden">
          <div
            className="absolute top-[30%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[700px] rounded-full opacity-[0.07] pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(20,184,166,0.5) 0%, transparent 70%)" }}
          />
          <div className="relative max-w-[860px] mx-auto text-center">
            <h1 className="font-headline font-extrabold text-4xl sm:text-5xl md:text-6xl lg:text-7xl text-text-primary leading-[1.05] tracking-tight">
              A full roster. No time to prepare.
            </h1>
            <p className="mt-8 max-w-[640px] mx-auto text-lg md:text-xl text-text-secondary leading-relaxed">
              The chart shows what you prescribed, not what happened next. Most
              days there is no time to find out before the door opens. Open one
              page per patient and walk in current.
            </p>
            <div className="mt-10 flex justify-center">
              <a href={BOOK_DEMO_HREF} className={primaryButton}>
                Book a demo
              </a>
            </div>
          </div>
        </section>

        {SECTIONS.map((s, i) => (
          <PortalSection key={s.id} section={s} index={i} />
        ))}

        {/* CTA band */}
        <section className="relative py-24 md:py-32 px-6">
          <SectionDivider />
          <div
            className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] opacity-[0.06] pointer-events-none"
            style={{ background: "radial-gradient(ellipse, rgba(20,184,166,0.6) 0%, transparent 70%)" }}
          />
          <div className="relative max-w-[760px] mx-auto text-center">
            <SectionHeading>See it with your own roster in mind.</SectionHeading>
            <Reveal delay={0.1}>
              <p className="mt-6 text-lg text-text-secondary leading-relaxed">
                Book a demo and we&apos;ll walk through the portal with you. Or
                join the founding practices and we&apos;ll reach out.
              </p>
              <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                <a href={BOOK_DEMO_HREF} className={primaryButton}>
                  Book a demo
                </a>
                <a href={FOUNDING_FORM_HREF} className={secondaryButton}>
                  Join the founding practices
                </a>
              </div>
            </Reveal>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
