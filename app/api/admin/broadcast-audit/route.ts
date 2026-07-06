import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { requireAdminIdentifier } from "@/app/lib/server/admin-auth";
import { handleApiError } from "@/app/lib/server/errors";
import { saveBroadcastAudit } from "@/app/lib/server/persistence";
import {
  enforceRateLimit,
  readJsonBody,
} from "@/app/lib/server/request";
import { broadcastAuditSchema } from "@/app/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const rateLimited = enforceRateLimit(request, {
      scope: "admin-broadcast-audit",
      limit: 20,
      windowMs: 60_000,
    });

    if (rateLimited) {
      return rateLimited;
    }

    const adminIdentifier = requireAdminIdentifier(request);
    const body = await readJsonBody(request);
    const submission = broadcastAuditSchema.parse(body);
    const now = new Date().toISOString();

    await saveBroadcastAudit({
      id: `broadcast_audit_${randomUUID()}`,
      admin_identifier: adminIdentifier,
      channel: submission.channel,
      message_preview: submission.messagePreview.slice(0, 240),
      intended_audience: submission.intendedAudience,
      target_count: submission.targetCount,
      dry_run: true,
      status: "dry_run_recorded",
      created_at: now,
    });

    return NextResponse.json({
      ok: true,
      dryRun: true,
      status: "dry_run_recorded",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
