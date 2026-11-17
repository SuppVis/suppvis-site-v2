import { NextResponse, type NextRequest } from "next/server";
import { createUrlSafeToken } from "@/app/lib/server/crypto";
import { sendClinicLeadEmail } from "@/app/lib/server/email/clinic-lead";
import { handleApiError } from "@/app/lib/server/errors";
import {
  enforceRateLimit,
  isHoneypotFilled,
  readJsonBody,
} from "@/app/lib/server/request";
import {
  clinicWaitlistSchema,
  normalizeEmail,
} from "@/app/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Founding-practice waitlist for /clinics. Mirrors the beta-applications
// handler (rate limit, JSON body, zod, honeypot, handleApiError). Persistence
// is an email to the team via SES; no DynamoDB table yet.
export async function POST(request: NextRequest) {
  try {
    const rateLimited = enforceRateLimit(request, {
      scope: "clinic-waitlist",
      limit: 5,
      windowMs: 60_000,
    });

    if (rateLimited) {
      return rateLimited;
    }

    const body = await readJsonBody(request);
    const submission = clinicWaitlistSchema.parse(body);

    if (isHoneypotFilled(submission.botField)) {
      console.warn("[clinic-waitlist] honeypot rejected", {
        route: "/api/clinic-waitlist",
      });

      return NextResponse.json(
        {
          ok: false,
          code: "invalid_submission",
          message: "Please submit the form again.",
        },
        { status: 400 },
      );
    }

    const requestId =
      request.headers.get("x-vercel-id") || createUrlSafeToken().slice(0, 16);

    const { messageId } = await sendClinicLeadEmail({
      practiceName: submission.practiceName,
      roleCredential: submission.roleCredential,
      email: normalizeEmail(submission.email),
      practiceType: submission.practiceType,
      dispensing: submission.dispensing,
      dispensingOther:
        submission.dispensing === "Other" ? submission.dispensingOther : "",
      sourcePage: submission.sourcePage,
      submittedAt: new Date().toISOString(),
      requestId,
    });

    console.info("[clinic-waitlist] lead delivered", { requestId, messageId });

    return NextResponse.json({ ok: true, result: "received" });
  } catch (error) {
    return handleApiError(error);
  }
}
