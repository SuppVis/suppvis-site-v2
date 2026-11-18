import { Reveal, SectionDivider, SectionHeading, TealRule } from "@/app/components/ui";

// Publish gate 3: before go-live, every tile is verified against the live demo
// build. Anything not demonstrable comes off the page.
const LAYERS = [
  {
    title: "Supplements and stacks.",
    body: "Full products, real doses, brands and blends resolved. Plan versus actual, day by day.",
    icon: <path d="M10.5 20.5l10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7zM8.5 8.5l7 7" />,
  },
  {
    // Exact framing non-negotiable.
    title: "Medications.",
    body: "Logged and screened against supplements for interactions. SuppVis never advises on medications; it gives you the complete list and the flags.",
    icon: <path d="M9 2h6M10 2v3M14 2v3M7 5h10a1 1 0 0 1 1 1v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6a1 1 0 0 1 1-1zM9 13h6M12 10v6" />,
  },
  {
    title: "Habits and lifestyle.",
    body: "Research-backed habits, goal-mapped, with wearable-detected activity filling the record automatically.",
    icon: <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 6v6l4 2" />,
  },
  {
    title: "Incidents and daily scores.",
    body: "Symptoms and out-of-the-ordinary events with severity and context, plus daily scores across the patient's goals: the subjective baseline everything else is read against.",
    icon: <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01" />,
  },
  {
    title: "Wearable biometrics.",
    body: "Sleep, HRV, and activity from the devices patients already wear, alongside the logged record.",
    icon: <path d="M9 3h6l1 4H8l1-4zM9 21h6l1-4H8l1 4zM6 7h12v10H6zM10 12h1l1-2 1 4 1-2h1" />,
  },
  {
    title: "Bloodwork over time.",
    body: "Lab results trended across draws, shown exactly as the patient's lab reported them, never recomputed, with the logged record alongside. When a patient switches labs, the portal notes why values may not be comparable.",
    icon: <path d="M9 2v6L4 18a3 3 0 0 0 2.7 4h10.6A3 3 0 0 0 20 18L15 8V2M8 2h8M7 15h10" />,
  },
  {
    title: "Food log.",
    body: "What they ate and when, so diet changes show up next to what followed them.",
    icon: <path d="M3 2v7c0 1.1.9 2 2 2h2a2 2 0 0 0 2-2V2M6 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zM21 15v7" />,
  },
  {
    title: "Cycle tracking.",
    body: "Period, flow, and cycle day on the timeline for patients who choose it, read from Apple Health where they already track it, so symptoms and scores line up with the cycle.",
    icon: <path d="M21 12a9 9 0 1 1-3-6.7M21 4v5h-5" />,
  },
];

export default function DataLayers() {
  return (
    <section className="relative py-24 md:py-32 px-6 bg-bg-secondary/40">
      <SectionDivider />
      <div className="max-w-[1200px] mx-auto">
        <div className="max-w-[760px]">
          <TealRule />
          <SectionHeading>Everything that moves a patient, in one record.</SectionHeading>
        </div>
        <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {LAYERS.map((l, i) => (
            <Reveal key={l.title} delay={(i % 4) * 0.08}>
              <div className="h-full rounded-3xl bg-bg-primary border border-white/5 p-6 sm:p-7 hover:border-accent/20 transition-colors">
                <div className="flex items-center justify-between mb-6">
                  <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#14B8A6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      {l.icon}
                    </svg>
                  </div>
                  <span className="font-headline font-bold text-sm text-text-muted/70 tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="font-headline font-bold text-lg text-text-primary">{l.title}</h3>
                <p className="mt-2.5 text-[14.5px] text-text-secondary leading-relaxed">{l.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
