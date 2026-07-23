import { randomUUID } from "node:crypto";
import { saveBroadcastAudit } from "./persistence";

export type AdminCampaignAuditAction =
  | "draft_created"
  | "draft_updated"
  | "draft_deleted"
  | "preview_generated"
  | "sms_preview_generated"
  | "recipient_count_generated"
  | "sms_test_send_blocked"
  | "sms_test_send_failed"
  | "sms_test_send_sent"
  | "test_send_blocked"
  | "test_send_failed"
  | "test_send_sent"
  | "campaign_approved"
  | "announcement_pinned"
  | "announcement_unpinned"
  | "production_send_blocked"
  | "sms_production_send_blocked"
  | "queueing_started"
  | "queueing_failed"
  | "campaign_queued"
  | "campaign_canceled";

export async function recordAdminCampaignAudit(input: {
  action: AdminCampaignAuditAction;
  adminIdentifier: string;
  campaignId?: string;
  status?: string;
}) {
  const now = new Date().toISOString();
  const isSmsAction = input.action.startsWith("sms_");

  await saveBroadcastAudit({
    id: `broadcast_audit_${randomUUID()}`,
    admin_identifier: input.adminIdentifier,
    channel: isSmsAction ? "sms" : "email",
    message_preview: [
      input.action,
      input.campaignId ? `campaign=${input.campaignId}` : "",
      input.status ? `status=${input.status}` : "",
    ]
      .filter(Boolean)
      .join(" "),
    intended_audience: isSmsAction
      ? "admin_sms_announcement"
      : "admin_email_campaign",
    dry_run: true,
    status: "dry_run_recorded",
    created_at: now,
  });
}
