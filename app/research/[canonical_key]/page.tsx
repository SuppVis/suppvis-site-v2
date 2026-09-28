import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Nav from "../../components/Nav";
import Footer from "../../components/Footer";
import SupplementHero from "../sections/SupplementHero";
import SupplementArticles from "../sections/SupplementArticles";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "https://suppvis-platform.vercel.app";

interface GoalRelation {
  goal: string;
  direction: "positive" | "negative" | "mixed" | "no_effect";
}

interface Article {
  title: string;
  year: number | null;
  journal: string | null;
  authors: string | null;
  study_type: string | null;
  sample_size: number | null;
  summary: string | null;
  goal_relations: GoalRelation[];
  article_url: string;
  source_type: string;
}

interface SupplementInfo {
  canonical_key: string;
  supplement_name: string;
  total_articles: number;
}

interface SupplementResponse {
  supplement: SupplementInfo;
  articles: Article[];
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

async function fetchSupplementArticles(
  canonical_key: string,
): Promise<SupplementResponse | null> {
  try {
    const res = await fetch(
      `${API_BASE}/api/public/research/supplements/${encodeURIComponent(canonical_key)}/articles?limit=100`,
      { next: { revalidate: 3600 } },
    );
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function fetchSupplementSummary(
  canonical_key: string,
): Promise<SupplementSummary | null> {
  try {
    const res = await fetch(
      `${API_BASE}/api/public/research/supplements?limit=500`,
      { next: { revalidate: 3600 } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const found = (data.supplements ?? []).find(
      (s: SupplementSummary) => s.canonical_key === canonical_key,
    );
    return found ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ canonical_key: string }>;
}): Promise<Metadata> {
  const { canonical_key } = await params;
  const data = await fetchSupplementArticles(canonical_key);
  const name = data?.supplement.supplement_name ?? canonical_key;
  return {
    title: `${name} Research - SuppVis`,
    description: `Peer-reviewed research on ${name}. Browse studies, meta-analyses, and clinical trials curated from PubMed and Semantic Scholar.`,
  };
}

export default async function SupplementResearchPage({
  params,
}: {
  params: Promise<{ canonical_key: string }>;
}) {
  const { canonical_key } = await params;

  const [articlesData, summary] = await Promise.all([
    fetchSupplementArticles(canonical_key),
    fetchSupplementSummary(canonical_key),
  ]);

  if (!articlesData) {
    notFound();
  }

  return (
    <>
      <Nav />
      <main>
        {/* Breadcrumb */}
        <div className="pt-28 pb-4 px-6">
          <div className="max-w-[1100px] mx-auto">
            <Link
              href="/research"
              className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-accent transition-colors"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              All supplements
            </Link>
          </div>
        </div>

        <SupplementHero supplement={articlesData.supplement} summary={summary} />
        <SupplementArticles articles={articlesData.articles} />
      </main>
      <Footer />
    </>
  );
}
