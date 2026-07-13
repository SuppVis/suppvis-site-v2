import { randomUUID } from "node:crypto";
import { saveBroadcastAudit } from "./persistence";

export type AdminCampaignAuditAction =
  | "draft_created"
  | "draft_updated"
  | "preview_generated"
  | "test_send_blocked"
  | "test_send_sent";

export async function recordAdminCampaignAudit(input: {
  action: AdminCampaignAuditAction;
  adminIdentifier: string;
  campaignId?: string;
  status?: string;
}) {
  const now = new Date().toISOString();

  await saveBroadcastAudit({
    id: `broadcast_audit_${randomUUID()}`,
    admin_identifier: input.adminIdentifier,
    channel: "email",
    message_preview: [
      input.action,
      input.campaignId ? `campaign=${input.campaignId}` : "",
      input.status ? `status=${input.status}` : "",
    ]
      .filter(Boolean)
      .join(" "),
    intended_audience: "admin_email_campaign",
    dry_run: true,
    status: "dry_run_recorded",
    created_at: now,
  });
}
