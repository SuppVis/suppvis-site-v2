import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import ts from "typescript";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const modulePath = path.resolve(
  "app/lib/server/admin/communication-history.ts",
);
const source = fs.readFileSync(modulePath, "utf8");
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const module = { exports: {} };
const sandbox = {
  exports: module.exports,
  module,
  require(specifier) {
    if (specifier === "../crypto") {
      return {
        stableId(prefix, value) {
          return `${prefix}_${value}`;
        },
      };
    }

    if (specifier === "../persistence") {
      return {
        listEmailCampaignRecipients: async () => [],
        listSentEmailCampaignSummaries: async () => [],
      };
    }

    return require(specifier);
  },
};

vm.runInNewContext(transpiled, sandbox, { filename: modulePath });

const {
  emptyCommunicationStats,
  getCommunicationHistoryForSubscriber,
  summarizeCommunicationHistory,
} = sandbox.module.exports;

const baseChannel = {
  channel: "email",
  deliveredAt: null,
  failureCode: null,
  failureReason: null,
  providerMessageId: null,
  providerStatus: null,
  sortTimestamp: "2026-08-09T00:00:00.000Z",
  status: "accepted",
  statusLabel: "Accepted by SES",
};

function item(id, channels, extra = {}) {
  return {
    channels,
    id,
    sortTimestamp: channels[0]?.sortTimestamp || "2026-08-09T00:00:00.000Z",
    status: channels[0]?.status || "accepted",
    statusLabel: channels[0]?.statusLabel || "Accepted",
    title: "Message",
    type: "announcement",
    ...extra,
  };
}

function profile(input = {}) {
  return {
    email: "person@example.com",
    emailDelivery: {
      lastEmailMessageId: null,
      lastEmailSentAt: null,
      lastEmailType: null,
      resubscribeEmailMessageId: null,
      resubscribeEmailSentAt: null,
      unsubscribeConfirmationEmailMessageId: null,
      unsubscribeConfirmationEmailSentAt: null,
      welcomeEmailMessageId: null,
      welcomeEmailSentAt: null,
      welcomeEmailType: null,
      ...(input.emailDelivery || {}),
    },
    emailStatus: "subscribed",
    id: "beta_person",
    phoneE164: "+12145550123",
    smsDelivery: {
      lastSmsErrorCode: null,
      lastSmsErrorMessageSafe: null,
      lastSmsMessageSid: null,
      lastSmsSentAt: null,
      lastSmsStatus: null,
      providerStatus: null,
      welcomeSmsMessageSid: null,
      welcomeSmsSentAt: null,
      ...(input.smsDelivery || {}),
    },
    smsStatus: "subscribed",
    ...input,
  };
}

{
  const stats = emptyCommunicationStats();

  assert.equal(stats.totalAttempts, 0);
  assert.equal(stats.successfulCount, 0);
  assert.equal(stats.hasDeliveryIssue, false);
}

{
  const stats = summarizeCommunicationHistory([
    item("delivered", [{ ...baseChannel, status: "delivered" }]),
    item("accepted", [{ ...baseChannel, status: "accepted" }]),
    item("skipped", [{ ...baseChannel, status: "skipped" }]),
  ]);

  assert.equal(stats.totalAttempts, 2);
  assert.equal(stats.successfulCount, 2);
  assert.equal(stats.deliveryIssueCount, 0);
}

{
  const stats = summarizeCommunicationHistory([
    item("failed", [
      {
        ...baseChannel,
        failureReason: "Provider rejected message",
        status: "failed",
        statusLabel: "Failed",
      },
    ]),
    item("complained", [
      { ...baseChannel, status: "complained", statusLabel: "Complained" },
    ]),
  ]);

  assert.equal(stats.totalAttempts, 2);
  assert.equal(stats.successfulCount, 0);
  assert.equal(stats.deliveryIssueCount, 2);
  assert.equal(stats.hasDeliveryIssue, true);
  assert.equal(stats.issueSummary, "Provider rejected message");
}

{
  const stats = summarizeCommunicationHistory([
    item("sms-undelivered", [
      {
        ...baseChannel,
        failureCode: "30003",
        status: "sent",
        statusLabel: "Sent",
      },
    ]),
  ]);

  assert.equal(stats.totalAttempts, 1);
  assert.equal(stats.successfulCount, 1);
  assert.equal(stats.deliveryIssueCount, 1);
  assert.equal(stats.hasDeliveryIssue, true);
  assert.equal(stats.issueSummary, "30003");
}

{
  const stats = summarizeCommunicationHistory([
    item("both-channels-one-announcement", [
      { ...baseChannel, channel: "email", status: "delivered" },
      { ...baseChannel, channel: "sms", status: "delivered" },
    ]),
  ]);

  assert.equal(stats.totalAttempts, 1);
  assert.equal(stats.successfulCount, 1);
  assert.equal(stats.deliveryIssueCount, 0);
}

{
  const stats = summarizeCommunicationHistory([
    item("mixed-channel-result", [
      { ...baseChannel, channel: "email", status: "delivered" },
      {
        ...baseChannel,
        channel: "sms",
        failureReason: "Carrier rejected message",
        status: "failed",
        statusLabel: "Failed",
      },
    ]),
  ]);

  assert.equal(stats.totalAttempts, 1);
  assert.equal(stats.successfulCount, 1);
  assert.equal(stats.deliveryIssueCount, 1);
  assert.equal(stats.issueSummary, "Carrier rejected message");
}

{
  const stats = summarizeCommunicationHistory([
    item("skipped-only", [
      { ...baseChannel, channel: "email", status: "skipped" },
      { ...baseChannel, channel: "sms", status: "skipped" },
    ]),
  ]);

  assert.equal(stats.totalAttempts, 0);
  assert.equal(stats.successfulCount, 0);
  assert.equal(stats.deliveryIssueCount, 0);
}

{
  const history = await getCommunicationHistoryForSubscriber(
    profile({
      emailDelivery: {
        welcomeEmailMessageId: "email-message",
        welcomeEmailSentAt: "2026-08-09T00:00:00.000Z",
      },
      smsDelivery: {
        lastSmsStatus: "delivered",
        providerStatus: "delivered",
        welcomeSmsMessageSid: "sms-message",
        welcomeSmsSentAt: "2026-08-09T00:05:00.000Z",
      },
    }),
  );

  assert.equal(history.items.length, 1);
  assert.equal(history.items[0].title, "Beta welcome");
  assert.equal(history.items[0].channels.length, 2);
  assert.equal(history.stats.totalAttempts, 1);
}

{
  const history = await getCommunicationHistoryForSubscriber(
    profile({
      emailDelivery: {
        welcomeEmailMessageId: "email-message",
        welcomeEmailSentAt: "2026-08-09T00:00:00.000Z",
      },
      smsDelivery: {
        lastSmsStatus: "delivered",
        providerStatus: "delivered",
        welcomeSmsMessageSid: "sms-message",
        welcomeSmsSentAt: "2026-08-10T00:00:00.000Z",
      },
    }),
  );

  assert.equal(history.items.length, 2);
  assert.equal(
    history.items
      .map((entry) => entry.title)
      .sort()
      .join("|"),
    "Beta welcome email|Beta welcome text",
  );
  assert.equal(history.stats.totalAttempts, 2);
}

console.log("subscriber communication history verified");
