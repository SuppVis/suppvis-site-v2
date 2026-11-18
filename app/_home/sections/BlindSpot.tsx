import { Reveal, SectionDivider, SectionHeading, TealRule } from "@/app/components/ui";

const CARDS = [
  {
    title: "Every day captured",
    body: "supplements, medications, habits, food, incidents, biometrics, and daily scores",
    icon: (
      <path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM9 16l2 2 4-4" />
    ),
  },
  {
    title: "Screened continuously",
    body: "every logged combination checked against our clinically reviewed interaction library",
    icon: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4" />,
  },
  {
    title: "Grounded in evidence",
    body: "33,000+ peer-reviewed studies behind the platform, browsable publicly",
    icon: (
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15z" />
    ),
  },
];

export default function BlindSpot() {
  return (
    <section className="relative py-24 md:py-32 px-6">
      <SectionDivider />
      <div className="max-w-[1200px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-10 lg:gap-20">
          <div>
            <TealRule />
            <SectionHeading>A visit is a snapshot. A condition is a film.</SectionHeading>
          </div>
          <Reveal delay={0.1}>
            <p className="text-lg text-text-secondary leading-relaxed">
              Patients forget. They under-report. They don&apos;t connect the
              supplement they started in week two with the symptom that
              appeared in week three. By the time they&apos;re in your office, a
              month of signal has collapsed into &ldquo;I think it was worse a
              couple weeks ago.&rdquo; You take history from recall.{" "}
              <span className="text-text-primary font-medium">
                SuppVis replaces recall with record.
              </span>
            </p>
          </Reveal>
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-4">
          {CARDS.map((c, i) => (
            <Reveal key={c.title} delay={i * 0.1}>
              <div className="h-full rounded-3xl bg-bg-secondary border border-white/5 p-7 sm:p-8 hover:border-accent/20 transition-colors">
                <div className="w-11 h-11 rounded-xl bg-accent/10 flex items-center justify-center mb-6">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#14B8A6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    {c.icon}
                  </svg>
                </div>
                <h3 className="font-headline font-bold text-xl text-text-primary">{c.title}</h3>
                <p className="mt-3 text-[15px] text-text-secondary leading-relaxed">
                  {c.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
