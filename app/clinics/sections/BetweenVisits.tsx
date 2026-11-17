import { Reveal, SectionDivider, SectionHeading, TealRule } from "../ui";

// Counsel reviews this section alongside the sharing model before publish:
// alert design touches standard-of-care expectations. Keep the alert scope
// narrow and the clinician in control.

function AlertChoice() {
  const options = ["All activity", "Safety only", "None"];
  return (
    <div className="rounded-3xl bg-bg-secondary border border-white/[0.06] p-6 sm:p-8 shadow-xl shadow-black/20">
      <p className="text-[10px] uppercase tracking-[0.15em] text-text-muted">Alerts</p>
      <div role="presentation" className="mt-4 grid grid-cols-3 gap-1 rounded-full bg-bg-primary border border-white/[0.06] p-1">
        {options.map((o) => (
          <span
            key={o}
            className={`text-center rounded-full py-2 text-[12px] sm:text-[13px] font-semibold ${
              o === "Safety only" ? "bg-accent text-bg-primary" : "text-text-muted"
            }`}
          >
            {o}
          </span>
        ))}
      </div>
      <div className="mt-6 rounded-2xl border border-white/[0.06] bg-bg-primary/60 p-4">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-warning" />
          <span className="text-[12px] font-semibold text-text-primary">Safety alert</span>
        </div>
        <p className="mt-2 text-[12.5px] text-text-secondary leading-snug">
          New patient-added item interacts with a current item. Flagged for your
          review.
        </p>
      </div>
      <div className="mt-3 rounded-2xl border border-dashed border-accent/25 p-4">
        <div className="flex items-center gap-2">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#14B8A6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7" />
          </svg>
          <span className="text-[12px] font-semibold text-accent">Your flag</span>
        </div>
        <p className="mt-2 text-[12.5px] text-text-secondary leading-snug">
          Ask about the logging gap. Surfaces at the top of the next brief.
        </p>
      </div>
    </div>
  );
}

export default function BetweenVisits() {
  return (
    <section className="relative py-24 md:py-32 px-6">
      <SectionDivider />
      <div className="max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-12 lg:gap-20 items-center">
        <div>
          <TealRule />
          <SectionHeading>A window, not another inbox.</SectionHeading>
          <Reveal delay={0.1}>
            <p className="mt-6 text-lg text-text-secondary leading-relaxed">
              Between visits, the portal is a window into how the patient is
              actually doing, not a control panel and not a monitoring
              obligation. Open any patient&apos;s timeline when you choose, flag
              anything for the next visit, and your flags surface at the top of
              their next brief. Alerts are your choice: all activity, safety
              only, or none. Safety alerts fire on one thing only: the patient
              adds something that interacts or is contraindicated with what they
              already take.{" "}
              <span className="text-text-primary font-medium">
                Stepping in between visits is reserved for danger.
              </span>
            </p>
          </Reveal>
        </div>
        <Reveal delay={0.15}>
          <AlertChoice />
        </Reveal>
      </div>
    </section>
  );
}
