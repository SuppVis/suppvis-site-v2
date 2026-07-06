const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export interface Article {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content?: string;
  category: string;
  goalTags: string[];
  canonicalKeys?: string[];
  readTimeMin: number;
  publishedAt: string;
}

export interface ArticlesResponse {
  articles: Article[];
}

export interface ArticleResponse {
  article: Article;
}

export async function fetchArticles(): Promise<Article[]> {
  try {
    const res = await fetch(`${API_URL}/api/public/learn/articles`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data: ArticlesResponse = await res.json();
    return data.articles ?? [];
  } catch {
    return [];
  }
}

export async function fetchArticle(slug: string): Promise<Article | null> {
  try {
    const res = await fetch(`${API_URL}/api/public/learn/articles/${slug}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const data: ArticleResponse = await res.json();
    return data.article ?? null;
  } catch {
    return null;
  }
}

// --- Shop ---

export interface Product {
  id: string;
  supplementName: string;
  productName: string;
  brand: string;
  tier: string;
  price: number;
  servings: number;
  dosePerServing: string;
  form: string;
  keyBenefit: string;
  formNote?: string;
  goals: string[];
  categories: string[];
  canonicalKey: string;
  thirdPartyTested: boolean;
  noProprietaryBlend: boolean;
  imageUrl: string;
  affiliateUrl: string;
  iHerbUrl?: string;
  asin?: string;
}

export interface ProductsResponse {
  products: Product[];
}

export async function fetchProducts(): Promise<Product[]> {
  try {
    const res = await fetch(`${API_URL}/api/public/shop/products`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data: ProductsResponse = await res.json();
    return data.products ?? [];
  } catch {
    return [];
  }
}

// --- Helpers ---

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export const CATEGORY_COLORS: Record<string, { color: string; bg: string }> = {
  "DEEP DIVE": { color: "#4ECDC4", bg: "rgba(78,205,196,0.1)" },
  STRATEGY: { color: "#FF8C42", bg: "rgba(255,140,66,0.1)" },
  SCIENCE: { color: "#8B5CF6", bg: "rgba(139,92,246,0.1)" },
  GUIDE: { color: "#00C9A7", bg: "rgba(0,201,167,0.1)" },
  "QUICK READ": { color: "#FFD93D", bg: "rgba(255,217,61,0.1)" },
};

export function getCategoryStyle(category: string) {
  const key = category.toUpperCase();
  return CATEGORY_COLORS[key] ?? { color: "#9BAFBF", bg: "rgba(155,175,191,0.1)" };
}
