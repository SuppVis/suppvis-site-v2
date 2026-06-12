"use client";

import { useScrollReveal } from "../../hooks/useScrollReveal";

const founders = [
  {
    initial: "T",
    photo: "/tan.supp.png",
    name: "Tanner Haslinger",
    title: "CEO / Co-Founder",
    paragraphs: [
      "In 2021, I was diagnosed with Type 1 diabetes. It changed everything about how I think about my body.",
      "Living with T1D means making over 180+ health decisions a day that most people never have to think about. Every meal, every workout, every supplement gets calculated. There are no days off from managing your own biology.",
      "That level of awareness made one thing obvious: most people have no idea if their supplements are actually doing anything. They\u2019re spending hundreds of dollars a month on faith. I was one of them.",
      "We built SuppVis because I needed a system that would show me, with real data, what was working and what was wasting my time and money. Not what a brand told me. Not what an influencer promoted. What my own body confirmed.",
    ],
  },
  {
    initial: "C",
    photo: "/conhead2.png",
    name: "Connor Haslinger",
    title: "COO / Co-Founder",
    paragraphs: [
      "I started in food science at Cal Poly San Luis Obispo, where I earned my BS in 2024. I left frustrated. The curriculum kept telling me the only way to feed people was with stripped and enriched processed foods, sprayed with pesticides and herbicides to make the system work. The answers were built around convenience, not truth.",
      "That restlessness led me to naturopathic medicine. I\u2019m currently at Bastyr University, class of 2028, training in a philosophy that matched how I see the world: find the root cause, don\u2019t just manage the symptom.",
      'In naturopathic medicine, \u201cVis\u201d refers to the body\u2019s vital force. The biological intelligence that governs the balance between resilience and vulnerability. It\u2019s the force that either sets your limits or shatters them.',
      "That\u2019s where SuppVis gets its name. And its purpose.",
      "The deeper I get into clinical training, the more I see how wide the gap is between what science actually knows and what people can access. People are left sorting through contradictory supplement advice with no way to know what\u2019s actually working for them. SuppVis closes that gap.",
    ],
  },
];

export default function FounderProfiles() {
  const headerRef = useScrollReveal();

  return (
    <section className="py-[120px] md:py-[160px] px-6">
      <div className="max-w-[1200px] mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {founders.map((founder, i) => (
            <FounderCard key={founder.name} founder={founder} delay={i * 0.1} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FounderCard({
  founder,
  delay,
}: {
  founder: (typeof founders)[number];
  delay: number;
}) {
  const ref = useScrollReveal(delay);

  return (
    <div
      ref={ref}
      className="scroll-reveal rounded-[18px] bg-bg-secondary border border-white/[0.06] p-8 md:p-10"
    >
      {/* Avatar + name */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-14 h-14 rounded-full overflow-hidden shrink-0">
          <img
            src={founder.photo}
            alt={founder.name}
            className="w-full h-full object-cover"
          />
        </div>
        <div>
          <h3 className="font-headline font-bold text-lg text-text-primary">
            {founder.name}
          </h3>
          <p className="text-sm text-text-muted">{founder.title}</p>
        </div>
      </div>

      {/* Story */}
      <div className="space-y-4 text-[15px] text-text-secondary leading-[1.65]">
        {founder.paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
    </div>
  );
}
