import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SuppVis - Track Your Stack. See What's Working.",
  description:
    "SuppVis is an AI-powered platform that tracks your supplements, meds, and habits, scores your health goals, and shows you exactly what's moving the needle. Evidence-based. Brand-agnostic.",
  openGraph: {
    title: "SuppVis - Track Your Stack. See What's Working.",
    description:
      "SuppVis is an AI-powered platform that tracks your supplements, meds, and habits, scores your health goals, and shows you exactly what's moving the needle. Evidence-based. Brand-agnostic.",
    url: "https://suppvis.health/",
    siteName: "SuppVis",
    type: "website",
  },
  metadataBase: new URL("https://suppvis.health"),
  alternates: {
    canonical: "/",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Outfit:wght@700;800&display=swap"
          rel="stylesheet"
        />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </head>
      <body>{children}</body>
    </html>
  );
}
