import { NextResponse, type NextRequest } from "next/server";
import { recordAdminCampaignAudit } from "@/app/lib/server/admin-campaign-audit";
import { requireAdminSession } from "@/app/lib/server/admin-session";
import {
  backfillBetaSubscriberMetadata,
  listAdminBetaSubscribers,
} from "@/app/lib/server/beta-subscribers";
import { handleApiError } from "@/app/lib/server/errors";
import { enforceRateLimit } from "@/app/lib/server/request";
import { adminSubscriberListQuerySchema } from "@/app/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const rateLimited = enforceRateLimit(request, {
      scope: "admin-subscribers-list",
      limit: 80,
      windowMs: 60_000,
    });

    if (rateLimited) {
      return rateLimited;
    }

    await requireAdminSession();
    const query = adminSubscriberListQuerySchema.parse({
      page: request.nextUrl.searchParams.get("page") || undefined,
      pageSize: request.nextUrl.searchParams.get("pageSize") || undefined,
      priority: request.nextUrl.searchParams.get("priority") || undefined,
      search: request.nextUrl.searchParams.get("search") || undefined,
      sort: request.nextUrl.searchParams.get("sort") || undefined,
    });
    const result = await listAdminBetaSubscribers({
      page: query.page,
      pageSize: query.pageSize,
      priorityFilter: query.priority,
      search: query.search,
      sort: query.sort,
    });

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const rateLimited = enforceRateLimit(request, {
      scope: "admin-subscribers-backfill",
      limit: 3,
      windowMs: 60_000,
    });

    if (rateLimited) {
      return rateLimited;
    }

    const admin = await requireAdminSession();
    const result = await backfillBetaSubscriberMetadata();

    await recordAdminCampaignAudit({
      action: "subscriber_metadata_backfilled",
      adminIdentifier: admin.identifier,
      status: `count=${result.backfilledCount} priority=${result.priorityCount}`,
    });

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
