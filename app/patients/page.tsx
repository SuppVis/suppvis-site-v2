import type { Metadata } from "next";
import type { ReactNode } from "react";
import Nav from "../components/Nav";
import Footer from "../components/Footer";
import WaitlistClose from "../components/WaitlistClose";
import {
  Reveal,
  SectionDivider,
  SectionHeading,
  TealRule,
  primaryButton,
} from "../components/ui";
import { PATIENT_WAITLIST_ID } from "../lib/site";
import { CareMockup, CheckInMockup } from "./mockups";

// What a patient's day with SuppVis looks like. Primary audience: patients
// whose practice runs SuppVis; the standalone path is secondary. All copy on
// this page is catalogued in docs/MOCKUP_COPY.md for clinical and counsel review.
const TITLE = "For patients - SuppVis";
const DESCRIPTION =
  "SuppVis is where your health lives day to day. One minute a day, everything in one place, and if your practice uses SuppVis, part of your care.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "https://suppvis.health/patients",
    siteName: "SuppVis",
    type: "website",
  },
  alternates: { canonical: "/patients" },
};

const linkClass =
  "text-accent underline decoration-accent/40 underline-offset-4 hover:decoration-accent transition-colors";

type Tile = { title: string; body: ReactNode };

const HUB: Tile[] = [
  {
    title: "Your plan and reminders.",
    body: "The schedule you and your practitioner set, in one place. Reminders follow your schedule, at the times you choose, and you can change them or turn them off.",
  },
  {
    title: "Knowledge you can trust.",
    body: (
      <>
        Research-backed deep dives for the supplements you take, drawn from the{" "}
        <a href="/research" className={linkClass}>
          public library of 33,000+ peer-reviewed studies
        </a>
        .
      </>
    ),
  },
  {
    title: "Your bloodwork over time.",
    body: "Lab results trended across draws, shown exactly as your lab reported them. What they mean is a conversation with your practitioner.",
  },
  {
    title: "Your goals and what moves them.",
    body: "Daily scores across your goals, and what in your record is associated with the changes. Labeled as associations, not causes.",
  },
  {
    title: "Your biometrics.",
    body: "Sleep, HRV, and activity from the wearables you already use, alongside everything you log.",
  },
  {
    // Safety statement: flagged for clinical review in docs/MOCKUP_COPY.md.
    title: "Checked for safety.",
    body: "Everything you log is screened against your medications, and anything worth discussing is flagged for you and your practitioner.",
  },
];

export default function PatientsPage() {
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
          <div className="relative max-w-[820px] mx-auto text-center">
            <h1 className="font-headline font-extrabold text-4xl sm:text-5xl md:text-6xl lg:text-7xl text-text-primary leading-[1.05] tracking-tight">
              Where your health lives, day to day.
            </h1>
            <p className="mt-8 max-w-[620px] mx-auto text-lg md:text-xl text-text-secondary leading-relaxed">
              What you take, what you do, and how you feel, in one place. One
              minute a day.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <a href={`#${PATIENT_WAITLIST_ID}`} className={primaryButton}>
                Get Early Access
              </a>
              <a
                href="#part-of-your-care"
                className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
              >
                See how it works &darr;
              </a>
            </div>
          </div>
        </section>

        {/* Part of your care */}
        <section id="part-of-your-care" className="relative py-24 md:py-32 px-6 scroll-mt-20">
          <SectionDivider />
          <div className="max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-12 lg:gap-20 items-center">
            <div>
              <TealRule />
              <SectionHeading>Part of your care.</SectionHeading>
              <Reveal delay={0.1}>
                <div className="mt-6 space-y-4 text-lg text-text-secondary leading-relaxed">
                  <p>
                    If your practitioner&apos;s practice uses SuppVis, joining is
                    part of getting care. Your practice sets you up. You download
                    the app and accept your practice&apos;s invitation.
                  </p>
                  <p>
                    From there, your daily record builds. Your practitioner walks
                    into each visit already current on how the weeks went,
                    instead of starting from what you can remember.
                  </p>
                  <p>You can always see everything in your own record.</p>
                </div>
              </Reveal>
            </div>
            <Reveal delay={0.15}>
              <CareMockup />
            </Reveal>
          </div>
        </section>

        {/* Your day */}
        <section id="your-day" className="relative py-24 md:py-32 px-6 bg-bg-secondary/40 scroll-mt-20">
          <SectionDivider />
          <div className="max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div className="lg:order-2">
              <TealRule />
              <SectionHeading>Your day.</SectionHeading>
              <Reveal delay={0.1}>
                <div className="mt-6 space-y-4 text-lg text-text-secondary leading-relaxed">
                  <p>
                    The check-in takes under a minute. Check off what you took
                    and what you did. Score how you feel. Note anything out of
                    the ordinary.
                  </p>
                  <p>
                    Then answer one question:{" "}
                    <span className="text-text-primary font-medium">
                      &ldquo;Did you do anything different today?&rdquo;
                    </span>{" "}
                    A trip, a new food, a hard week, a short night. That is
                    usually the part everyone forgets.
                  </p>
                </div>
              </Reveal>
            </div>
            <Reveal delay={0.15} className="lg:order-1">
              <CheckInMockup />
            </Reveal>
          </div>
        </section>

        {/* Your hub */}
        <section id="your-hub" className="relative py-24 md:py-32 px-6 scroll-mt-20">
          <SectionDivider />
          <div className="max-w-[1200px] mx-auto">
            <div className="max-w-[760px]">
              <TealRule />
              <SectionHeading>Your hub.</SectionHeading>
              <Reveal delay={0.1}>
                <p className="mt-6 text-lg text-text-secondary leading-relaxed">
                  Beyond the check-in, the app keeps the rest of your health in
                  one place. We don&apos;t sell supplements, and no company pays
                  to influence what you see.
                </p>
              </Reveal>
            </div>
            <div className="mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {HUB.map((t, i) => (
                <Reveal key={t.title} delay={0.1 + i * 0.06}>
                  <div className="h-full rounded-3xl bg-bg-secondary border border-white/5 p-8">
                    <h3 className="font-headline font-bold text-lg text-text-primary mb-3">{t.title}</h3>
                    <p className="text-[15px] text-text-secondary leading-relaxed">{t.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Standalone path (secondary). Handoff is not built: keep future tense, no dates. */}
        <section id="on-your-own" className="relative py-24 md:py-32 px-6 bg-bg-secondary/40 scroll-mt-20">
          <SectionDivider />
          <div className="max-w-[760px] mx-auto">
            <TealRule />
            <SectionHeading>On your own, too.</SectionHeading>
            <Reveal delay={0.1}>
              <div className="mt-6 space-y-4 text-lg text-text-secondary leading-relaxed">
                <p>
                  If your practice doesn&apos;t use SuppVis, the app works on its
                  own. Same check-in, same hub, same record.
                </p>
                <p>
                  We&apos;re building a clinical handoff: a summary of your record
                  you&apos;ll be able to print or send, so any doctor you see can
                  get the full picture of what you&apos;ve been doing.
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Beta waitlist: existing form and handler, anchor #waitlist */}
        <WaitlistClose />
      </main>
      <Footer />
    </>
  );
}
