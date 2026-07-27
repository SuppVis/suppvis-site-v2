import { NextResponse, type NextRequest } from "next/server";
import {
  buildAudienceHealth,
  buildAudienceSnapshot,
} from "@/app/lib/server/admin/audience";
import { requireAdminSession } from "@/app/lib/server/admin-session";
import { handleApiError } from "@/app/lib/server/errors";
import { enforceRateLimit } from "@/app/lib/server/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const rateLimited = enforceRateLimit(request, {
      scope: "admin-audience-health",
      limit: 30,
      windowMs: 60_000,
    });

    if (rateLimited) {
      return rateLimited;
    }

    await requireAdminSession();
    const [health, snapshot] = await Promise.all([
      buildAudienceHealth(),
      buildAudienceSnapshot(),
    ]);

    return NextResponse.json(
      {
        ok: true,
        health: {
          ...health,
          query: {
            checkedAt: snapshot.countedAt,
            email: {
              errorCode: snapshot.email.errorCode,
              recordsExamined: snapshot.email.totalCount,
              status: snapshot.email.status,
            },
            sms: {
              errorCode: snapshot.sms.errorCode,
              recordsExamined: snapshot.sms.totalCount,
              status: snapshot.sms.status,
            },
          },
        },
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
