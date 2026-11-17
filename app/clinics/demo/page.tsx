import type { Metadata } from "next";
import Nav from "../../components/Nav";
import Footer from "../../components/Footer";
import { FOUNDING_FORM_ID } from "../config";

// Placeholder destination for "Book a demo". Once the real calendar link
// exists, set BOOK_DEMO_HREF in app/clinics/config.ts and delete this route.
export const metadata: Metadata = {
  title: "Book a demo - SuppVis for Clinics",
  robots: { index: false, follow: false },
};

export default function ClinicsDemoPlaceholder() {
  return (
    <>
      <Nav />
      <main className="pt-40 pb-32 px-6">
        <div className="max-w-[640px] mx-auto text-center">
          <div className="h-1 w-10 rounded-full bg-accent mx-auto mb-8" />
          <h1 className="font-headline font-extrabold text-4xl sm:text-5xl text-text-primary leading-tight">
            Book a demo
          </h1>
          <p className="mt-6 text-lg text-text-secondary leading-relaxed">
            Demo scheduling opens here shortly. In the meantime, join the
            founding practices and we&apos;ll reach out to find a time.
          </p>
          <a
            href={`/clinics#${FOUNDING_FORM_ID}`}
            className="mt-10 inline-flex items-center justify-center px-8 py-3.5 rounded-full bg-accent hover:bg-accent-hover text-bg-primary font-semibold transition-colors"
          >
            Join the founding practices
          </a>
        </div>
      </main>
      <Footer />
    </>
  );
}
