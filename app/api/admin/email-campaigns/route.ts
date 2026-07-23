import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { recordAdminCampaignAudit } from "@/app/lib/server/admin-campaign-audit";
import { requireAdminSession } from "@/app/lib/server/admin-session";
import { handleApiError } from "@/app/lib/server/errors";
import {
  createEmailCampaignDraft,
  listRecentEmailCampaignDrafts,
  listSentEmailCampaignSummaries,
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
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    version: record.version,
    testedAt: record.tested_at,
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
    smsSavedAt: record.sms_saved_at || null,
    smsTestedAt: record.sms_tested_at || null,
    smsTestMessageSid: record.sms_test_message_sid || null,
    smsCharacterCount: record.sms_character_count || 0,
    smsSegmentCount: record.sms_segment_count || 0,
    smsEncoding: record.sms_encoding || "GSM-7",
    smsEligibleCount: record.sms_eligible_count || 0,
    smsExcludedCount: record.sms_excluded_count || 0,
    smsDuplicateCount: record.sms_duplicate_count || 0,
    isPinned: record.is_pinned || false,
    pinnedAt: record.pinned_at || null,
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

    const view = request.nextUrl.searchParams.get("view");

    if (view === "sent") {
      const sent = await listSentEmailCampaignSummaries(100);

      return NextResponse.json({
        ok: true,
        sent: sent.map((draft) => ({
          id: draft.id,
          messageType: draft.message_type,
          subject: draft.subject,
          heading: draft.heading,
          status: draft.status,
          createdAt: draft.created_at,
          updatedAt: draft.updated_at,
          version: draft.version,
          testedAt: draft.tested_at,
          approvedAt: draft.approved_at,
          queueingStartedAt: draft.queueing_started_at || null,
          queuedAt: draft.queued_at || null,
          sentAt: draft.sent_at || null,
          completedAt: draft.completed_at || null,
          canceledAt: draft.canceled_at || null,
          failedAt: draft.failed_at || null,
          recipientCount: draft.recipient_count || 0,
          queuedCount: draft.queued_count || 0,
          sentCount: draft.sent_count || 0,
          deliveredCount: draft.delivered_count || 0,
          failedCount: draft.failed_count || 0,
          skippedCount: draft.skipped_count || 0,
          smsEnabled: draft.sms_enabled || false,
          smsSavedAt: draft.sms_saved_at || null,
          smsTestedAt: draft.sms_tested_at || null,
          smsEligibleCount: draft.sms_eligible_count || 0,
          smsExcludedCount: draft.sms_excluded_count || 0,
          smsDuplicateCount: draft.sms_duplicate_count || 0,
        })),
      });
    }

    const drafts = await listRecentEmailCampaignDrafts(5);

    return NextResponse.json({
      ok: true,
      drafts: drafts.map((draft) => ({
        id: draft.id,
        messageType: draft.message_type,
        subject: draft.subject,
        heading: draft.heading,
        status: draft.status,
        createdAt: draft.created_at,
        updatedAt: draft.updated_at,
        version: draft.version,
        testedAt: draft.tested_at,
        approvedAt: draft.approved_at,
        queueingStartedAt: draft.queueing_started_at || null,
        queuedAt: draft.queued_at || null,
        sentAt: draft.sent_at || null,
        completedAt: draft.completed_at || null,
        canceledAt: draft.canceled_at || null,
        failedAt: draft.failed_at || null,
        recipientCount: draft.recipient_count || 0,
        queuedCount: draft.queued_count || 0,
        sentCount: draft.sent_count || 0,
        deliveredCount: draft.delivered_count || 0,
        failedCount: draft.failed_count || 0,
        skippedCount: draft.skipped_count || 0,
        smsEnabled: draft.sms_enabled || false,
        smsSavedAt: draft.sms_saved_at || null,
        smsTestedAt: draft.sms_tested_at || null,
        smsTestMessageSid: draft.sms_test_message_sid || null,
        smsCharacterCount: draft.sms_character_count || 0,
        smsSegmentCount: draft.sms_segment_count || 0,
        smsEncoding: draft.sms_encoding || "GSM-7",
        smsEligibleCount: draft.sms_eligible_count || 0,
        smsExcludedCount: draft.sms_excluded_count || 0,
        smsDuplicateCount: draft.sms_duplicate_count || 0,
        isPinned: draft.is_pinned || false,
        pinnedAt: draft.pinned_at || null,
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
      sms_enabled: true,
      sms_body: "",
      sms_rendered_body: "",
      sms_draft_version: 0,
      sms_saved_at: null,
      sms_tested_at: null,
      sms_test_recipient_id: null,
      sms_test_message_sid: null,
      sms_test_send_reserved_at: null,
      sms_test_send_reserved_by: null,
      last_sms_test_send_failed_at: null,
      last_sms_test_send_error_code: null,
      sms_character_count: 0,
      sms_segment_count: 0,
      sms_encoding: "GSM-7",
      sms_updated_by: null,
      sms_updated_at: null,
      is_pinned: false,
      pinned_at: null,
      pinned_by: null,
    };

    await createEmailCampaignDraft(record);
    await recordAdminCampaignAudit({
      action: "draft_created",
      adminIdentifier: admin.identifier,
      campaignId: record.id,
      status: "draft email",
    });

    return NextResponse.json({
      ok: true,
      campaign: campaignResponse(record),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
