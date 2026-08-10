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

export type SubscriberCommunicationHistoryChannel = {
  channel: SubscriberCommunicationChannel;
  deliveredAt: string | null;
  failureCode: string | null;
  failureReason: string | null;
  providerMessageId: string | null;
  providerStatus: string | null;
  sortTimestamp: string;
  status: SubscriberCommunicationStatus;
  statusLabel: string;
};

export type SubscriberCommunicationHistoryItem = {
  campaignId?: string;
  channels: SubscriberCommunicationHistoryChannel[];
  id: string;
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

const WELCOME_CHANNEL_GROUP_WINDOW_MS = 30 * 60 * 1000;
const UNKNOWN_TIMESTAMP = new Date(0).toISOString();

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

function channelAttempted(channel: SubscriberCommunicationHistoryChannel) {
  return channel.status !== "skipped";
}

function channelSuccessful(channel: SubscriberCommunicationHistoryChannel) {
  return (
    channel.status === "accepted" ||
    channel.status === "sent" ||
    channel.status === "delivered"
  );
}

function channelIssue(channel: SubscriberCommunicationHistoryChannel) {
  return (
    channel.status === "bounced" ||
    channel.status === "complained" ||
    channel.status === "failed" ||
    channel.status === "rejected" ||
    Boolean(channel.failureCode)
  );
}

function communicationAttempted(item: SubscriberCommunicationHistoryItem) {
  return item.channels.some(channelAttempted);
}

function communicationSuccessful(item: SubscriberCommunicationHistoryItem) {
  return item.channels.some(channelSuccessful);
}

function communicationIssue(item: SubscriberCommunicationHistoryItem) {
  return item.channels.some(channelIssue);
}

function itemIssueSummary(item: SubscriberCommunicationHistoryItem) {
  const issue = item.channels.find(channelIssue);

  return issue?.failureReason || issue?.failureCode || issue?.statusLabel || null;
}

function aggregateStatus(
  channels: SubscriberCommunicationHistoryChannel[],
): SubscriberCommunicationStatus {
  const attempted = channels.filter(channelAttempted);

  if (!attempted.length) {
    return "skipped";
  }

  if (attempted.some(channelIssue)) {
    const issue = attempted.find(channelIssue);
    return issue?.status === "sent" || issue?.status === "accepted"
      ? "failed"
      : issue?.status || "failed";
  }

  if (attempted.every((channel) => channel.status === "delivered")) {
    return "delivered";
  }

  if (attempted.some((channel) => channel.status === "delivered")) {
    return "delivered";
  }

  if (attempted.some((channel) => channel.status === "sent")) {
    return "sent";
  }

  if (attempted.some((channel) => channel.status === "accepted")) {
    return "accepted";
  }

  return attempted[0]?.status || "queued";
}

function aggregateStatusLabel(
  channels: SubscriberCommunicationHistoryChannel[],
) {
  if (channels.some(channelIssue)) {
    return "Delivery issue";
  }

  const attempted = channels.filter(channelAttempted);

  if (!attempted.length) {
    return "Skipped";
  }

  if (attempted.every((channel) => channel.status === "delivered")) {
    return "Delivered";
  }

  if (attempted.some((channel) => channel.status === "delivered")) {
    return "Partially delivered";
  }

  return statusLabel(aggregateStatus(channels), attempted[0]?.channel || "email");
}

function newestTimestamp(channels: SubscriberCommunicationHistoryChannel[]) {
  return (
    channels
      .map((channel) => channel.sortTimestamp)
      .filter(Boolean)
      .sort()
      .at(-1) || UNKNOWN_TIMESTAMP
  );
}

function timestampMs(timestamp: string | null | undefined) {
  const value = Date.parse(timestamp || "");

  return Number.isFinite(value) ? value : null;
}

function sameWelcomeEvent(
  email: SubscriberCommunicationHistoryChannel,
  sms: SubscriberCommunicationHistoryChannel,
) {
  const emailMs = timestampMs(email.sortTimestamp);
  const smsMs = timestampMs(sms.sortTimestamp);

  if (emailMs === null || smsMs === null) {
    return true;
  }

  if (email.sortTimestamp === UNKNOWN_TIMESTAMP || sms.sortTimestamp === UNKNOWN_TIMESTAMP) {
    return true;
  }

  return Math.abs(emailMs - smsMs) <= WELCOME_CHANNEL_GROUP_WINDOW_MS;
}

function communicationItem(input: {
  campaignId?: string;
  channels: SubscriberCommunicationHistoryChannel[];
  id: string;
  title: string;
  type: SubscriberCommunicationHistoryItem["type"];
}): SubscriberCommunicationHistoryItem {
  const channels = input.channels.sort((left, right) =>
    left.channel.localeCompare(right.channel),
  );

  return {
    campaignId: input.campaignId,
    channels,
    id: input.id,
    sortTimestamp: newestTimestamp(channels),
    status: aggregateStatus(channels),
    statusLabel: aggregateStatusLabel(channels),
    title: input.title,
    type: input.type,
  };
}

function safeFailureReason(row: EmailCampaignRecipientRecord) {
  if (row.safe_failure_code) {
    return row.safe_failure_code;
  }

  if (row.status === "bounced") {
    return row.bounce_type
      ? `Email bounced: ${row.bounce_type}`
      : "Email bounced";
  }

  if (row.status === "complained") {
    return row.complaint_feedback_type
      ? `Email complaint: ${row.complaint_feedback_type}`
      : "Email complaint";
  }

  if (row.status === "rejected") {
    return row.reject_reason
      ? `Email rejected: ${row.reject_reason}`
      : "Email rejected by provider";
  }

  if (row.twilio_error_code) {
    return `Twilio error ${row.twilio_error_code}`;
  }

  if (row.skip_reason) {
    return row.skip_reason;
  }

  return null;
}

function channelFromRecipient(
  row: EmailCampaignRecipientRecord,
): SubscriberCommunicationHistoryChannel {
  const channel = row.channel === "sms" ? "sms" : "email";
  const status = recipientStatus(row);
  const providerMessageId =
    channel === "sms" ? row.twilio_message_sid || null : row.ses_message_id || null;
  const providerStatus =
    channel === "sms"
      ? row.twilio_provider_status || null
      : row.status === "bounced" ||
        row.status === "complained" ||
        row.status === "rejected" ||
        row.status === "delivery_delayed"
        ? row.status
        : row.ses_message_id
          ? "accepted"
        : null;
  const failureReason = safeFailureReason(row);

  return {
    channel,
    deliveredAt: row.delivered_at || null,
    failureCode: row.twilio_error_code || row.safe_failure_code || null,
    failureReason,
    providerMessageId,
    providerStatus,
    sortTimestamp: recipientTimestamp(row),
    status,
    statusLabel: statusLabel(status, channel),
  };
}

function trackedEmailChannel(input: {
  messageId: string | null | undefined;
  sentAt: string | null | undefined;
}): SubscriberCommunicationHistoryChannel | null {
  if (!input.sentAt && !input.messageId) {
    return null;
  }

  const timestamp = input.sentAt || new Date(0).toISOString();

  return {
    channel: "email" as const,
    deliveredAt: null,
    failureCode: null,
    failureReason: null,
    providerMessageId: input.messageId || null,
    providerStatus: input.messageId ? "accepted" : null,
    sortTimestamp: timestamp,
    status: "accepted" as const,
    statusLabel: "Accepted by SES",
  };
}

function trackedSmsChannel(
  profile: SubscriberCommunicationProfile,
): SubscriberCommunicationHistoryChannel | null {
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
    providerMessageId: messageSid || null,
    providerStatus: providerStatus || null,
    sortTimestamp: sentAt || UNKNOWN_TIMESTAMP,
    status,
    statusLabel: statusLabel(status, "sms"),
  };
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
  const items: SubscriberCommunicationHistoryItem[] = [];
  const welcomeEmailChannel = trackedEmailChannel({
    messageId: email.welcomeEmailMessageId,
    sentAt: email.welcomeEmailSentAt,
  });
  const welcomeSmsChannel = trackedSmsChannel(profile);

  if (
    welcomeEmailChannel &&
    welcomeSmsChannel &&
    sameWelcomeEvent(welcomeEmailChannel, welcomeSmsChannel)
  ) {
    items.push(
      communicationItem({
        channels: [welcomeEmailChannel, welcomeSmsChannel],
        id: `${profile.id}:welcome`,
        title: "Beta welcome",
        type: "welcome",
      }),
    );
  } else {
    if (welcomeEmailChannel) {
      items.push(
        communicationItem({
          channels: [welcomeEmailChannel],
          id: `${profile.id}:welcome-email`,
          title: "Beta welcome email",
          type: "welcome",
        }),
      );
    }

    if (welcomeSmsChannel) {
      items.push(
        communicationItem({
          channels: [welcomeSmsChannel],
          id: `${profile.id}:welcome-sms`,
          title: "Beta welcome text",
          type: "welcome",
        }),
      );
    }
  }

  const resubscribeChannel = trackedEmailChannel({
    messageId: email.resubscribeEmailMessageId,
    sentAt: email.resubscribeEmailSentAt,
  });

  if (resubscribeChannel) {
    items.push(
      communicationItem({
        channels: [resubscribeChannel],
        id: `${profile.id}:resubscribe-email`,
        title: "Email resubscribe confirmation",
        type: "resubscribe",
      }),
    );
  }

  const unsubscribeChannel = trackedEmailChannel({
    messageId: email.unsubscribeConfirmationEmailMessageId,
    sentAt: email.unsubscribeConfirmationEmailSentAt,
  });

  if (unsubscribeChannel) {
    items.push(
      communicationItem({
        channels: [unsubscribeChannel],
        id: `${profile.id}:unsubscribe-confirmation-email`,
        title: "Email unsubscribe confirmation",
        type: "unsubscribe_confirmation",
      }),
    );
  }

  return items;
}

function announcementItemsFromRows(
  profile: SubscriberCommunicationProfile,
  index: CampaignRecipientIndex,
  rows: EmailCampaignRecipientRecord[],
) {
  const byCampaign = new Map<
    string,
    Map<SubscriberCommunicationChannel, SubscriberCommunicationHistoryChannel>
  >();

  for (const row of rows) {
    const campaignChannels =
      byCampaign.get(row.campaign_id) ||
      new Map<
        SubscriberCommunicationChannel,
        SubscriberCommunicationHistoryChannel
      >();
    const channel = channelFromRecipient(row);
    const existing = campaignChannels.get(channel.channel);

    if (
      !existing ||
      channel.sortTimestamp.localeCompare(existing.sortTimestamp) >= 0
    ) {
      campaignChannels.set(channel.channel, channel);
    }

    byCampaign.set(row.campaign_id, campaignChannels);
  }

  return [...byCampaign.entries()].map(([campaignId, channelMap]) => {
    const campaign = index.campaignById.get(campaignId);

    return communicationItem({
      campaignId,
      channels: [...channelMap.values()],
      id: `${profile.id}:announcement:${campaignId}`,
      title: campaign?.subject || "Admin announcement",
      type: "announcement",
    });
  });
}

function buildHistoryFromIndex(
  profile: SubscriberCommunicationProfile,
  index: CampaignRecipientIndex,
) {
  const emailId = emailSubscriberId(profile);
  const smsId = smsSubscriberId(profile);
  const campaignRows = [
    ...(index.emailBySubscriberId.get(emailId) || []),
    ...(smsId ? index.smsBySubscriberId.get(smsId) || [] : []),
  ];
  const items = [
    ...baseHistoryItems(profile),
    ...announcementItemsFromRows(profile, index, campaignRows),
  ];

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
  const attempted = items.filter(communicationAttempted);
  const successfulCount = attempted.filter(communicationSuccessful).length;
  const issues = items.filter(communicationIssue);

  return {
    deliveryIssueCount: issues.length,
    hasDeliveryIssue: issues.length > 0,
    issueSummary: issues[0] ? itemIssueSummary(issues[0]) : null,
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
