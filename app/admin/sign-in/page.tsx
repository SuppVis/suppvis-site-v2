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

            <Link
              href="/"
              className="mt-5 inline-flex min-h-10 items-center justify-center rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-text-secondary transition duration-150 ease-out hover:-translate-y-0.5 hover:border-accent/50 hover:text-accent active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0D1117]"
            >
              Return to website
            </Link>
          </div>

          <aside className="rounded-[8px] border border-white/10 bg-[#080D12] p-8 shadow-2xl shadow-black/20">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
              Workspace
            </p>
            <h2 className="mt-2 font-headline text-3xl font-bold">
              Keep beta updates organized
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-text-secondary">
              A focused place for writing SuppVis beta emails, checking the
              final preview, and reviewing delivery progress after a send.
            </p>

            <div className="mt-6 space-y-3">
              {[
                ["Write", "Draft one update at a time with structured fields."],
                ["Review", "Preview the branded email before it leaves the team."],
                ["Send", "Start subscriber delivery only after the full checklist."],
              ].map(([label, body]) => (
                <div
                  key={label}
                  className="flex gap-3 border-t border-white/10 pt-3 first:border-t-0 first:pt-0"
                >
                  <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-accent shadow-[0_0_16px_rgba(34,211,186,0.45)]" />
                  <div>
                    <p className="text-sm font-bold text-text-primary">
                      {label}
                    </p>
                    <p className="mt-1 text-sm leading-5 text-text-secondary">
                      {body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
