import { NextResponse, type NextRequest } from "next/server";
import { requireAdminSession } from "@/app/lib/server/admin-session";
import { getCommunicationHistoryForSubscriber } from "@/app/lib/server/admin/communication-history";
import { getAdminBetaSubscriber } from "@/app/lib/server/beta-subscribers";
import {
  handleApiError,
  PersistenceError,
  PublicApiError,
} from "@/app/lib/server/errors";
import { enforceRateLimit } from "@/app/lib/server/request";
import { adminSubscriberIdSchema } from "@/app/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const rateLimited = enforceRateLimit(request, {
      scope: "admin-subscriber-communication-history",
      limit: 80,
      windowMs: 60_000,
    });

    if (rateLimited) {
      return rateLimited;
    }

    await requireAdminSession();
    const id = adminSubscriberIdSchema.parse(params.id);
    const subscriber = await getAdminBetaSubscriber(id, {
      includeCommunicationStats: false,
    });

    if (!subscriber) {
      throw new PublicApiError(
        404,
        "subscriber_not_found",
        "Beta subscriber was not found.",
      );
    }

    const history = await getCommunicationHistoryForSubscriber(subscriber);

    return NextResponse.json({
      ok: true,
      ...history,
    });
  } catch (error) {
    if (error instanceof PersistenceError) {
      return handleApiError(
        new PublicApiError(
          503,
          "subscriber_communication_history_failed",
          "Communication history could not be loaded. Please try again.",
        ),
      );
    }

    return handleApiError(error);
  }
}
