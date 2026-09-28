"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

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

interface HabitsBrowserProps {
  habits: HabitSummary[];
}

const CATEGORY_LABELS: Record<string, string> = {
  movement: "Movement",
  mind_stress: "Mind & Stress",
  sleep_circadian: "Sleep & Circadian",
  nutrition: "Nutrition",
  recovery: "Recovery",
  light_environment: "Light & Environment",
  thermal: "Thermal",
};

export default function HabitsBrowser({ habits }: HabitsBrowserProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    habits.forEach((h) => {
      if (h.category) cats.add(h.category);
    });
    return Array.from(cats).sort((a, b) =>
      (CATEGORY_LABELS[a] ?? a).localeCompare(CATEGORY_LABELS[b] ?? b),
    );
  }, [habits]);

  const filtered = useMemo(() => {
    let result = habits;
    const q = query.trim().toLowerCase();
    if (q) {
      result = result.filter((h) => h.name.toLowerCase().includes(q));
    }
    if (category) {
      result = result.filter((h) => h.category === category);
    }
    return result;
  }, [query, category, habits]);

  return (
    <section className="py-24 px-6 border-t border-white/5">
      <div className="max-w-[1200px] mx-auto">
        <div className="max-w-[700px] mb-12">
          <p className="text-sm font-medium text-habit-gold uppercase tracking-widest mb-4">
            Browse the corpus
          </p>
          <h2 className="font-headline font-bold text-3xl sm:text-4xl md:text-5xl text-text-primary leading-tight">
            See what&apos;s behind every habit.
          </h2>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search habits..."
            className="w-full bg-bg-secondary border border-white/10 rounded-2xl px-6 py-4 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-habit-gold/50 transition-colors"
          />
        </div>

        {/* Category filter */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setCategory(null)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              category === null
                ? "bg-habit-gold text-bg-primary"
                : "bg-bg-secondary border border-white/10 text-text-muted hover:text-text-secondary"
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(category === cat ? null : cat)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                category === cat
                  ? "bg-habit-gold text-bg-primary"
                  : "bg-bg-secondary border border-white/10 text-text-muted hover:text-text-secondary"
              }`}
            >
              {CATEGORY_LABELS[cat] ?? cat}
            </button>
          ))}
        </div>

        {/* Result count */}
        <p className="text-sm text-text-muted mb-6">
          Showing {filtered.length.toLocaleString()} of{" "}
          {habits.length.toLocaleString()} habits
        </p>

        {/* Habit grid */}
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-text-muted">
            No habits match your filters.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((h) => (
              <Link
                key={h.habitKey}
                href={`/research/habits/${h.habitKey}`}
                className="bg-bg-secondary border border-white/5 rounded-2xl p-6 text-left hover:border-habit-gold/30 transition-colors group block"
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-headline font-bold text-lg text-text-primary leading-tight">
                    {h.name}
                  </h3>
                  <div className="font-headline font-bold text-2xl text-habit-gold">
                    {h.articleCount}
                  </div>
                </div>
                {h.category && (
                  <div className="text-xs text-habit-gold/70 mb-3">
                    {CATEGORY_LABELS[h.category] ?? h.category}
                  </div>
                )}
                <div className="text-xs text-text-muted mb-2">
                  {h.findingsCount.toLocaleString()} findings
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
                  {h.studyTypeBreakdown.rct > 0 && (
                    <span>{h.studyTypeBreakdown.rct} RCTs</span>
                  )}
                  {h.studyTypeBreakdown.meta_analysis > 0 && (
                    <span>{h.studyTypeBreakdown.meta_analysis} meta-analyses</span>
                  )}
                  {h.studyTypeBreakdown.systematic_review > 0 && (
                    <span>{h.studyTypeBreakdown.systematic_review} reviews</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
