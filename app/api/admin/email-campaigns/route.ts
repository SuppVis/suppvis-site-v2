import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { recordAdminCampaignAudit } from "@/app/lib/server/admin-campaign-audit";
import { requireAdminSession } from "@/app/lib/server/admin-session";
import { handleApiError } from "@/app/lib/server/errors";
import {
  createEmailCampaignDraft,
  listRecentEmailCampaignDrafts,
  type EmailCampaignRecord,
} from "@/app/lib/server/persistence";
import {
  enforceRateLimit,
  readJsonBody,
} from "@/app/lib/server/request";
import { createAdminCampaignSchema } from "@/app/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function campaignResponse(record: EmailCampaignRecord) {
  return {
    id: record.id,
    messageType: record.message_type,
    subject: record.subject,
    heading: record.heading,
    body: record.body,
    ctaLabel: record.cta_label,
    ctaUrl: record.cta_url,
    status: record.status,
    createdBy: record.created_by,
    updatedBy: record.updated_by,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    version: record.version,
    testedAt: record.tested_at,
    approvedAt: record.approved_at,
    sentAt: record.sent_at,
    testRecipient: record.test_recipient,
    recipientCount: record.recipient_count || 0,
    eligibleCount: record.eligible_count || 0,
    excludedCount: record.excluded_count || 0,
    queuedCount: record.queued_count || 0,
    sentCount: record.sent_count || 0,
    deliveredCount: record.delivered_count || 0,
    failedCount: record.failed_count || 0,
    skippedCount: record.skipped_count || 0,
  };
}

export async function GET(request: NextRequest) {
  try {
    const rateLimited = enforceRateLimit(request, {
      scope: "admin-email-campaigns-list",
      limit: 60,
      windowMs: 60_000,
    });

    if (rateLimited) {
      return rateLimited;
    }

    await requireAdminSession();

    const drafts = await listRecentEmailCampaignDrafts(20);

    return NextResponse.json({
      ok: true,
      drafts: drafts.map((draft) => ({
        id: draft.id,
        messageType: draft.message_type,
        subject: draft.subject,
        heading: draft.heading,
        status: draft.status,
        createdBy: draft.created_by,
        updatedBy: draft.updated_by,
        createdAt: draft.created_at,
        updatedAt: draft.updated_at,
        version: draft.version,
        testedAt: draft.tested_at,
        approvedAt: draft.approved_at,
        testRecipient: draft.test_recipient,
        recipientCount: draft.recipient_count || 0,
        queuedCount: draft.queued_count || 0,
        sentCount: draft.sent_count || 0,
        deliveredCount: draft.delivered_count || 0,
        failedCount: draft.failed_count || 0,
        skippedCount: draft.skipped_count || 0,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const rateLimited = enforceRateLimit(request, {
      scope: "admin-email-campaigns-create",
      limit: 20,
      windowMs: 60_000,
    });

    if (rateLimited) {
      return rateLimited;
    }

    const admin = await requireAdminSession();
    const body = await readJsonBody(request);
    const submission = createAdminCampaignSchema.parse(body);
    const now = new Date().toISOString();
    const record: EmailCampaignRecord = {
      id: `email_campaign_${randomUUID()}`,
      record_type: "email_campaign",
      message_type: submission.messageType,
      subject: submission.subject,
      heading: submission.heading,
      body: submission.body,
      cta_label: submission.ctaLabel,
      cta_url: submission.ctaUrl,
      status: "draft",
      created_by: admin.identifier,
      updated_by: admin.identifier,
      created_at: now,
      updated_at: now,
      version: 1,
      tested_at: null,
      approved_at: null,
      sent_at: null,
      test_recipient: null,
    };

    await createEmailCampaignDraft(record);
    await recordAdminCampaignAudit({
      action: "draft_created",
      adminIdentifier: admin.identifier,
      campaignId: record.id,
      status: record.status,
    });

    return NextResponse.json({
      ok: true,
      campaign: campaignResponse(record),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
