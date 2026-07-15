import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import {
  getAdminAccess,
  isMicrosoftAuthConfigured,
} from "@/app/lib/server/admin-access";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "SuppVis Admin Sign In",
  robots: {
    index: false,
    follow: false,
  },
};

function safeCallbackUrl(value: unknown) {
  if (typeof value !== "string") {
    return "/admin";
  }

  return value.startsWith("/admin") ? value : "/admin";
}

export default async function AdminSignInPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const callbackUrl = safeCallbackUrl(searchParams?.callbackUrl);
  const authConfigured = isMicrosoftAuthConfigured();
  const hasAuthError = Boolean(searchParams?.error);

  if (authConfigured) {
    const session = await auth();
    const access = getAdminAccess(session);

    if (access.ok) {
      redirect(callbackUrl);
    }
  }

  async function signInAction() {
    "use server";
    await signIn("microsoft-entra-id", { redirectTo: callbackUrl });
  }

  return (
    <main className="min-h-screen bg-bg-primary px-5 py-10 text-text-primary">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl items-center">
        <section className="grid w-full gap-5 lg:grid-cols-[0.95fr_1.05fr] lg:items-stretch">
          <div className="rounded-[8px] border border-white/10 bg-[#0D1117] p-8 shadow-2xl shadow-black/30">
            <div className="mb-8 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
                  SuppVis
                </p>
                <h1 className="mt-2 font-headline text-4xl font-extrabold">
                  Admin
                </h1>
                <p className="mt-3 text-sm text-text-secondary">
                  Authorized access only.
                </p>
              </div>
              <img
                src="/favicon.svg"
                alt=""
                className="h-12 w-12 rounded-full border border-accent/30 bg-accent/10 p-1"
              />
            </div>

            {authConfigured && !hasAuthError ? (
              <form action={signInAction} className="mt-7">
                <button className="w-full rounded-full bg-accent px-5 py-3 text-sm font-bold text-[#03100E] transition duration-150 ease-out hover:-translate-y-0.5 hover:bg-accent-hover active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0D1117]">
                  Continue
                </button>
              </form>
            ) : (
              <div className="mt-7 rounded-[8px] border border-yellow-400/20 bg-yellow-400/10 p-4 text-sm leading-6 text-yellow-100">
                Access unavailable.
              </div>
            )}

          </div>

          <aside className="rounded-[8px] border border-white/10 bg-[#080D12] p-8 shadow-2xl shadow-black/20">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
              Public website
            </p>
            <h2 className="mt-2 font-headline text-3xl font-bold">
              Looking for SuppVis?
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-text-secondary">
              If you were trying to visit the SuppVis website, join the beta,
              or read about the product, use the link below to return to the
              public site.
            </p>

            <div className="mt-6 rounded-[8px] border border-accent/20 bg-accent/10 p-4">
              <p className="text-sm leading-6 text-text-secondary">
                This page is for a small administrative workflow. If that is
                not what you need, head back to the main SuppVis experience.
              </p>
              <Link
                href="/"
                className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-accent px-5 py-3 text-sm font-bold text-[#03100E] transition duration-150 ease-out hover:-translate-y-0.5 hover:bg-accent-hover active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#080D12]"
              >
                Return to website
              </Link>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
