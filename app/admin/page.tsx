import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import {
  getAdminAccess,
  isMicrosoftAuthConfigured,
  maskAdminEmail,
} from "@/app/lib/server/admin-access";
import AdminCampaignDraft from "./AdminCampaignDraft";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "SuppVis Admin",
  robots: {
    index: false,
    follow: false,
  },
};

async function signOutAction() {
  "use server";
  await signOut({ redirectTo: "/admin/sign-in" });
}

function AdminBlocked({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <main className="min-h-screen bg-bg-primary px-5 py-10 text-text-primary">
      <section className="mx-auto max-w-2xl rounded-[8px] border border-white/10 bg-[#0D1117] p-8 shadow-2xl shadow-black/30">
        <div className="mb-6 flex items-center gap-3">
          <img
            src="/favicon.svg"
            alt=""
            className="h-10 w-10 rounded-full border border-accent/30 bg-accent/10 p-1"
          />
          <span className="font-headline text-2xl font-extrabold">SuppVis</span>
        </div>
        <h1 className="font-headline text-4xl font-extrabold">{title}</h1>
        <p className="mt-4 leading-7 text-text-secondary">{message}</p>
        <a
          href="/admin/sign-in"
          className="mt-7 inline-flex rounded-full bg-accent px-5 py-3 text-sm font-bold text-[#03100E]"
        >
          Go to sign in
        </a>
      </section>
    </main>
  );
}

export default async function AdminPage() {
  if (!isMicrosoftAuthConfigured()) {
    return (
      <AdminBlocked
        title="Admin auth is not configured"
        message="Microsoft Entra admin login is not active yet. Add the Auth.js and Microsoft Entra environment variables before using this page."
      />
    );
  }

  const session = await auth();
  const access = getAdminAccess(session);

  if (!access.ok && access.reason === "not_authenticated") {
    redirect("/admin/sign-in?callbackUrl=/admin");
  }

  if (!access.ok) {
    return (
      <AdminBlocked
        title="You do not have admin access"
        message={`Signed in as ${maskAdminEmail(
          access.email,
        )}. This account is not on the SuppVis admin allowlist.`}
      />
    );
  }

  return (
    <main className="min-h-screen bg-bg-primary px-5 py-8 text-text-primary">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-col gap-5 border-b border-white/10 pb-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-3">
              <img
                src="/favicon.svg"
                alt=""
                className="h-10 w-10 rounded-full border border-accent/30 bg-accent/10 p-1"
              />
              <span className="font-headline text-2xl font-extrabold">
                SuppVis Admin
              </span>
            </div>
            <h1 className="font-headline text-4xl font-extrabold tracking-tight">
              Beta email campaigns
            </h1>
            <p className="mt-3 max-w-2xl leading-7 text-text-secondary">
              Protected by Microsoft Entra login plus a server-side admin
              allowlist. This phase supports drafting and preview only.
            </p>
          </div>
          <div className="rounded-[8px] border border-white/10 bg-[#0D1117] p-4 text-sm text-text-secondary">
            <p className="font-semibold text-text-primary">
              {maskAdminEmail(access.email)}
            </p>
            <form action={signOutAction} className="mt-3">
              <button className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-text-primary transition hover:border-accent/60 hover:text-accent">
                Sign out
              </button>
            </form>
          </div>
        </header>

        <div className="mb-5 grid gap-4 md:grid-cols-3">
          {[
            ["Draft", "Create copy and preview it in SuppVis styling."],
            ["Test send", "Disabled until explicitly approved."],
            ["Campaign send", "Disabled until queued sending is built."],
          ].map(([title, body]) => (
            <div
              key={title}
              className="rounded-[8px] border border-white/10 bg-[#0D1117] p-4"
            >
              <p className="font-semibold text-text-primary">{title}</p>
              <p className="mt-2 text-sm leading-6 text-text-secondary">
                {body}
              </p>
            </div>
          ))}
        </div>

      <AdminCampaignDraft
        adminEmail={access.email}
        testSendEnabled={
          process.env.ADMIN_EMAIL_CAMPAIGNS_ENABLED === "true" &&
          process.env.ADMIN_EMAIL_TEST_SEND_ENABLED === "true"
        }
        />
      </div>
    </main>
  );
}
