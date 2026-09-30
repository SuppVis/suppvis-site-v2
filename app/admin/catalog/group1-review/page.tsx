import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getAdminAccess, isMicrosoftAuthConfigured } from "@/app/lib/server/admin-access";
import CatalogGroup1Review from "../CatalogGroup1Review";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export const metadata: Metadata = {
  title: "Nutrition Review | SuppVis Admin",
  robots: { index: false, follow: false },
};

export default async function Group1ReviewPage() {
  if (!isMicrosoftAuthConfigured()) return <AccessUnavailable />;
  const access = getAdminAccess(await auth());
  if (!access.ok && access.reason === "not_authenticated") {
    redirect("/admin/sign-in?callbackUrl=/admin/catalog/group1-review");
  }
  if (!access.ok) return <AccessUnavailable />;

  return <main className="admin-page min-h-screen bg-bg-primary px-4 py-5 text-text-primary lg:px-7">
    <div className="mx-auto max-w-[1680px]">
      <CatalogGroup1Review mode="queue" />
    </div>
  </main>;
}

function AccessUnavailable() {
  return <main className="min-h-screen bg-bg-primary px-5 py-10 text-text-primary">
    <section className="mx-auto max-w-2xl rounded-[8px] border border-white/10 bg-[#0D1117] p-8">
      <h1 className="font-headline text-4xl font-extrabold">Access unavailable</h1>
      <p className="mt-4 text-text-secondary">Authorized access only.</p>
      <Link href="/admin/sign-in" className="mt-7 inline-flex rounded-full bg-accent px-5 py-3 text-sm font-bold text-[#03100E]">Go to sign in</Link>
    </section>
  </main>;
}
