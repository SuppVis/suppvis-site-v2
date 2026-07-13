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
        <div className="mb-8 flex items-center gap-3">
          <img
            src="/favicon.svg"
            alt=""
            className="h-11 w-11 rounded-full border border-accent/30 bg-accent/10 p-1"
          />
          <div>
            <p className="font-headline text-2xl font-extrabold">SuppVis</p>
            <p className="text-sm text-text-muted">Admin access</p>
          </div>
        </div>

        <h1 className="font-headline text-4xl font-extrabold">
          Sign in with Microsoft
        </h1>
        <p className="mt-4 leading-7 text-text-secondary">
          Admin access requires a SuppVis Microsoft 365 account and an explicit
          server-side admin allowlist entry. The admin page is not linked from
          public navigation.
        </p>

        {authConfigured ? (
          <form action={signInAction} className="mt-7">
            <button className="w-full rounded-full bg-accent px-5 py-3 text-sm font-bold text-[#03100E] transition hover:bg-accent-hover">
              Continue with Microsoft 365
            </button>
          </form>
        ) : (
          <div className="mt-7 rounded-[8px] border border-yellow-400/20 bg-yellow-400/10 p-4 text-sm leading-6 text-yellow-100">
            Microsoft Entra auth is not configured yet. Add the required Auth.js
            and Microsoft Entra environment variables before signing in.
          </div>
        )}

        <div className="mt-7 rounded-[8px] border border-white/10 bg-[#080D12] p-4 text-sm leading-6 text-text-secondary">
          Recommended setup: single-tenant Microsoft Entra app, MFA required in
          Microsoft 365, and only named `@suppvis.health` admins in
          `ADMIN_ALLOWED_EMAILS`.
        </div>
      </section>
    </main>
  );
}
