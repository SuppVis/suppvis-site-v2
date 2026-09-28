import type { Metadata } from "next";
import { Suspense } from "react";
import Nav from "../components/Nav";
import Footer from "../components/Footer";
import ResearchContent from "./sections/ResearchContent";
import ResearchMethodology from "./sections/ResearchMethodology";
import ResearchSources from "./sections/ResearchSources";

export const metadata: Metadata = {
  title: "Research - SuppVis",
  description:
    "SuppVis is built on peer-reviewed research. Browse the studies behind every recommendation. Curated from PubMed and Semantic Scholar, classified for quality, linked to specific supplements, habits, and outcomes.",
};

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "https://suppvis-platform.vercel.app";

interface SupplementStats {
  total_articles: number;
  high_quality_articles: number;
  supplements_covered: number;
  last_updated: string | null;
}

interface SupplementSummary {
  canonical_key: string;
  supplement_name: string;
  total_articles: number;
  high_quality_articles: number;
  study_type_breakdown: {
    rct: number;
    meta_analysis: number;
    systematic_review: number;
    observational: number;
  };
}

interface HabitStats {
  totalFindings: number;
  distinctArticles: number;
  distinctHabits: number;
  highQualityArticleShare: number;
  lastUpdated: string | null;
}

interface HabitSummary {
  habitKey: string;
  name: string;
  category: string | null;
  findingsCount: number;
  articleCount: number;
  studyTypeBreakdown: {
    rct: number;
    meta_analysis: number;
    systematic_review: number;
    observational: number;
  };
}

async function fetchSupplementStats(): Promise<SupplementStats | null> {
  try {
    const res = await fetch(`${API_BASE}/api/public/research/stats`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function fetchSupplements(): Promise<SupplementSummary[]> {
  try {
    const res = await fetch(
      `${API_BASE}/api/public/research/supplements?limit=500`,
      { next: { revalidate: 3600 } },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.supplements ?? [];
  } catch {
    return [];
  }
}

async function fetchHabitStats(): Promise<HabitStats | null> {
  try {
    const res = await fetch(`${API_BASE}/api/public/research/habits/stats`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function fetchHabits(): Promise<HabitSummary[]> {
  try {
    const res = await fetch(
      `${API_BASE}/api/public/research/habits?limit=500`,
      { next: { revalidate: 3600 } },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.habits ?? [];
  } catch {
    return [];
  }
}

export default async function ResearchPage() {
  const [supplementStats, supplements, habitStats, habits] = await Promise.all([
    fetchSupplementStats(),
    fetchSupplements(),
    fetchHabitStats(),
    fetchHabits(),
  ]);

  return (
    <>
      <Nav />
      <main>
        <Suspense>
          <ResearchContent
            supplementStats={supplementStats}
            supplements={supplements}
            habitStats={habitStats}
            habits={habits}
          />
        </Suspense>
        <ResearchMethodology />
        <ResearchSources />
      </main>
      <Footer />
    </>
  );
}
