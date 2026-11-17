import type { Metadata } from "next";
import Nav from "../components/Nav";
import Footer from "../components/Footer";
import ClinicsHero from "./sections/ClinicsHero";
import BlindSpot from "./sections/BlindSpot";
import PreVisitBrief from "./sections/PreVisitBrief";
import PatientSide from "./sections/PatientSide";
import Vignettes from "./sections/Vignettes";
import DataLayers from "./sections/DataLayers";
import BetweenVisits from "./sections/BetweenVisits";
import {
  BoundaryStatement,
  EvidenceHonesty,
  Independence,
  WhoItsFor,
} from "./sections/EvidenceIndependence";
import ClinicsCta from "./sections/ClinicsCta";

// Spec: docs/CLINIC_PAGE_SPEC_v2.md. Not for production until every publish
// gate in the spec is cleared (copy review, counsel, demo parity, real demo
// link, approved merge). Remove `robots` below only at publish.
const DESCRIPTION =
  "SuppVis builds the between-visit history from what your patient actually did, every day, and hands it to you as a pre-visit brief before they sit down.";

export const metadata: Metadata = {
  title: "For Clinics - SuppVis",
  description: DESCRIPTION,
  openGraph: {
    title: "SuppVis for Clinics",
    description: DESCRIPTION,
    url: "https://suppvis.health/clinics",
    siteName: "SuppVis",
    type: "website",
  },
  alternates: {
    canonical: "/clinics",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function ClinicsPage() {
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
        <BoundaryStatement />
      </main>
      <Footer />
    </>
  );
}
