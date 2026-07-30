import { NextResponse, type NextRequest } from "next/server";
import { recordAdminCampaignAudit } from "@/app/lib/server/admin-campaign-audit";
import { requireAdminSession } from "@/app/lib/server/admin-session";
import { handleApiError, PublicApiError } from "@/app/lib/server/errors";
import {
  archiveEmailCampaignDraft,
  getEmailCampaign,
  updateEmailCampaignAudienceSegment,
  updateEmailCampaignEmailDraft,
  updateEmailCampaignSmsDraft,
  type EmailCampaignRecord,
} from "@/app/lib/server/persistence";
import { campaignReadinessResponse } from "@/app/lib/server/email/campaign-readiness";
import {
  enforceRateLimit,
  readJsonBody,
} from "@/app/lib/server/request";
import {
  adminCampaignIdSchema,
  adminCampaignAudienceSegmentUpdateSchema,
  adminCampaignVersionSchema,
  updateAdminCampaignEmailSchema,
  updateAdminCampaignSmsSchema,
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
    emailDraftVersion: record.email_draft_version || record.version,
    emailPreviewGeneratedAt: record.email_preview_generated_at || null,
    emailPreviewVersion: record.email_preview_version || 0,
    testedAt: record.tested_at,
    emailTestVersion: record.email_test_version || 0,
    testMessageId: record.test_message_id || null,
    approvedAt: record.approved_at,
    queueingStartedAt: record.queueing_started_at,
    queuedAt: record.queued_at,
    sentAt: record.sent_at,
    completedAt: record.completed_at,
    canceledAt: record.canceled_at,
    failedAt: record.failed_at,
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
    smsPreviewGeneratedAt: record.sms_preview_generated_at || null,
    smsPreviewVersion: record.sms_preview_version || 0,
    smsSavedAt: record.sms_saved_at || null,
    smsTestedAt: record.sms_tested_at || null,
    smsTestVersion: record.sms_test_version || 0,
    smsTestRecipientMasked: record.sms_test_recipient_masked || null,
    smsTestMessageSid: record.sms_test_message_sid || null,
    smsTestProviderStatus: record.sms_test_provider_status || null,
    smsTestSenderMasked: record.sms_test_sender_masked || null,
    smsTestStatus: record.sms_test_status || null,
    smsTestTransport: record.sms_test_transport || null,
    smsCharacterCount: record.sms_character_count || 0,
    smsSegmentCount: record.sms_segment_count || 0,
    smsEncoding: record.sms_encoding || "GSM-7",
    smsEligibleCount: record.sms_eligible_count || 0,
    smsExcludedCount: record.sms_excluded_count || 0,
    smsDuplicateCount: record.sms_duplicate_count || 0,
    smsQueuedCount: record.sms_queued_count || 0,
    smsSentCount: record.sms_sent_count || 0,
    smsDeliveredCount: record.sms_delivered_count || 0,
    smsFailedCount: record.sms_failed_count || 0,
    smsSkippedCount: record.sms_skipped_count || 0,
    audienceCountedAt: record.audience_counted_at || null,
    audienceVersion: record.audience_version || 0,
    audienceEmailTotal: record.audience_email_total || 0,
    audienceEmailEligible: record.audience_email_eligible || 0,
    audienceEmailExcluded: record.audience_email_excluded || 0,
    audienceEmailDuplicateCount: record.audience_email_duplicate_count || 0,
    audienceEmailStatus: record.audience_email_status || "not_counted",
    audienceEmailErrorCode: record.audience_email_error_code || null,
    audienceSmsTotal: record.audience_sms_total || 0,
    audienceSmsEligible: record.audience_sms_eligible || 0,
    audienceSmsExcluded: record.audience_sms_excluded || 0,
    audienceSmsDuplicateCount: record.audience_sms_duplicate_count || 0,
    audienceSmsStatus: record.audience_sms_status || "not_counted",
    audienceSmsErrorCode: record.audience_sms_error_code || null,
    audienceBothEligible: record.audience_both_eligible ?? null,
    audienceLastErrorCode: record.audience_last_error_code || null,
    audienceLastErrorAt: record.audience_last_error_at || null,
    audienceSegment: record.audience_segment || "all",
    readiness: campaignReadinessResponse(record),
    isPinned: record.is_pinned || false,
    pinnedAt: record.pinned_at || null,
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
    const now = new Date().toISOString();
    const saveChannel = (body as { saveChannel?: unknown })?.saveChannel;
    let updated: EmailCampaignRecord | null;
    let auditStatus: string;

    if (saveChannel === "audience") {
      const submission = adminCampaignAudienceSegmentUpdateSchema.parse(body);

      updated = await updateEmailCampaignAudienceSegment({
        id,
        audience_segment: submission.audienceSegment,
        expectedVersion: submission.expectedVersion,
        now,
        updated_by: admin.identifier,
      });
      auditStatus = `audience ${submission.audienceSegment}`;
    } else if (saveChannel === "sms") {
      const submission = updateAdminCampaignSmsSchema.parse(body);
      const smsPreview = renderAdminSmsAnnouncement(submission.smsBody);

      updated = await updateEmailCampaignSmsDraft({
        id,
        expectedVersion: submission.expectedVersion,
        now,
        updated_by: admin.identifier,
        sms_body: smsPreview.editableBody,
        sms_rendered_body: smsPreview.body,
        sms_character_count: smsPreview.characterCount,
        sms_segment_count: smsPreview.segmentCount,
        sms_encoding: smsPreview.encoding,
      });
      auditStatus = submission.defaultContentConfirmed
        ? "draft text default_override"
        : "draft text";
    } else {
      const submission = updateAdminCampaignEmailSchema.parse(body);

      updated = await updateEmailCampaignEmailDraft({
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
      });
      auditStatus = submission.defaultContentConfirmed
        ? "draft email default_override"
        : "draft email";
    }

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
      status: auditStatus,
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
