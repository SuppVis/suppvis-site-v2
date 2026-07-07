import { NextResponse, type NextRequest } from "next/server";
import { stableId } from "@/app/lib/server/crypto";
import {
  assertDynamoTablesConfigured,
  DYNAMO_TABLE_ENVS,
} from "@/app/lib/server/dynamo";
import { handleApiError } from "@/app/lib/server/errors";
import {
  enforceRateLimit,
  isHoneypotFilled,
  readJsonBody,
} from "@/app/lib/server/request";
import {
  saveBetaApplication,
  saveSmsSubscriber,
} from "@/app/lib/server/persistence";
import {
  betaApplicationSchema,
  normalizeDisplayName,
  normalizeEmail,
  normalizePhoneToE164,
} from "@/app/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const rateLimited = enforceRateLimit(request, {
      scope: "beta-application",
      limit: 5,
      windowMs: 60_000,
    });

    if (rateLimited) {
      return rateLimited;
    }

    const body = await readJsonBody(request);
    const submission = betaApplicationSchema.parse(body);

    if (isHoneypotFilled(submission.botField)) {
      return NextResponse.json({ ok: true });
    }

    const now = new Date().toISOString();
    const firstName = normalizeDisplayName(submission.firstName);
    const lastName = normalizeDisplayName(submission.lastName);
    const normalizedEmail = normalizeEmail(submission.email);
    const phoneRaw = submission.phone.trim() || undefined;
    const phoneE164 = phoneRaw ? normalizePhoneToE164(phoneRaw) || undefined : undefined;
    const betaId = stableId("beta", normalizedEmail);
    const requiredTables: string[] = [DYNAMO_TABLE_ENVS.betaApplications];

    if (submission.smsOptIn) {
      requiredTables.push(DYNAMO_TABLE_ENVS.smsSubscribers);
    }

    assertDynamoTablesConfigured(...requiredTables);

    const betaCreated = await saveBetaApplication({
      id: betaId,
      first_name: firstName,
      last_name: lastName,
      email: submission.email.trim(),
      normalized_email: normalizedEmail,
      phone_raw: phoneRaw,
      phone_e164: phoneE164,
      sms_opt_in: submission.smsOptIn,
      status: "new",
      source_page: submission.sourcePage,
      created_at: now,
      updated_at: now,
    });

    if (!betaCreated) {
      return NextResponse.json({
        ok: true,
        duplicate: true,
        message: "You’re already signed up. We’ll reach out with beta access details soon.",
      });
    }

    if (submission.smsOptIn && phoneRaw && phoneE164) {
      await saveSmsSubscriber({
        id: stableId("sms", phoneE164),
        phone_number_raw: phoneRaw,
        phone_number_e164: phoneE164,
        status: "pending_verification",
        sms_consent_timestamp: now,
        sms_consent_source: `${submission.sourcePage}:beta_application`,
        opt_out_timestamp: null,
        created_at: now,
        updated_at: now,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
