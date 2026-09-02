function catalogBrowserOrigins() {
  return (process.env.CATALOG_IMAGE_BROWSER_ORIGINS || "")
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((value) => {
      const url = new URL(value);
      if (url.username || url.password || url.search || url.hash || url.pathname !== "/") {
        throw new Error("CATALOG_IMAGE_BROWSER_ORIGINS entries must be origins only.");
      }
      if (url.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(url.hostname)) {
        throw new Error("Catalog browser origins must use HTTPS outside local development.");
      }
      return url.origin;
    });
}

const privateCatalogOrigins = catalogBrowserOrigins();

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  `img-src 'self' data: blob: https://*.public.blob.vercel-storage.com https://cdn.shopify.com https://m.media-amazon.com ${privateCatalogOrigins.join(" ")}`.trim(),
  `connect-src 'self' https://suppvis-platform.vercel.app ${privateCatalogOrigins.join(" ")}`.trim(),
  "form-action 'self' mailto:",
  "frame-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: contentSecurityPolicy,
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
];

const adminNoStoreHeaders = [
  {
    key: "Cache-Control",
    value: "no-store, no-cache, must-revalidate, proxy-revalidate",
  },
  {
    key: "Pragma",
    value: "no-cache",
  },
  {
    key: "Expires",
    value: "0",
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/admin/:path*",
        headers: adminNoStoreHeaders,
      },
      {
        source: "/api/admin/:path*",
        headers: adminNoStoreHeaders.slice(0, 1),
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "m.media-amazon.com",
      },
    ],
  },
};

export default nextConfig;
