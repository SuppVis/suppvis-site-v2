import { Reveal, SectionDivider, SectionHeading, TealRule } from "../ui";

const TILES = [
  {
    title: "Your plan, tagged.",
    body: "After a visit, the treatment plan lives in the app with every item marked as yours. The patient follows it or doesn't, and you see which. Anything they add on their own is tracked separately as an extra.",
    icon: <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82zM7 7h.01" />,
  },
  {
    title: "Their data flows in.",
    body: "Wearable biometrics (sleep, HRV, activity) and Apple Health data fill the record automatically, so the patient logs less and the brief sees more.",
    icon: <path d="M22 12h-4l-3 9L9 3l-3 9H2" />,
  },
  {
    // Privacy model under counsel review: keep this framing exactly.
    title: "They stay in control.",
    body: "The patient owns their SuppVis account and chooses to share it with you by invite code. They can stop sharing at any time.",
    icon: (
      <path d="M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2zM7 11V7a5 5 0 0 1 10 0v4" />
    ),
  },
];

export default function PatientSide() {
  return (
    <section className="relative py-24 md:py-32 px-6 bg-bg-secondary/40">
      <SectionDivider />
      <div className="max-w-[1200px] mx-auto">
        <div className="max-w-[820px]">
          <TealRule />
          <SectionHeading>Simple enough that patients actually do it.</SectionHeading>
          <Reveal delay={0.1}>
            <p className="mt-6 text-lg text-text-secondary leading-relaxed">
              Patients use the SuppVis app: a daily check-in that takes under a
              minute. They log what they take and what they do, score how they
              feel against their goals, note anything out of the ordinary with a
              severity and a note, and answer one question that catches what
              every intake misses:{" "}
              <span className="text-text-primary font-medium">
                &ldquo;Did you do anything different today?&rdquo;
              </span>{" "}
              Travel, a new food, a brutal week at work, a missed night of
              sleep. The variation that explains change.
            </p>
          </Reveal>
        </div>

        <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-4">
          {TILES.map((t, i) => (
            <Reveal key={t.title} delay={i * 0.1}>
              <div className="h-full rounded-3xl bg-bg-primary border border-white/5 p-7 sm:p-8">
                <div className="w-11 h-11 rounded-xl bg-accent/10 flex items-center justify-center mb-6">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#14B8A6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    {t.icon}
                  </svg>
                </div>
                <h3 className="font-headline font-bold text-xl text-text-primary">{t.title}</h3>
                <p className="mt-3 text-[15px] text-text-secondary leading-relaxed">{t.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
