import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Nav from "../../../components/Nav";
import Footer from "../../../components/Footer";
import HabitArticles from "../../sections/HabitArticles";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "https://suppvis-platform.vercel.app";

const CATEGORY_LABELS: Record<string, string> = {
  movement: "Movement",
  mind_stress: "Mind & Stress",
  sleep_circadian: "Sleep & Circadian",
  nutrition: "Nutrition",
  recovery: "Recovery",
  light_environment: "Light & Environment",
  thermal: "Thermal",
};

interface Article {
  title: string;
  year: number | null;
  journal: string | null;
  authors: string[] | null;
  studyType: string | null;
  sampleSize: number | null;
  articleUrl: string | null;
  doi: string | null;
}

interface HabitInfo {
  habitKey: string;
  name: string;
  totalArticles: number;
}

interface HabitResponse {
  habit: HabitInfo;
  articles: Article[];
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

async function fetchHabitArticles(
  habit_key: string,
): Promise<HabitResponse | null> {
  try {
    const res = await fetch(
      `${API_BASE}/api/public/research/habits/${encodeURIComponent(habit_key)}/articles?limit=100`,
      { next: { revalidate: 3600 } },
    );
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function fetchHabitSummary(
  habit_key: string,
): Promise<HabitSummary | null> {
  try {
    const res = await fetch(
      `${API_BASE}/api/public/research/habits?limit=500`,
      { next: { revalidate: 3600 } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const found = (data.habits ?? []).find(
      (h: HabitSummary) => h.habitKey === habit_key,
    );
    return found ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ habit_key: string }>;
}): Promise<Metadata> {
  const { habit_key } = await params;
  const data = await fetchHabitArticles(habit_key);
  const name = data?.habit.name ?? habit_key;
  return {
    title: `${name} Research - SuppVis`,
    description: `Peer-reviewed research on ${name}. Browse studies, meta-analyses, and clinical trials curated from PubMed and Semantic Scholar.`,
  };
}

export default async function HabitResearchPage({
  params,
}: {
  params: Promise<{ habit_key: string }>;
}) {
  const { habit_key } = await params;

  const [articlesData, summary] = await Promise.all([
    fetchHabitArticles(habit_key),
    fetchHabitSummary(habit_key),
  ]);

  if (!articlesData) {
    notFound();
  }

  const breakdown = summary?.studyTypeBreakdown;
  const total = articlesData.habit.totalArticles;

  const segments = breakdown && total > 0
    ? [
        {
          key: "meta_analysis",
          label: "Meta-analyses",
          count: breakdown.meta_analysis,
          color: "bg-habit-gold",
        },
        {
          key: "systematic_review",
          label: "Systematic reviews",
          count: breakdown.systematic_review,
          color: "bg-habit-gold/70",
        },
        {
          key: "rct",
          label: "RCTs",
          count: breakdown.rct,
          color: "bg-habit-gold/40",
        },
        {
          key: "observational",
          label: "Observational",
          count: breakdown.observational,
          color: "bg-text-muted/40",
        },
      ].filter((s) => s.count > 0)
    : [];

  return (
    <>
      <Nav />
      <main>
        {/* Breadcrumb */}
        <div className="pt-28 pb-4 px-6">
          <div className="max-w-[1100px] mx-auto">
            <Link
              href="/research?tab=habits"
              className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-habit-gold transition-colors"
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
              All habits
            </Link>
          </div>
        </div>

        {/* Hero */}
        <section className="relative px-6 pt-8 pb-16 overflow-hidden">
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-habit-gold/5 blur-[100px] pointer-events-none" />

          <div className="relative max-w-[1100px] mx-auto">
            <p className="text-sm font-medium text-habit-gold uppercase tracking-widest mb-4">
              Research
            </p>
            <h1 className="font-headline font-extrabold text-4xl sm:text-5xl md:text-6xl leading-[1.05] text-text-primary mb-3">
              {articlesData.habit.name}
            </h1>
            {summary?.category && (
              <div className="inline-flex items-center px-3 py-1 rounded-full bg-habit-gold-light text-xs text-habit-gold font-medium mb-6">
                {CATEGORY_LABELS[summary.category] ?? summary.category}
              </div>
            )}
            <p className="text-lg text-text-secondary mb-12">
              {total.toLocaleString()} peer-reviewed studies
              curated from PubMed and Semantic Scholar.
              {summary ? ` ${summary.findingsCount.toLocaleString()} research findings extracted.` : ""}
            </p>

            {breakdown && (
              <div className="bg-bg-secondary border border-white/5 rounded-3xl p-8">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
                  <div>
                    <div className="font-headline font-extrabold text-3xl sm:text-4xl text-text-primary">
                      {breakdown.meta_analysis.toLocaleString()}
                    </div>
                    <div className="text-xs text-text-muted uppercase tracking-wider mt-2">
                      Meta-analyses
                    </div>
                  </div>
                  <div>
                    <div className="font-headline font-extrabold text-3xl sm:text-4xl text-text-primary">
                      {breakdown.systematic_review.toLocaleString()}
                    </div>
                    <div className="text-xs text-text-muted uppercase tracking-wider mt-2">
                      Systematic reviews
                    </div>
                  </div>
                  <div>
                    <div className="font-headline font-extrabold text-3xl sm:text-4xl text-text-primary">
                      {breakdown.rct.toLocaleString()}
                    </div>
                    <div className="text-xs text-text-muted uppercase tracking-wider mt-2">
                      RCTs
                    </div>
                  </div>
                  <div>
                    <div className="font-headline font-extrabold text-3xl sm:text-4xl text-text-primary">
                      {(breakdown.observational + (total - (breakdown.meta_analysis + breakdown.systematic_review + breakdown.rct + breakdown.observational))).toLocaleString()}
                    </div>
                    <div className="text-xs text-text-muted uppercase tracking-wider mt-2">
                      Other studies
                    </div>
                  </div>
                </div>

                {segments.length > 0 && (
                  <div>
                    <div className="flex h-2 rounded-full overflow-hidden bg-bg-primary mb-4">
                      {segments.map((seg) => (
                        <div
                          key={seg.key}
                          className={seg.color}
                          style={{ width: `${(seg.count / total) * 100}%` }}
                          title={`${seg.label}: ${seg.count}`}
                        />
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs">
                      {segments.map((seg) => (
                        <div key={seg.key} className="flex items-center gap-2">
                          <span className={`inline-block w-2 h-2 rounded-full ${seg.color}`} />
                          <span className="text-text-secondary">
                            {seg.label}{" "}
                            <span className="text-text-muted">
                              ({Math.round((seg.count / total) * 100)}%)
                            </span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        <HabitArticles articles={articlesData.articles} />
      </main>
      <Footer />
    </>
  );
}
