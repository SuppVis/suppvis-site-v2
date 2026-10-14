import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getAdminAccess, isMicrosoftAuthConfigured } from "@/app/lib/server/admin-access";
import ApplyServingExclusion from "./ApplyServingExclusion";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ApplyServingExclusionPage() {
  if (!isMicrosoftAuthConfigured()) redirect("/admin/sign-in");
  const access = getAdminAccess(await auth());
  if (!access.ok && access.reason === "not_authenticated") {
    redirect("/admin/sign-in?callbackUrl=/admin/catalog/apply-serving-exclusion");
  }
  if (!access.ok) redirect("/admin");

  return <main className="min-h-screen bg-bg-primary px-5 py-10 text-text-primary">
    <div className="mx-auto max-w-2xl"><ApplyServingExclusion /></div>
  </main>;
}
