import type { Metadata } from "next";
import Nav from "../components/Nav";
import Footer from "../components/Footer";
import Hero from "./sections/Hero";
import FindYourFrequency from "./sections/FindYourFrequency";
import IntelligenceLayer from "./sections/IntelligenceLayer";
import CallToAction from "./sections/CallToAction";

export const metadata: Metadata = {
  title: "How It Works - SuppVis",
  description:
    "Your habits, stack, and meds, correlated with how you feel each day. SuppVis proves what's working for you.",
  openGraph: {
    title: "How It Works - SuppVis",
    description:
      "Your habits, stack, and meds, correlated with how you feel each day. SuppVis proves what's working for you.",
    url: "https://suppvis.health/how-it-works",
    siteName: "SuppVis",
    type: "website",
  },
  twitter: {
    description:
      "Your habits, stack, and meds, correlated with how you feel each day. SuppVis proves what's working for you.",
  },
  alternates: {
    canonical: "/how-it-works",
  },
};

export default function HowItWorksPage() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <FindYourFrequency />
        <IntelligenceLayer />
        <CallToAction />
      </main>
      <Footer />
    </>
  );
}
