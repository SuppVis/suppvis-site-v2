import { Reveal, SectionDivider, SectionHeading, TealRule } from "@/app/components/ui";

// Spec section 11A: the commercial model in three steps. Copy is verbatim from
// the clinic-contract update; catalogued in docs/MOCKUP_COPY.md.
const STEPS = [
  {
    title: "Partner with SuppVis.",
    body: "Your practice signs on and gets the portal.",
  },
  {
    title: "Bring your patients on.",
    body: "You enroll patients as part of their care; their daily record starts building immediately.",
  },
  {
    title: "Walk in current.",
    body: "Every visit opens with the pre-visit brief instead of history-taking.",
  },
];

export default function PracticeSteps() {
  return (
    <section id="how-it-works" className="relative py-24 md:py-32 px-6 scroll-mt-20">
      <SectionDivider />
      <div className="max-w-[1200px] mx-auto">
        <div className="max-w-[820px]">
          <TealRule />
          <SectionHeading>How it works with your practice</SectionHeading>
        </div>

        <ol className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-4">
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <Reveal delay={i * 0.1} className="h-full rounded-3xl bg-bg-secondary border border-white/5 p-7 sm:p-8">
                <span className="font-headline font-bold text-sm tracking-[0.15em] text-accent tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-5 font-headline font-bold text-xl text-text-primary">{s.title}</h3>
                <p className="mt-3 text-[15px] text-text-secondary leading-relaxed">{s.body}</p>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
