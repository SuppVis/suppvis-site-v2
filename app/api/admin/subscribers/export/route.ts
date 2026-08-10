import { NextResponse, type NextRequest } from "next/server";
import { requireAdminSession } from "@/app/lib/server/admin-session";
import {
  listAdminBetaSubscribersForExport,
} from "@/app/lib/server/beta-subscribers";
import {
  buildSubscriberExportWorkbook,
  subscriberExportFilename,
} from "@/app/lib/server/subscriber-export";
import { xlsxContentType } from "@/app/lib/server/xlsx";
import {
  handleApiError,
  PersistenceError,
  PublicApiError,
} from "@/app/lib/server/errors";
import { enforceRateLimit } from "@/app/lib/server/request";
import { adminSubscriberExportQuerySchema } from "@/app/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function logSubscriberExportError(operation: string, error: unknown) {
  console.error("[admin/subscribers/export] operation failed", {
    operation,
    route: "/api/admin/subscribers/export",
    errorCode: error instanceof PersistenceError ? error.code : undefined,
    errorName: error instanceof Error ? error.name : "UnknownError",
    causeName: error instanceof PersistenceError ? error.causeName : undefined,
  });
}

export async function GET(request: NextRequest) {
  try {
    const rateLimited = enforceRateLimit(request, {
      scope: "admin-subscribers-export",
      limit: 20,
      windowMs: 60_000,
    });

    if (rateLimited) {
      return rateLimited;
    }

    await requireAdminSession();

    const query = adminSubscriberExportQuerySchema.parse({
      delivery: request.nextUrl.searchParams.get("delivery") || undefined,
      priority: request.nextUrl.searchParams.get("priority") || undefined,
      search: request.nextUrl.searchParams.get("search") || undefined,
      sort: request.nextUrl.searchParams.get("sort") || undefined,
    });
    const result = await listAdminBetaSubscribersForExport({
      deliveryFilter: query.delivery,
      priorityFilter: query.priority,
      search: query.search,
      sort: query.sort,
    });
    const now = new Date();
    const workbook = buildSubscriberExportWorkbook({
      priorityFilter: query.priority,
      priorityLimit: result.priorityLimit,
      search: query.search,
      sort: query.sort,
      subscribers: result.items,
      totalPriorityCount: result.priorityCount,
      now,
    });
    const filename = subscriberExportFilename(now);

    return new NextResponse(workbook, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(workbook.length),
        "Content-Type": xlsxContentType(),
      },
    });
  } catch (error) {
    logSubscriberExportError("export_beta_subscribers", error);

    if (error instanceof PersistenceError) {
      return handleApiError(
        new PublicApiError(
          503,
          "subscriber_export_failed",
          "Beta subscriber export could not be generated. Please try again.",
        ),
      );
    }

    return handleApiError(error);
  }
}
