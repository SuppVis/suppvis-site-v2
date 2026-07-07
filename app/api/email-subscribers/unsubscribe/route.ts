import { NextResponse, type NextRequest } from "next/server";
import { handleApiError } from "@/app/lib/server/errors";
import { unsubscribeEmailSubscriber } from "@/app/lib/server/persistence";
import {
  enforceRateLimit,
  readJsonBody,
} from "@/app/lib/server/request";
import { emailUnsubscribeSchema } from "@/app/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const rateLimited = enforceRateLimit(request, {
      scope: "email-unsubscribe",
      limit: 10,
      windowMs: 60_000,
    });

    if (rateLimited) {
      return rateLimited;
    }

    const body = await readJsonBody(request);
    const submission = emailUnsubscribeSchema.parse(body);
    const unsubscribed = await unsubscribeEmailSubscriber({
      id: submission.subscriberId,
      token: submission.token,
      now: new Date().toISOString(),
    });

    if (!unsubscribed) {
      return NextResponse.json(
        {
          ok: false,
          code: "invalid_unsubscribe_link",
          message: "This unsubscribe link is invalid or expired.",
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      message: "You're unsubscribed from SuppVis emails.",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
