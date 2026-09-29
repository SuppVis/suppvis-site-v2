export default function ResearchMethodology() {
  const steps = [
    {
      number: "01",
      title: "Curate",
      body: "We pull articles on supplements and habits from peer-reviewed sources, prioritizing randomized controlled trials, meta-analyses, and systematic reviews.",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      ),
    },
    {
      number: "02",
      title: "Classify",
      body: "Every article is read and classified by subject, study quality, and findings. Off-topic and ambiguous papers are filtered out.",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 7h18M3 12h18M3 17h12" />
        </svg>
      ),
    },
    {
      number: "03",
      title: "Link",
      body: "Findings are mapped to specific supplements, habits, and outcomes, so when we surface an insight, the evidence is one click away.",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
        </svg>
      ),
    },
  ];

  return (
    <section className="py-24 px-6 border-t border-white/5">
      <div className="max-w-[1200px] mx-auto">
        <div className="max-w-[700px] mb-20">
          <p className="text-sm font-medium text-accent uppercase tracking-widest mb-4">
            How we use research
          </p>
          <h2 className="font-headline font-bold text-3xl sm:text-4xl md:text-5xl text-text-primary leading-tight">
            From paper to product, with no shortcuts.
          </h2>
        </div>

        <div className="relative">
          {/* Connecting line on desktop */}
          <div
            className="hidden md:block absolute top-6 left-[8%] right-[8%] h-px bg-gradient-to-r from-accent/0 via-accent/30 to-accent/0 pointer-events-none"
            aria-hidden="true"
          />

          <div className="grid md:grid-cols-3 gap-12 lg:gap-16 relative">
            {steps.map((step) => (
              <div key={step.number} className="relative">
                {/* Icon circle */}
                <div className="relative mb-8">
                  <div className="w-12 h-12 rounded-full bg-bg-secondary border border-accent/30 flex items-center justify-center text-accent">
                    {step.icon}
                  </div>
                </div>

                <div className="font-headline font-bold text-xs text-accent tracking-widest mb-3">
                  {step.number}
                </div>
                <h3 className="font-headline font-bold text-2xl text-text-primary mb-4">
                  {step.title}
                </h3>
                <p className="text-text-secondary leading-relaxed">
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
