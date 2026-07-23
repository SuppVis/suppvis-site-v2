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
        title="Access unavailable"
        message="Authorized access only."
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
        title="Access unavailable"
        message="Authorized access only."
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
              Beta emails & texts
            </h1>
            <p className="mt-3 max-w-2xl leading-7 text-text-secondary">
              Create, preview, test, and safely send beta announcements by
              email and text.
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

        <section className="mb-5 rounded-[8px] border border-white/10 bg-[#0D1117] p-5 shadow-2xl shadow-black/20">
          <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
                Announcement workspace
              </p>
              <h2 className="mt-2 font-headline text-2xl font-bold text-text-primary">
                Compose one beta update at a time
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-text-secondary">
                Drafts are saved before sending, previews use the same branded
                renderer as final delivery, and subscriber sends use channel
                consent plus suppression checks for each recipient.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              {[
                ["Audience", "Eligible email and text consent records"],
                ["Safety", "Admin tests before approval"],
                ["Tracking", "Queued, accepted, and delivered states"],
              ].map(([label, body]) => (
                <div
                  key={label}
                  className="rounded-[8px] border border-white/10 bg-[#080D12] p-3"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
                    {label}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-text-primary">
                    {body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="mb-5 grid gap-4 md:grid-cols-3">
          {[
            ["Draft", "Write and save the email and text drafts."],
            ["Admin review", "Preview both formats and send the admin test."],
            [
              "Subscriber delivery",
              process.env.ADMIN_EMAIL_BULK_SEND_INFRA_READY === "true"
                ? "Send both channels only after recipient review."
                : "Sending is not available while setup is being prepared.",
            ],
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
        bulkSendEnabled={
          process.env.ADMIN_EMAIL_CAMPAIGNS_ENABLED === "true" &&
          process.env.ADMIN_EMAIL_BULK_SEND_ENABLED === "true"
        }
        bulkInfraReady={
          process.env.ADMIN_EMAIL_BULK_SEND_INFRA_READY === "true"
        }
        smsTestSendEnabled={
          process.env.ADMIN_SMS_ANNOUNCEMENTS_ENABLED === "true" &&
          process.env.ADMIN_SMS_TEST_SEND_ENABLED === "true"
        }
        smsBulkSendEnabled={
          process.env.ADMIN_SMS_ANNOUNCEMENTS_ENABLED === "true" &&
          process.env.ADMIN_SMS_BULK_SEND_ENABLED === "true"
        }
        smsBulkInfraReady={
          process.env.ADMIN_SMS_BULK_SEND_INFRA_READY === "true"
        }
        />
      </div>
    </main>
  );
}
