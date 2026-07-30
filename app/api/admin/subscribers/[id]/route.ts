import { NextResponse, type NextRequest } from "next/server";
import { recordAdminCampaignAudit } from "@/app/lib/server/admin-campaign-audit";
import { requireAdminSession } from "@/app/lib/server/admin-session";
import {
  getAdminBetaSubscriber,
  updateBetaSubscriberNotes,
} from "@/app/lib/server/beta-subscribers";
import { handleApiError, PublicApiError } from "@/app/lib/server/errors";
import {
  enforceRateLimit,
  readJsonBody,
} from "@/app/lib/server/request";
import {
  adminSubscriberIdSchema,
  adminSubscriberNotesSchema,
} from "@/app/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const rateLimited = enforceRateLimit(request, {
      scope: "admin-subscriber-detail",
      limit: 100,
      windowMs: 60_000,
    });

    if (rateLimited) {
      return rateLimited;
    }

    await requireAdminSession();
    const id = adminSubscriberIdSchema.parse(params.id);
    const subscriber = await getAdminBetaSubscriber(id);

    if (!subscriber) {
      throw new PublicApiError(
        404,
        "subscriber_not_found",
        "Beta subscriber was not found.",
      );
    }

    return NextResponse.json({
      ok: true,
      subscriber,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const rateLimited = enforceRateLimit(request, {
      scope: "admin-subscriber-notes",
      limit: 30,
      windowMs: 60_000,
    });

    if (rateLimited) {
      return rateLimited;
    }

    const admin = await requireAdminSession();
    const id = adminSubscriberIdSchema.parse(params.id);
    const body = await readJsonBody(request);
    const submission = adminSubscriberNotesSchema.parse(body);
    const subscriber = await updateBetaSubscriberNotes({
      adminIdentifier: admin.identifier,
      expectedVersion: submission.expectedVersion,
      id,
      notes: submission.notes.trim(),
    });

    if (!subscriber) {
      throw new PublicApiError(
        409,
        "subscriber_conflict",
        "This subscriber changed in another admin session. Reload and try again.",
      );
    }

    await recordAdminCampaignAudit({
      action: "subscriber_notes_updated",
      adminIdentifier: admin.identifier,
      status: "notes_saved",
    });

    return NextResponse.json({
      ok: true,
      subscriber,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
