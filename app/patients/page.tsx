import type { Metadata } from "next";
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
import { CheckInMockup, SharingMockup } from "./mockups";

// All non-spec copy on this page is catalogued in docs/MOCKUP_COPY.md.
const TITLE = "For patients - SuppVis";
const DESCRIPTION =
  "A lot happens between appointments. SuppVis keeps the record for you, in about a minute a day, and you choose who sees it.";

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

const GET_BACK = [
  {
    title: "Your days, in order.",
    body: "What you took, what you did, and how you felt, kept day by day instead of pieced together from memory.",
  },
  {
    title: "Patterns from your own record.",
    body: "SuppVis points out timing patterns in your own days and labels them as patterns. Not promises, and not conclusions.",
  },
  {
    title: "A history you can share.",
    body: "When you see your practitioner, you can share the record instead of trying to remember it.",
  },
];

const APP_TILES = [
  {
    title: "Your plan, and your extras.",
    body: "After a visit, your practitioner's plan shows up in the app with each item marked. Anything you add yourself is kept as an extra, so the record stays honest.",
  },
  {
    title: "Your devices fill in the rest.",
    body: "Sleep, HRV, and activity from the wearable you already use, plus Apple Health, so you log less.",
  },
  {
    title: "Screened as you log.",
    body: "Each combination you log is checked against a clinically reviewed interaction library. If something is flagged, bring it to your care team.",
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
              A lot happens between appointments.
            </h1>
            <p className="mt-8 max-w-[620px] mx-auto text-lg md:text-xl text-text-secondary leading-relaxed">
              You remember some of it. By the time you sit down with your
              practitioner, most of it is gone. SuppVis keeps the record for
              you, in about a minute a day.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <a href={`#${PATIENT_WAITLIST_ID}`} className={primaryButton}>
                Get Early Access
              </a>
              <a
                href="#a-minute-a-day"
                className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
              >
                See how it works &darr;
              </a>
            </div>
          </div>
        </section>

        {/* The minute a day */}
        <section id="a-minute-a-day" className="relative py-24 md:py-32 px-6 scroll-mt-20">
          <SectionDivider />
          <div className="max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div>
              <TealRule />
              <SectionHeading>One minute a day.</SectionHeading>
              <Reveal delay={0.1}>
                <div className="mt-6 space-y-4 text-lg text-text-secondary leading-relaxed">
                  <p>
                    Open the app once a day. Check off what you took and what you
                    did. Score how you feel. Note anything out of the ordinary.
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
            <Reveal delay={0.15}>
              <CheckInMockup />
            </Reveal>
          </div>
        </section>

        {/* What you get back */}
        <section className="relative py-24 md:py-32 px-6 bg-bg-secondary/40">
          <SectionDivider />
          <div className="max-w-[1200px] mx-auto">
            <div className="max-w-[760px]">
              <TealRule />
              <SectionHeading>What you get back.</SectionHeading>
              <Reveal delay={0.1}>
                <p className="mt-6 text-lg text-text-secondary leading-relaxed">
                  A few weeks in, you have something most people never get: a
                  clear record of your own days.
                </p>
              </Reveal>
            </div>
            <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-6">
              {GET_BACK.map((t, i) => (
                <Reveal key={t.title} delay={0.1 + i * 0.08}>
                  <div className="h-full rounded-3xl bg-bg-secondary border border-white/5 p-8">
                    <h3 className="font-headline font-bold text-lg text-text-primary mb-3">{t.title}</h3>
                    <p className="text-[15px] text-text-secondary leading-relaxed">{t.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* You own your account */}
        <section className="relative py-28 md:py-40 px-6 overflow-hidden">
          <SectionDivider />
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] rounded-full opacity-[0.06] pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(20,184,166,0.5) 0%, transparent 70%)" }}
          />
          <div className="relative max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-12 lg:gap-20 items-center">
            <div>
              <TealRule />
              <SectionHeading>Your account is yours.</SectionHeading>
              <Reveal delay={0.1}>
                <div className="mt-6 space-y-4 text-lg text-text-secondary leading-relaxed">
                  <p>
                    Not your practitioner&apos;s. Not a clinic&apos;s. You own your
                    SuppVis account.
                  </p>
                  <p>
                    You choose whether to share it, and with whom, using an
                    invite code. You can stop sharing at any time.
                  </p>
                  <p>
                    We don&apos;t sell supplements, and no company pays to
                    influence what you see.
                  </p>
                </div>
              </Reveal>
            </div>
            <Reveal delay={0.15}>
              <SharingMockup />
            </Reveal>
          </div>
        </section>

        {/* The app */}
        <section className="relative py-24 md:py-32 px-6 bg-bg-secondary/40">
          <SectionDivider />
          <div className="max-w-[1200px] mx-auto">
            <div className="max-w-[760px]">
              <TealRule />
              <SectionHeading>The app.</SectionHeading>
              <Reveal delay={0.1}>
                <p className="mt-6 text-lg text-text-secondary leading-relaxed">
                  SuppVis is an iOS app. It keeps supplements, medications,
                  habits, and how you feel in one place. Every insight links to
                  the research behind it, in a{" "}
                  <a href="/research" className={linkClass}>
                    public library of 33,000+ peer-reviewed studies
                  </a>
                  , covering 453 supplements and 89 research-backed habits.
                </p>
              </Reveal>
            </div>
            <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-6">
              {APP_TILES.map((t, i) => (
                <Reveal key={t.title} delay={0.1 + i * 0.08}>
                  <div className="h-full rounded-3xl bg-bg-secondary border border-white/5 p-8">
                    <h3 className="font-headline font-bold text-lg text-text-primary mb-3">{t.title}</h3>
                    <p className="text-[15px] text-text-secondary leading-relaxed">{t.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Beta waitlist: existing form and handler, anchor #waitlist */}
        <WaitlistClose />
      </main>
      <Footer />
    </>
  );
}
