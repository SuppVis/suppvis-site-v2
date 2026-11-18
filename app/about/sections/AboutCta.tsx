"use client";

import { useScrollReveal } from "../../hooks/useScrollReveal";
import { BOOK_DEMO_HREF, PATIENT_WAITLIST_HREF } from "../../lib/site";

export default function AboutCta() {
  const ref = useScrollReveal();

  return (
    <section className="py-[120px] md:py-[160px] px-6">
      <div ref={ref} className="scroll-reveal max-w-[640px] mx-auto text-center">
        <h2 className="font-headline font-extrabold text-3xl sm:text-4xl md:text-5xl text-text-primary mb-6 leading-tight">
          This is the record we wanted. Now it&rsquo;s yours.
        </h2>
        <p className="text-text-secondary text-lg mb-10">
          Practitioners can book a demo of the portal. Patients can join the
          beta of the app. Either way, you talk directly to us.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href={BOOK_DEMO_HREF}
            className="inline-flex items-center px-10 py-4.5 rounded-full bg-accent text-bg-primary text-lg font-semibold hover:bg-accent-hover transition-all hover:shadow-[0_0_20px_rgba(20,184,166,0.3)]"
          >
            Book a demo
          </a>
          <a
            href={PATIENT_WAITLIST_HREF}
            className="inline-flex items-center px-10 py-4.5 rounded-full border border-accent/50 text-accent text-lg font-semibold hover:bg-accent/10 hover:border-accent transition-colors"
          >
            For patients
          </a>
        </div>

        <div className="mt-12 flex flex-col items-center gap-3 text-[15px] text-text-secondary">
          <span>Your feedback shapes the product</span>
        </div>
      </div>
    </section>
  );
}
