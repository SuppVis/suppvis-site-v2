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
  summarizeCommunicationHistory,
} = sandbox.module.exports;

const baseItem = {
  channel: "email",
  deliveredAt: null,
  failureCode: null,
  failureReason: null,
  id: "item",
  providerMessageId: null,
  providerStatus: null,
  sortTimestamp: "2026-08-09T00:00:00.000Z",
  status: "accepted",
  statusLabel: "Accepted by SES",
  title: "Message",
  type: "announcement",
};

{
  const stats = emptyCommunicationStats();

  assert.equal(stats.totalAttempts, 0);
  assert.equal(stats.successfulCount, 0);
  assert.equal(stats.hasDeliveryIssue, false);
}

{
  const stats = summarizeCommunicationHistory([
    { ...baseItem, id: "delivered", status: "delivered" },
    { ...baseItem, id: "accepted", status: "accepted" },
    { ...baseItem, id: "skipped", status: "skipped" },
  ]);

  assert.equal(stats.totalAttempts, 2);
  assert.equal(stats.successfulCount, 2);
  assert.equal(stats.deliveryIssueCount, 0);
}

{
  const stats = summarizeCommunicationHistory([
    {
      ...baseItem,
      failureReason: "Provider rejected message",
      id: "failed",
      status: "failed",
      statusLabel: "Failed",
    },
    {
      ...baseItem,
      id: "complained",
      status: "complained",
      statusLabel: "Complained",
    },
  ]);

  assert.equal(stats.totalAttempts, 2);
  assert.equal(stats.successfulCount, 0);
  assert.equal(stats.deliveryIssueCount, 2);
  assert.equal(stats.hasDeliveryIssue, true);
  assert.equal(stats.issueSummary, "Provider rejected message");
}

{
  const stats = summarizeCommunicationHistory([
    {
      ...baseItem,
      failureCode: "30003",
      id: "sms-undelivered",
      status: "sent",
      statusLabel: "Sent",
    },
  ]);

  assert.equal(stats.totalAttempts, 1);
  assert.equal(stats.successfulCount, 1);
  assert.equal(stats.deliveryIssueCount, 1);
  assert.equal(stats.hasDeliveryIssue, true);
  assert.equal(stats.issueSummary, "Sent");
}

console.log("subscriber communication history verified");
