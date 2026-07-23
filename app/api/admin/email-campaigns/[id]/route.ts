import { NextResponse, type NextRequest } from "next/server";
import { recordAdminCampaignAudit } from "@/app/lib/server/admin-campaign-audit";
import { requireAdminSession } from "@/app/lib/server/admin-session";
import { handleApiError, PublicApiError } from "@/app/lib/server/errors";
import {
  archiveEmailCampaignDraft,
  getEmailCampaign,
  updateEmailCampaignDraft,
  type EmailCampaignRecord,
} from "@/app/lib/server/persistence";
import {
  enforceRateLimit,
  readJsonBody,
} from "@/app/lib/server/request";
import {
  adminCampaignIdSchema,
  adminCampaignVersionSchema,
  updateAdminCampaignSchema,
} from "@/app/lib/server/validation";
import { renderAdminSmsAnnouncement } from "@/app/lib/server/messages/admin-sms";

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
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    version: record.version,
    testedAt: record.tested_at,
    approvedAt: record.approved_at,
    sentAt: record.sent_at,
    recipientCount: record.recipient_count || 0,
    eligibleCount: record.eligible_count || 0,
    excludedCount: record.excluded_count || 0,
    queuedCount: record.queued_count || 0,
    sentCount: record.sent_count || 0,
    deliveredCount: record.delivered_count || 0,
    failedCount: record.failed_count || 0,
    skippedCount: record.skipped_count || 0,
    smsEnabled: record.sms_enabled || false,
    smsBody: record.sms_body || "",
    smsRenderedBody: record.sms_rendered_body || "",
    smsDraftVersion: record.sms_draft_version || 0,
    smsSavedAt: record.sms_saved_at || null,
    smsTestedAt: record.sms_tested_at || null,
    smsCharacterCount: record.sms_character_count || 0,
    smsSegmentCount: record.sms_segment_count || 0,
    smsEncoding: record.sms_encoding || "GSM-7",
    smsEligibleCount: record.sms_eligible_count || 0,
    smsExcludedCount: record.sms_excluded_count || 0,
    smsDuplicateCount: record.sms_duplicate_count || 0,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const rateLimited = enforceRateLimit(request, {
      scope: "admin-email-campaign-load",
      limit: 80,
      windowMs: 60_000,
    });

    if (rateLimited) {
      return rateLimited;
    }

    await requireAdminSession();
    const id = adminCampaignIdSchema.parse(params.id);
    const campaign = await getEmailCampaign(id);

    if (!campaign) {
      throw new PublicApiError(
        404,
        "campaign_not_found",
        "Email draft was not found.",
      );
    }

    return NextResponse.json({
      ok: true,
      campaign: campaignResponse(campaign),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const rateLimited = enforceRateLimit(request, {
      scope: "admin-email-campaign-update",
      limit: 40,
      windowMs: 60_000,
    });

    if (rateLimited) {
      return rateLimited;
    }

    const admin = await requireAdminSession();
    const id = adminCampaignIdSchema.parse(params.id);
    const body = await readJsonBody(request);
    const submission = updateAdminCampaignSchema.parse(body);
    const now = new Date().toISOString();
    const smsPreview = submission.smsEnabled
      ? renderAdminSmsAnnouncement(submission.smsBody)
      : null;

    const updated = await updateEmailCampaignDraft({
      id,
      body: submission.body,
      cta_label: submission.ctaLabel,
      cta_url: submission.ctaUrl,
      expectedVersion: submission.expectedVersion,
      heading: submission.heading,
      message_type: submission.messageType,
      now,
      subject: submission.subject,
      updated_by: admin.identifier,
      sms_enabled: submission.smsEnabled,
      sms_body: smsPreview?.editableBody || "",
      sms_rendered_body: smsPreview?.body || "",
      sms_character_count: smsPreview?.characterCount || 0,
      sms_segment_count: smsPreview?.segmentCount || 0,
      sms_encoding: smsPreview?.encoding || "GSM-7",
    });

    if (!updated) {
      throw new PublicApiError(
        409,
        "campaign_conflict",
        "This draft changed in another session. Reload it and try again.",
      );
    }

    await recordAdminCampaignAudit({
      action: "draft_updated",
      adminIdentifier: admin.identifier,
      campaignId: id,
      status: updated.sms_enabled ? "draft email+text" : updated.status,
    });

    return NextResponse.json({
      ok: true,
      campaign: campaignResponse(updated),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const rateLimited = enforceRateLimit(request, {
      scope: "admin-email-campaign-delete",
      limit: 20,
      windowMs: 60_000,
    });

    if (rateLimited) {
      return rateLimited;
    }

    const admin = await requireAdminSession();
    const id = adminCampaignIdSchema.parse(params.id);
    const body = await readJsonBody(request);
    const submission = adminCampaignVersionSchema.parse(body);
    const archived = await archiveEmailCampaignDraft({
      id,
      expectedVersion: submission.expectedVersion,
      now: new Date().toISOString(),
      deleted_by: admin.identifier,
    });

    if (!archived) {
      throw new PublicApiError(
        409,
        "campaign_conflict",
        "This draft can no longer be deleted. Reload it and try again.",
      );
    }

    await recordAdminCampaignAudit({
      action: "draft_deleted",
      adminIdentifier: admin.identifier,
      campaignId: id,
      status: archived.status,
    });

    return NextResponse.json({
      ok: true,
      campaign: campaignResponse(archived),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
