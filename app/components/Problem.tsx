"use client";

import { useScrollReveal } from "../hooks/useScrollReveal";

const cards = [
  {
    stat: "$69.3B",
    text: "spent by Americans on dietary supplements in 2024. Most of it on stacks no one verified would work for the person taking them.",
    href: "https://www.nutraceuticalsworld.com/exclusives/the-state-of-supplements-u-s-market-approaches-70-billion/",
  },
  {
    stat: "1 in 3",
    text: "U.S. adults takes a prescription medication alongside a dietary supplement. Most have never checked whether the combination is safe.",
    href: "https://pubmed.ncbi.nlm.nih.gov/24703929/",
  },
  {
    stat: "Only 26.9%",
    text: "of supplements Americans take were recommended by a doctor. The rest came from ads, influencers, or guesswork.",
    href: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11206876/",
  },
  {
    stat: "16%",
    text: "of U.S. adults take four or more supplements daily. Few can tell you which ones are actually helping.",
    href: "https://pubmed.ncbi.nlm.nih.gov/41128907/",
  },
];

export default function Problem() {
  const headerRef = useScrollReveal();
  const bridgeRef = useScrollReveal(0.4);

  return (
    <section id="how-it-works" className="py-24 md:py-32 px-6">
      <div className="max-w-[1200px] mx-auto">
        <h2
          ref={headerRef}
          className="scroll-reveal font-headline font-bold text-3xl sm:text-4xl md:text-5xl text-center text-text-primary mb-16"
        >
          The supplement industry wasn&rsquo;t built for you.
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {cards.map((card, i) => (
            <ProblemCard
              key={i}
              stat={card.stat}
              text={card.text}
              href={card.href}
              delay={i * 0.1}
            />
          ))}
        </div>

        <p
          ref={bridgeRef}
          className="scroll-reveal font-headline text-xl md:text-2xl text-text-primary text-center mt-14"
        >
          Whether you&rsquo;re managing a supplement stack, a prescription,
          hormone therapy, or just building better habits, SuppVis works the
          same way: track it, feel it, prove it.
        </p>
      </div>
    </section>
  );
}

function ProblemCard({
  stat,
  text,
  href,
  delay,
}: {
  stat: string;
  text: string;
  href: string;
  delay: number;
}) {
  const ref = useScrollReveal<HTMLAnchorElement>(delay);

  return (
    <a
      ref={ref}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="scroll-reveal rounded-2xl bg-bg-secondary border border-white/5 p-8 md:p-10 block group relative hover:border-white/10 hover:-translate-y-0.5 transition-all duration-200"
    >
      <span className="absolute top-4 right-4 text-xs text-text-muted opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex items-center gap-1">
        Source
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 17L17 7M17 7H8M17 7V16"/>
        </svg>
      </span>
      <p className="text-text-secondary text-lg leading-relaxed">
        <span className="text-accent font-headline font-bold text-2xl md:text-3xl">
          {stat}
        </span>{" "}
        {text}
      </p>
    </a>
  );
}
