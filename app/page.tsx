import type { Metadata } from "next";
import Nav from "./components/Nav";
import Footer from "./components/Footer";
import ClinicsHero from "./_home/sections/ClinicsHero";
import BlindSpot from "./_home/sections/BlindSpot";
import PreVisitBrief from "./_home/sections/PreVisitBrief";
import PatientSide from "./_home/sections/PatientSide";
import Vignettes from "./_home/sections/Vignettes";
import DataLayers from "./_home/sections/DataLayers";
import BetweenVisits from "./_home/sections/BetweenVisits";
import {
  EvidenceHonesty,
  Independence,
  WhoItsFor,
} from "./_home/sections/EvidenceIndependence";
import ClinicsCta from "./_home/sections/ClinicsCta";

// Spec: docs/CLINIC_PAGE_SPEC_v2.md. Not for production until every publish
// gate in the spec is cleared (copy review, counsel, demo parity, real demo
// link, approved merge). The section 13 boundary statement renders from Footer.
const TITLE = "SuppVis for Practices | Walk in with the history already taken";
const DESCRIPTION =
  "SuppVis builds the between-visit history from what your patient actually did, every day, and hands it to you as a pre-visit brief before they sit down.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "https://suppvis.health/",
    siteName: "SuppVis",
    type: "website",
  },
  twitter: {
    title: TITLE,
    description: DESCRIPTION,
  },
  alternates: {
    canonical: "/",
  },
};

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <ClinicsHero />
        <BlindSpot />
        <PreVisitBrief />
        <PatientSide />
        <Vignettes />
        <DataLayers />
        <BetweenVisits />
        <EvidenceHonesty />
        <Independence />
        <WhoItsFor />
        <ClinicsCta />
      </main>
      <Footer />
    </>
  );
}
