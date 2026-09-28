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

interface HabitArticlesProps {
  articles: Article[];
}

function formatStudyType(type: string | null): string {
  if (!type) return "Study";
  const map: Record<string, string> = {
    rct: "RCT",
    meta_analysis: "Meta-analysis",
    systematic_review: "Systematic review",
    observational: "Observational",
    cohort: "Cohort study",
    case_control: "Case-control",
    cross_sectional: "Cross-sectional",
    in_vitro: "In vitro",
    animal: "Animal study",
    narrative_review: "Review",
    review: "Review",
    case_report: "Case report",
    other: "Study",
  };
  return map[type] ?? type;
}

function articleLink(article: Article): string | null {
  if (article.articleUrl) return article.articleUrl;
  if (article.doi) return `https://doi.org/${article.doi}`;
  return null;
}

export default function HabitArticles({ articles }: HabitArticlesProps) {
  if (articles.length === 0) {
    return (
      <section className="py-20 px-6">
        <div className="max-w-[1100px] mx-auto text-center text-text-muted">
          No studies available yet.
        </div>
      </section>
    );
  }

  return (
    <section className="px-6 pb-24">
      <div className="max-w-[1100px] mx-auto">
        <div className="mb-10">
          <h2 className="font-headline font-bold text-2xl text-text-primary">
            Studies
          </h2>
          <p className="text-text-muted text-sm mt-1">
            Sorted by evidence tier and recency
          </p>
        </div>

        <div className="space-y-4">
          {articles.map((article, i) => {
            const href = articleLink(article);
            const authors = Array.isArray(article.authors)
              ? article.authors.join(", ")
              : article.authors;

            const inner = (
              <>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-3 text-xs text-text-muted">
                  {article.year && (
                    <span className="font-medium text-text-secondary">
                      {article.year}
                    </span>
                  )}
                  {article.journal && (
                    <>
                      <span className="text-text-muted/40">&middot;</span>
                      <span>{article.journal}</span>
                    </>
                  )}
                  {authors && (
                    <>
                      <span className="text-text-muted/40">&middot;</span>
                      <span className="truncate max-w-[300px]">{authors}</span>
                    </>
                  )}
                </div>

                <h3 className="font-headline font-bold text-lg sm:text-xl text-text-primary group-hover:text-habit-gold transition-colors leading-snug mb-4">
                  {article.title}
                </h3>

                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-white/5 text-xs text-text-secondary font-medium">
                    {formatStudyType(article.studyType)}
                  </span>
                  {article.sampleSize && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-white/5 text-xs text-text-secondary">
                      n = {article.sampleSize.toLocaleString()}
                    </span>
                  )}
                </div>

                {href && (
                  <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-end">
                    <span className="text-xs text-text-muted group-hover:text-habit-gold transition-colors flex items-center gap-1">
                      Read article
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M7 17L17 7M17 7H7M17 7V17" />
                      </svg>
                    </span>
                  </div>
                )}
              </>
            );

            return href ? (
              <a
                key={i}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="group block bg-bg-secondary border border-white/5 rounded-2xl p-6 sm:p-8 hover:border-habit-gold/30 transition-colors"
              >
                {inner}
              </a>
            ) : (
              <div
                key={i}
                className="group block bg-bg-secondary border border-white/5 rounded-2xl p-6 sm:p-8"
              >
                {inner}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
