import type { Metadata } from "next";
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
      <section className="mx-auto max-w-xl rounded-[8px] border border-white/10 bg-[#0D1117] p-8 shadow-2xl shadow-black/30">
        <div className="mb-8 flex items-center justify-between gap-3">
          <div>
            <h1 className="font-headline text-4xl font-extrabold">Admin</h1>
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
            <button className="w-full rounded-full bg-accent px-5 py-3 text-sm font-bold text-[#03100E] transition hover:bg-accent-hover">
              Continue
            </button>
          </form>
        ) : (
          <div className="mt-7 rounded-[8px] border border-yellow-400/20 bg-yellow-400/10 p-4 text-sm leading-6 text-yellow-100">
            Access unavailable.
          </div>
        )}
      </section>
    </main>
  );
}
