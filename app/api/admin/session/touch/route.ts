import { NextResponse, type NextRequest } from "next/server";
import { requireAdminSession } from "@/app/lib/server/admin-session";
import { handleApiError } from "@/app/lib/server/errors";
import { enforceRateLimit } from "@/app/lib/server/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const rateLimited = enforceRateLimit(request, {
      scope: "admin-session-touch",
      limit: 20,
      windowMs: 60_000,
    });

    if (rateLimited) {
      return rateLimited;
    }

    await requireAdminSession();

    return NextResponse.json(
      {
        ok: true,
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
