import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import {
  getAdminAccess,
  isMicrosoftAuthConfigured,
  maskAdminEmail,
} from "@/app/lib/server/admin-access";
import CatalogWorkspace from "./CatalogWorkspace";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export const metadata: Metadata = {
  title: "Catalog | SuppVis Admin",
  robots: { index: false, follow: false },
};

function Blocked() {
  return (
    <main className="min-h-screen bg-bg-primary px-5 py-10 text-text-primary">
      <section className="mx-auto max-w-2xl rounded-[8px] border border-white/10 bg-[#0D1117] p-8 shadow-2xl shadow-black/30">
        <h1 className="font-headline text-4xl font-extrabold">Access unavailable</h1>
        <p className="mt-4 leading-7 text-text-secondary">Authorized access only.</p>
        <Link href="/admin/sign-in" className="mt-7 inline-flex rounded-full bg-accent px-5 py-3 text-sm font-bold text-[#03100E]">
          Go to sign in
        </Link>
      </section>
    </main>
  );
}

export default async function CatalogAdminPage() {
  if (!isMicrosoftAuthConfigured()) return <Blocked />;
  const access = getAdminAccess(await auth());
  if (!access.ok && access.reason === "not_authenticated") {
    redirect("/admin/sign-in?callbackUrl=/admin/catalog");
  }
  if (!access.ok) return <Blocked />;

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/admin" });
  }

  return (
    <main className="admin-page min-h-screen bg-bg-primary px-4 py-6 text-text-primary lg:px-7">
      <div className="mx-auto max-w-[1680px]">
        <header className="mb-6 flex flex-col gap-4 border-b border-white/10 pb-5 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-3 text-sm text-text-secondary">
              <Image src="/favicon.svg" alt="" width={36} height={36} className="h-9 w-9 rounded-full border border-accent/30 bg-accent/10 p-1" />
              <Link href="/admin" className="font-semibold hover:text-accent">SuppVis Admin</Link>
              <span aria-hidden="true">/</span>
              <span>Catalog</span>
            </div>
            <h1 className="mt-3 font-headline text-4xl font-extrabold tracking-tight">Catalog workspace</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-text-secondary">
              Curate one draft product at a time from retained label evidence. Templates and previews are read-only until Save draft.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-[8px] border border-white/10 bg-[#0D1117] p-3 text-sm">
            <span className="text-text-secondary">{maskAdminEmail(access.email)}</span>
            <form action={signOutAction}>
              <button className="rounded-full border border-white/15 px-3 py-2 text-xs font-semibold hover:border-accent/60 hover:text-accent">Sign out</button>
            </form>
          </div>
        </header>
        <CatalogWorkspace />
      </div>
    </main>
  );
}
