"use client";

import { useScrollReveal } from "../../hooks/useScrollReveal";

export default function Origin() {
  const ref = useScrollReveal();

  return (
    <section className="py-[120px] md:py-[160px] px-6">
      <div ref={ref} className="scroll-reveal max-w-[680px] mx-auto">
        <h2 className="font-headline font-bold text-[28px] sm:text-[32px] md:text-[36px] lg:text-[42px] text-text-primary mb-10 md:text-center">
          Why SuppVis exists
        </h2>

        <div className="space-y-6 text-[16px] md:text-[17px] text-text-secondary leading-[1.7]">
          <p>
            We spent years on both sides of the visit. Tanner as a patient whose
            life depends on understanding exactly what goes into his body.
            Connor as someone being trained to take a history and make clinical
            decisions with evidence, not marketing.
          </p>
          <p>
            The same gap kept showing up. A patient lives a whole month between
            appointments. The practitioner sees one visit of it, rebuilt from
            memory. The supplement started in week two, the bad nights in week
            three, the missed doses, the travel: most of it never makes it into
            the room.
          </p>
          <p>So we built the record that fills that gap.</p>
          <p>
            Patients log what they take, what they do, and how they feel, in
            about a minute a day. Through their practice, their practitioner
            sees that history in the SuppVis portal as a pre-visit brief, before
            the visit starts. The portal is built for clinical judgment, not
            around it: it shows the record and proposes associations, and the
            practitioner decides what they mean.
          </p>
          <p>
            The patient side is the SuppVis app. It keeps supplements,
            medications, habits, and daily scores in one place, points out
            timing patterns in the person&rsquo;s own record, and grounds every
            insight in 33,000+{" "}
            <a href="/sources" className="text-accent underline decoration-accent/40 hover:decoration-accent underline-offset-4 transition-colors">peer-reviewed
            studies</a>.
          </p>
          <p>
            SuppVis is not a supplement brand. We don&rsquo;t sell supplements.
            No company pays to influence what the platform surfaces. We built an
            independent record, for the patient and the practitioner caring
            for them.
          </p>
        </div>
      </div>
    </section>
  );
}
