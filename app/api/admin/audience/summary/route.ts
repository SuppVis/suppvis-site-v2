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
      scope: "admin-audience-summary",
      limit: 30,
      windowMs: 60_000,
    });

    if (rateLimited) {
      return rateLimited;
    }

    await requireAdminSession();

    const [snapshot, health] = await Promise.all([
      buildAudienceSnapshot(),
      buildAudienceHealth(),
    ]);

    return NextResponse.json(
      {
        ok: true,
        summary: {
          checkedAt: snapshot.countedAt,
          email: snapshot.email,
          health,
          refreshResult: snapshot.refreshResult,
          sms: snapshot.sms,
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
