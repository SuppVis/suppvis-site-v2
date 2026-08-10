import { stableId } from "../crypto";
import {
  listEmailCampaignRecipients,
  listSentEmailCampaignSummaries,
  type EmailCampaignRecipientRecord,
  type EmailCampaignSummary,
} from "../persistence";

export type SubscriberCommunicationChannel = "email" | "sms";

export type SubscriberCommunicationStatus =
  | "accepted"
  | "bounced"
  | "complained"
  | "delayed"
  | "delivered"
  | "failed"
  | "queued"
  | "rejected"
  | "sent"
  | "skipped";

export type SubscriberCommunicationHistoryItem = {
  campaignId?: string;
  channel: SubscriberCommunicationChannel;
  deliveredAt: string | null;
  failureCode: string | null;
  failureReason: string | null;
  id: string;
  providerMessageId: string | null;
  providerStatus: string | null;
  sortTimestamp: string;
  status: SubscriberCommunicationStatus;
  statusLabel: string;
  title: string;
  type: "announcement" | "welcome" | "resubscribe" | "unsubscribe_confirmation";
};

export type SubscriberCommunicationStats = {
  deliveryIssueCount: number;
  hasDeliveryIssue: boolean;
  issueSummary: string | null;
  lastCommunicationAt: string | null;
  successfulCount: number;
  totalAttempts: number;
};

export type SubscriberCommunicationProfile = {
  email: string;
  emailDelivery: {
    lastEmailMessageId: string | null;
    lastEmailSentAt: string | null;
    lastEmailType: string | null;
    resubscribeEmailMessageId?: string | null;
    resubscribeEmailSentAt?: string | null;
    unsubscribeConfirmationEmailMessageId?: string | null;
    unsubscribeConfirmationEmailSentAt?: string | null;
    welcomeEmailMessageId?: string | null;
    welcomeEmailSentAt: string | null;
    welcomeEmailType?: string | null;
  };
  emailStatus: string;
  id: string;
  phoneE164: string | null;
  smsDelivery: {
    lastSmsErrorCode?: string | null;
    lastSmsErrorMessageSafe?: string | null;
    lastSmsMessageSid: string | null;
    lastSmsSentAt: string | null;
    lastSmsStatus: string | null;
    providerStatus: string | null;
    welcomeSmsMessageSid?: string | null;
    welcomeSmsSentAt: string | null;
  };
  smsStatus: string;
};

type CampaignRecipientIndex = {
  campaignById: Map<string, EmailCampaignSummary>;
  emailBySubscriberId: Map<string, EmailCampaignRecipientRecord[]>;
  smsBySubscriberId: Map<string, EmailCampaignRecipientRecord[]>;
};

const FAILURE_STATUSES = new Set([
  "bounced",
  "complained",
  "failed",
  "rejected",
]);

function emailSubscriberId(profile: SubscriberCommunicationProfile) {
  return stableId("email", profile.email.trim().toLowerCase());
}

function smsSubscriberId(profile: SubscriberCommunicationProfile) {
  return profile.phoneE164 ? stableId("sms", profile.phoneE164) : null;
}

function statusLabel(status: SubscriberCommunicationStatus, channel: SubscriberCommunicationChannel) {
  if (status === "accepted") {
    return channel === "email" ? "Accepted by SES" : "Accepted by Twilio";
  }

  return status
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function recipientTimestamp(row: EmailCampaignRecipientRecord) {
  return (
    row.delivered_at ||
    row.failed_at ||
    row.bounced_at ||
    row.complained_at ||
    row.rejected_at ||
    row.delivery_delay_at ||
    row.sent_at ||
    row.accepted_at ||
    row.send_attempted_at ||
    row.queued_at ||
    row.updated_at ||
    row.created_at
  );
}

function recipientStatus(row: EmailCampaignRecipientRecord): SubscriberCommunicationStatus {
  if (row.status === "delivery_delayed") {
    return "delayed";
  }

  if (
    row.status === "queueing" ||
    row.status === "queued" ||
    row.status === "sending"
  ) {
    return "queued";
  }

  return row.status;
}

function communicationAttempted(status: SubscriberCommunicationStatus) {
  return status !== "skipped";
}

function communicationSuccessful(status: SubscriberCommunicationStatus) {
  return status === "accepted" || status === "sent" || status === "delivered";
}

function communicationIssue(item: SubscriberCommunicationHistoryItem) {
  return (
    item.status === "bounced" ||
    item.status === "complained" ||
    item.status === "failed" ||
    item.status === "rejected" ||
    Boolean(item.failureCode)
  );
}

function safeFailureReason(row: EmailCampaignRecipientRecord) {
  if (row.safe_failure_code) {
    return row.safe_failure_code;
  }

  if (row.twilio_error_code) {
    return `Twilio error ${row.twilio_error_code}`;
  }

  if (row.skip_reason) {
    return row.skip_reason;
  }

  return null;
}

function itemFromRecipient(
  campaign: EmailCampaignSummary | undefined,
  row: EmailCampaignRecipientRecord,
): SubscriberCommunicationHistoryItem {
  const channel = row.channel === "sms" ? "sms" : "email";
  const status = recipientStatus(row);
  const providerMessageId =
    channel === "sms" ? row.twilio_message_sid || null : row.ses_message_id || null;
  const providerStatus =
    channel === "sms"
      ? row.twilio_provider_status || null
      : row.ses_message_id
        ? "accepted"
        : null;
  const failureReason = safeFailureReason(row);

  return {
    campaignId: row.campaign_id,
    channel,
    deliveredAt: row.delivered_at || null,
    failureCode: row.twilio_error_code || row.safe_failure_code || null,
    failureReason,
    id: `${row.campaign_id}:${channel}:${row.subscriber_id}`,
    providerMessageId,
    providerStatus,
    sortTimestamp: recipientTimestamp(row),
    status,
    statusLabel: statusLabel(status, channel),
    title: campaign?.subject || "Admin announcement",
    type: "announcement",
  };
}

function trackedEmailItem(input: {
  id: string;
  messageId: string | null | undefined;
  sentAt: string | null | undefined;
  title: string;
  type: "welcome" | "resubscribe" | "unsubscribe_confirmation";
}): SubscriberCommunicationHistoryItem | null {
  if (!input.sentAt && !input.messageId) {
    return null;
  }

  const timestamp = input.sentAt || new Date(0).toISOString();

  return {
    channel: "email" as const,
    deliveredAt: null,
    failureCode: null,
    failureReason: null,
    id: input.id,
    providerMessageId: input.messageId || null,
    providerStatus: input.messageId ? "accepted" : null,
    sortTimestamp: timestamp,
    status: "accepted" as const,
    statusLabel: "Accepted by SES",
    title: input.title,
    type: input.type,
  };
}

function trackedSmsItem(
  profile: SubscriberCommunicationProfile,
): SubscriberCommunicationHistoryItem | null {
  const sentAt = profile.smsDelivery.welcomeSmsSentAt;
  const messageSid = profile.smsDelivery.welcomeSmsMessageSid || profile.smsDelivery.lastSmsMessageSid;

  if (!sentAt && !messageSid) {
    return null;
  }

  const providerStatus = profile.smsDelivery.providerStatus || profile.smsDelivery.lastSmsStatus;
  const failed =
    profile.smsStatus === "failed" ||
    profile.smsStatus === "invalid" ||
    Boolean(profile.smsDelivery.lastSmsErrorCode);
  const status: SubscriberCommunicationStatus = failed
    ? "failed"
    : providerStatus === "delivered"
      ? "delivered"
      : providerStatus === "sent"
        ? "sent"
        : "accepted";

  return {
    channel: "sms" as const,
    deliveredAt: status === "delivered" ? sentAt || null : null,
    failureCode: profile.smsDelivery.lastSmsErrorCode || null,
    failureReason: profile.smsDelivery.lastSmsErrorMessageSafe || null,
    id: `${profile.id}:welcome-sms`,
    providerMessageId: messageSid || null,
    providerStatus: providerStatus || null,
    sortTimestamp: sentAt || new Date(0).toISOString(),
    status,
    statusLabel: statusLabel(status, "sms"),
    title: "Beta welcome text",
    type: "welcome" as const,
  } satisfies SubscriberCommunicationHistoryItem;
}

async function getCampaignRecipientIndex(): Promise<CampaignRecipientIndex> {
  const campaigns = await listSentEmailCampaignSummaries(100);
  const campaignById = new Map(campaigns.map((campaign) => [campaign.id, campaign]));
  const emailBySubscriberId = new Map<string, EmailCampaignRecipientRecord[]>();
  const smsBySubscriberId = new Map<string, EmailCampaignRecipientRecord[]>();
  const recipientGroups = await Promise.all(
    campaigns.map(async (campaign) => ({
      campaign,
      recipients: await listEmailCampaignRecipients(campaign.id),
    })),
  );

  for (const { recipients } of recipientGroups) {
    for (const recipient of recipients) {
      const map =
        recipient.channel === "sms" ? smsBySubscriberId : emailBySubscriberId;
      const existing = map.get(recipient.subscriber_id) || [];
      existing.push(recipient);
      map.set(recipient.subscriber_id, existing);
    }
  }

  return {
    campaignById,
    emailBySubscriberId,
    smsBySubscriberId,
  };
}

function baseHistoryItems(profile: SubscriberCommunicationProfile) {
  const email = profile.emailDelivery;
  const items = [
    trackedEmailItem({
      id: `${profile.id}:welcome-email`,
      messageId: email.welcomeEmailMessageId || email.lastEmailMessageId,
      sentAt: email.welcomeEmailSentAt,
      title: "Beta welcome email",
      type: "welcome",
    }),
    trackedEmailItem({
      id: `${profile.id}:resubscribe-email`,
      messageId: email.resubscribeEmailMessageId,
      sentAt: email.resubscribeEmailSentAt,
      title: "Email resubscribe confirmation",
      type: "resubscribe",
    }),
    trackedEmailItem({
      id: `${profile.id}:unsubscribe-confirmation-email`,
      messageId: email.unsubscribeConfirmationEmailMessageId,
      sentAt: email.unsubscribeConfirmationEmailSentAt,
      title: "Email unsubscribe confirmation",
      type: "unsubscribe_confirmation",
    }),
    trackedSmsItem(profile),
  ];

  return items.filter(
    (item): item is SubscriberCommunicationHistoryItem => Boolean(item),
  );
}

function buildHistoryFromIndex(
  profile: SubscriberCommunicationProfile,
  index: CampaignRecipientIndex,
) {
  const emailId = emailSubscriberId(profile);
  const smsId = smsSubscriberId(profile);
  const items = baseHistoryItems(profile);
  const campaignRows = [
    ...(index.emailBySubscriberId.get(emailId) || []),
    ...(smsId ? index.smsBySubscriberId.get(smsId) || [] : []),
  ];

  for (const row of campaignRows) {
    items.push(itemFromRecipient(index.campaignById.get(row.campaign_id), row));
  }

  const unique = new Map<string, SubscriberCommunicationHistoryItem>();
  for (const item of items) {
    unique.set(item.id, item);
  }

  return [...unique.values()].sort((a, b) =>
    b.sortTimestamp.localeCompare(a.sortTimestamp),
  );
}

export function summarizeCommunicationHistory(
  items: SubscriberCommunicationHistoryItem[],
): SubscriberCommunicationStats {
  const attempted = items.filter((item) => communicationAttempted(item.status));
  const successfulCount = attempted.filter((item) =>
    communicationSuccessful(item.status),
  ).length;
  const issues = items.filter(communicationIssue);

  return {
    deliveryIssueCount: issues.length,
    hasDeliveryIssue: issues.length > 0,
    issueSummary: issues[0]?.failureReason || issues[0]?.statusLabel || null,
    lastCommunicationAt: attempted[0]?.sortTimestamp || null,
    successfulCount,
    totalAttempts: attempted.length,
  };
}

export function emptyCommunicationStats(): SubscriberCommunicationStats {
  return {
    deliveryIssueCount: 0,
    hasDeliveryIssue: false,
    issueSummary: null,
    lastCommunicationAt: null,
    successfulCount: 0,
    totalAttempts: 0,
  };
}

export async function getCommunicationHistoryForSubscriber(
  profile: SubscriberCommunicationProfile,
) {
  const index = await getCampaignRecipientIndex();
  const items = buildHistoryFromIndex(profile, index);

  return {
    items,
    stats: summarizeCommunicationHistory(items),
  };
}

export async function getCommunicationStatsForSubscribers(
  profiles: SubscriberCommunicationProfile[],
) {
  if (!profiles.length) {
    return new Map<string, SubscriberCommunicationStats>();
  }

  const index = await getCampaignRecipientIndex();
  const stats = new Map<string, SubscriberCommunicationStats>();

  for (const profile of profiles) {
    stats.set(
      profile.id,
      summarizeCommunicationHistory(buildHistoryFromIndex(profile, index)),
    );
  }

  return stats;
}
