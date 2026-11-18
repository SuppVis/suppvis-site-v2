import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Nav from "../../components/Nav";
import Footer from "../../components/Footer";
import { fetchArticle, formatDate, getCategoryStyle } from "../../lib/api";
import ArticleBody from "./ArticleBody";

interface Props {
  params: { slug: string };
}

async function getArticle(slug: string) {
  return fetchArticle(slug);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const article = await getArticle(params.slug);
  if (!article) {
    return { title: "Article Not Found | SuppVis Journal" };
  }
  return {
    title: `${article.title} | SuppVis Journal`,
    description: article.excerpt,
    openGraph: {
      title: article.title,
      description: article.excerpt,
      type: "article",
      publishedTime: article.publishedAt,
      tags: article.goalTags,
    },
  };
}

export default async function ArticlePage({ params }: Props) {
  const article = await getArticle(params.slug);

  if (!article) {
    return (
      <>
        <Nav />
        <main className="pt-32 pb-24 px-6 min-h-screen">
          <div className="max-w-[720px] mx-auto text-center">
            <h1 className="font-headline font-bold text-4xl text-text-primary mb-4">
              Article not found
            </h1>
            <p className="text-text-secondary mb-8">
              The article you&rsquo;re looking for doesn&rsquo;t exist or has been removed.
            </p>
            <a
              href="/blog"
              className="inline-flex items-center text-accent hover:text-accent-hover transition-colors font-medium"
            >
              Back to Journal &rarr;
            </a>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  const catStyle = getCategoryStyle(article.category);

  return (
    <>
      <Nav />
      <main className="pt-24 md:pt-32 pb-24 px-6">
        <div className="max-w-[720px] mx-auto">
          {/* Back link */}
          <a
            href="/blog"
            className="inline-flex items-center text-sm text-text-muted hover:text-text-secondary transition-colors mb-8"
          >
            &larr; Back to Journal
          </a>

          {/* Article header */}
          <header className="mb-12">
            <span
              className="inline-block px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide mb-4"
              style={{ color: catStyle.color, backgroundColor: catStyle.bg }}
            >
              {article.category}
            </span>
            <h1 className="font-headline font-extrabold text-[28px] sm:text-[32px] md:text-[36px] lg:text-[44px] text-text-primary leading-tight mb-4">
              {article.title}
            </h1>
            <p className="text-sm text-text-muted">
              {formatDate(article.publishedAt)} &middot;{" "}
              {article.readTimeMin} min read
            </p>
          </header>

          {/* Article body */}
          <ArticleBody content={article.content ?? ""} />

          {/* Goal tags + canonical keys */}
          {(article.goalTags?.length > 0 ||
            article.canonicalKeys?.length) && (
            <div className="mt-16 pt-8 border-t border-white/5 space-y-6">
              {article.goalTags?.length > 0 && (
                <div>
                  <p className="text-[11px] uppercase tracking-widest text-text-muted font-semibold mb-3">
                    Related goals
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {article.goalTags.map((tag) => (
                      <span
                        key={tag}
                        className="text-xs px-3 py-1 rounded-full bg-accent/10 text-accent font-medium"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {article.canonicalKeys && article.canonicalKeys.length > 0 && (
                <div>
                  <p className="text-[11px] uppercase tracking-widest text-text-muted font-semibold mb-3">
                    Supplements mentioned
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {article.canonicalKeys.map((key) => (
                      <span
                        key={key}
                        className="text-xs px-3 py-1 rounded-full bg-white/5 text-text-secondary font-medium"
                      >
                        {key}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CTA banner */}
          <div className="mt-16 rounded-2xl bg-bg-secondary border border-white/5 p-8 md:p-12 text-center">
            <h2 className="font-headline font-bold text-xl md:text-2xl text-text-primary mb-3">
              Want recommendations based on your goals?
            </h2>
            <p className="text-text-secondary mb-6 max-w-md mx-auto">
              SuppVis builds a personalized supplement protocol around your
              unique biology. Join the beta.
            </p>
            <a
              href="/patients#waitlist"
              className="inline-flex items-center px-8 py-3.5 rounded-full bg-accent text-bg-primary font-semibold hover:bg-accent-hover transition-all hover:shadow-[0_0_20px_rgba(20,184,166,0.3)]"
            >
              Get Early Access
            </a>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
