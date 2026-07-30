import { NextResponse, type NextRequest } from "next/server";
import { recordAdminCampaignAudit } from "@/app/lib/server/admin-campaign-audit";
import { requireAdminSession } from "@/app/lib/server/admin-session";
import { setAdminBetaSubscriberPriority } from "@/app/lib/server/beta-subscribers";
import { handleApiError, PublicApiError } from "@/app/lib/server/errors";
import {
  enforceRateLimit,
  readJsonBody,
} from "@/app/lib/server/request";
import {
  adminSubscriberIdSchema,
  adminSubscriberPrioritySchema,
} from "@/app/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const rateLimited = enforceRateLimit(request, {
      scope: "admin-subscriber-priority",
      limit: 30,
      windowMs: 60_000,
    });

    if (rateLimited) {
      return rateLimited;
    }

    const admin = await requireAdminSession();
    const id = adminSubscriberIdSchema.parse(params.id);
    const body = await readJsonBody(request);
    const submission = adminSubscriberPrioritySchema.parse(body);
    const result = await setAdminBetaSubscriberPriority({
      adminIdentifier: admin.identifier,
      expectedVersion: submission.expectedVersion,
      id,
      priority: submission.priority,
      replacementSubscriberId: submission.replacementSubscriberId,
    });

    if (result.status === "not_found") {
      throw new PublicApiError(
        404,
        "subscriber_not_found",
        "Beta subscriber was not found.",
      );
    }

    if (result.status === "priority_full") {
      throw new PublicApiError(
        409,
        "priority_group_full",
        "The priority beta group is full. Remove a priority user or choose one to replace.",
      );
    }

    if (result.status === "replacement_invalid") {
      throw new PublicApiError(
        400,
        "priority_replacement_invalid",
        "Choose a current priority user to replace.",
      );
    }

    if (result.status === "conflict") {
      throw new PublicApiError(
        409,
        "subscriber_conflict",
        "This subscriber changed in another admin session. Reload and try again.",
      );
    }

    await recordAdminCampaignAudit({
      action: submission.priority
        ? "subscriber_priority_promoted"
        : "subscriber_priority_removed",
      adminIdentifier: admin.identifier,
      status: submission.replacementSubscriberId
        ? "priority_replacement"
        : "priority_updated",
    });

    return NextResponse.json({
      ok: true,
      subscriber: result.subscriber,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
