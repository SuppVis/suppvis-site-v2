import { NextResponse, type NextRequest } from "next/server";
import { requireAdminSession } from "@/app/lib/server/admin-session";
import { handleApiError, PublicApiError } from "@/app/lib/server/errors";
import {
  getEmailCampaign,
  listEmailCampaignRecipients,
} from "@/app/lib/server/persistence";
import { enforceRateLimit } from "@/app/lib/server/request";
import { adminCampaignIdSchema } from "@/app/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTIVE_STATUSES = new Set(["queueing", "queued", "sending"]);
const RECIPIENT_STATUSES = new Set([
  "bounced",
  "complained",
  "delivery_delayed",
  "delivered",
  "failed",
  "queueing",
  "queued",
  "rejected",
  "sending",
  "sent",
  "skipped",
]);

function zeroCounts() {
  return {
    bounced: 0,
    complained: 0,
    delayed: 0,
    delivered: 0,
    failed: 0,
    queued: 0,
    rejected: 0,
    sending: 0,
    sent: 0,
    skipped: 0,
    total: 0,
  };
}

function isProviderAccepted(recipient: {
  channel?: "email" | "sms";
  ses_message_id?: string;
  status: string;
  twilio_message_sid?: string;
}) {
  const channel = recipient.channel || "email";

  if (channel === "email") {
    return Boolean(recipient.ses_message_id) ||
      recipient.status === "sent" ||
      recipient.status === "delivered" ||
      recipient.status === "delivery_delayed" ||
      recipient.status === "bounced" ||
      recipient.status === "complained" ||
      recipient.status === "rejected" ||
      recipient.status === "failed";
  }

  return Boolean(recipient.twilio_message_sid) ||
    recipient.status === "sent" ||
    recipient.status === "delivered" ||
    recipient.status === "failed";
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const rateLimited = enforceRateLimit(request, {
      scope: "admin-email-campaign-progress",
      limit: 120,
      windowMs: 60_000,
    });

    if (rateLimited) {
      return rateLimited;
    }

    await requireAdminSession();
    const id = adminCampaignIdSchema.parse(params.id);
    const campaign = await getEmailCampaign(id);

    if (!campaign) {
      throw new PublicApiError(
        404,
        "campaign_not_found",
        "Email draft was not found.",
      );
    }

    const counts = zeroCounts();
    const recipients = await listEmailCampaignRecipients(id);
    let eligible = 0;
    let excluded = 0;

    for (const recipient of recipients) {
      counts.total += 1;

      if (recipient.eligibility_decision === "eligible") {
        counts.queued += 1;
        eligible += 1;
      } else {
        excluded += 1;
        counts.skipped += 1;
      }

      if (isProviderAccepted(recipient)) {
        counts.sent += 1;
      }

      if (recipient.status === "delivery_delayed") {
        counts.delayed += 1;
      } else if (recipient.status === "queueing") {
        counts.sending += 1;
      } else if (
        recipient.status !== "queued" &&
        recipient.status !== "sent" &&
        recipient.status !== "skipped" &&
        RECIPIENT_STATUSES.has(recipient.status)
      ) {
        counts[recipient.status as keyof typeof counts] += 1;
      }
    }
    const hasRecipientRows = recipients.length > 0;

    const response = NextResponse.json({
      ok: true,
      progress: {
        campaignStatus: campaign.status,
        completedAt: campaign.completed_at,
        eligible: hasRecipientRows
          ? eligible
          : (campaign.eligible_count || 0) +
            (campaign.sms_eligible_count || 0),
        excluded: hasRecipientRows
          ? excluded
          : (campaign.excluded_count || 0) +
            (campaign.sms_excluded_count || 0),
        isActive: ACTIVE_STATUSES.has(campaign.status),
        counts,
        updatedAt: campaign.updated_at,
      },
    });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
