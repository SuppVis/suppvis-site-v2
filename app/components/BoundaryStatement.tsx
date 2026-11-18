// Spec section 13 boundary statement: verbatim, non-negotiable. Rendered by
// Footer so it sits above the global footer on every page. Pages without the
// footer (404, unsubscribe) render it directly.
export default function BoundaryStatement() {
  return (
    <section aria-label="About SuppVis information" className="px-6 pb-16">
      <div className="max-w-[900px] mx-auto rounded-2xl border border-white/[0.06] bg-bg-secondary/60 px-6 py-6 sm:px-8">
        <p className="text-[13px] text-text-muted leading-relaxed">
          SuppVis provides wellness information and decision support for
          licensed professionals and their patients. It does not diagnose,
          treat, cure, or prevent any disease, and it never replaces clinical
          judgment. Associations shown in SuppVis reflect timing in the
          patient&apos;s own record, not causation. Medication information is
          used for safety screening and analysis context only; SuppVis never
          advises on medications.
        </p>
      </div>
    </section>
  );
}
