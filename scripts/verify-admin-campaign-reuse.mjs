import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import Module from "node:module";
import path from "node:path";
import ts from "typescript";

const require = createRequire(import.meta.url);
const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function resolveTsModule(request, parent, isMain, options) {
  try {
    return originalResolveFilename.call(this, request, parent, isMain, options);
  } catch (error) {
    if (request.startsWith(".") && parent?.filename) {
      const base = path.resolve(path.dirname(parent.filename), request);
      for (const extension of [".ts", ".tsx"]) {
        const candidate = `${base}${extension}`;
        if (fs.existsSync(candidate)) {
          return candidate;
        }
      }
    }

    throw error;
  }
};

require.extensions[".ts"] = function compileTs(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;

  module._compile(transpiled, filename);
};

const {
  deriveReusableEmailCampaignDraft,
  isReusableEmailCampaign,
} = require(path.resolve("app/lib/server/admin/email-campaign-reuse.ts"));

const now = "2026-08-09T18:00:00.000Z";
const source = {
  id: "email_campaign_11111111-1111-4111-8111-111111111111",
  record_type: "email_campaign",
  message_type: "product_update",
  subject: "Wave 2 Open",
  heading: "Download SuppVis",
  body: "First paragraph.\n\nSecond paragraph.",
  cta_label: "Open TestFlight",
  cta_url: "https://example.com/testflight",
  links: [
    {
      id: "link_second",
      label: "Second",
      order: 2,
      placement: { type: "after_body" },
      style: "text",
      url: "https://example.com/second",
    },
    {
      id: "link_first",
      label: "First",
      order: 1,
      placement: { paragraphIndex: 1, type: "after_paragraph" },
      style: "button",
      url: "https://example.com/first",
    },
  ],
  status: "completed",
  created_by: "admin@example.com",
  updated_by: "admin@example.com",
  created_at: "2026-08-08T18:00:00.000Z",
  updated_at: "2026-08-08T19:00:00.000Z",
  version: 8,
  email_draft_version: 2,
  email_preview_generated_at: "2026-08-08T18:05:00.000Z",
  email_preview_version: 2,
  tested_at: "2026-08-08T18:10:00.000Z",
  email_test_version: 2,
  approved_at: "2026-08-08T18:20:00.000Z",
  queueing_started_at: "2026-08-08T18:25:00.000Z",
  queued_at: "2026-08-08T18:26:00.000Z",
  sent_at: "2026-08-08T18:27:00.000Z",
  completed_at: "2026-08-08T18:40:00.000Z",
  recipient_count: 200,
  eligible_count: 50,
  excluded_count: 150,
  queued_count: 83,
  sent_count: 50,
  delivered_count: 50,
  failed_count: 0,
  skipped_count: 150,
  test_recipient: "admin@example.com",
  test_message_id: "test-message-id",
  sms_enabled: true,
  sms_body: "Download SuppVis today.",
  sms_rendered_body: "SuppVis: Download SuppVis today.",
  sms_draft_version: 3,
  sms_preview_generated_at: "2026-08-08T18:06:00.000Z",
  sms_preview_version: 3,
  sms_saved_at: "2026-08-08T18:04:00.000Z",
  sms_tested_at: "2026-08-08T18:12:00.000Z",
  sms_test_version: 3,
  sms_test_recipient_id: "sms_admin",
  sms_test_recipient_masked: "***1234",
  sms_test_message_sid: "SM123",
  sms_test_provider_status: "delivered",
  sms_test_sender_masked: "***0000",
  sms_test_status: "delivered",
  sms_test_transport: "sms",
  sms_character_count: 33,
  sms_segment_count: 1,
  sms_encoding: "GSM-7",
  sms_eligible_count: 33,
  sms_excluded_count: 117,
  sms_queued_count: 33,
  sms_sent_count: 33,
  sms_delivered_count: 33,
  sms_failed_count: 0,
  sms_skipped_count: 117,
  audience_counted_at: "2026-08-08T18:15:00.000Z",
  audience_version: 7,
  audience_email_total: 200,
  audience_email_eligible: 50,
  audience_email_excluded: 150,
  audience_email_status: "success",
  audience_sms_total: 150,
  audience_sms_eligible: 33,
  audience_sms_excluded: 117,
  audience_sms_status: "success",
  audience_segment: "custom",
  custom_audience_subscriber_ids: ["beta_a", "beta_b"],
  is_pinned: true,
  pinned_at: "2026-08-08T18:00:00.000Z",
  pinned_by: "admin@example.com",
};

assert.equal(isReusableEmailCampaign(source), true);
assert.equal(
  isReusableEmailCampaign({
    ...source,
    queueing_started_at: null,
    queued_at: null,
    sent_at: null,
    status: "tested",
  }),
  false,
);

const draft = deriveReusableEmailCampaignDraft({
  adminIdentifier: "andrew@example.com",
  id: "email_campaign_22222222-2222-4222-8222-222222222222",
  now,
  source,
});

assert.equal(draft.id, "email_campaign_22222222-2222-4222-8222-222222222222");
assert.equal(draft.status, "tested");
assert.equal(draft.version, 1);
assert.equal(draft.email_draft_version, 1);
assert.equal(draft.email_preview_version, 1);
assert.equal(draft.email_test_version, 1);
assert.equal(draft.sms_draft_version, 1);
assert.equal(draft.sms_preview_version, 1);
assert.equal(draft.sms_test_version, 1);
assert.equal(draft.approved_at, null);
assert.equal(draft.sent_at, null);
assert.equal(draft.queueing_started_at, undefined);
assert.equal(draft.queued_at, undefined);
assert.equal(draft.completed_at, undefined);
assert.equal(draft.recipient_count, undefined);
assert.equal(draft.eligible_count, undefined);
assert.equal(draft.sms_eligible_count, undefined);
assert.equal(draft.audience_counted_at, null);
assert.equal(draft.audience_version, 0);
assert.equal(draft.audience_email_eligible, 0);
assert.equal(draft.audience_sms_eligible, 0);
assert.equal(draft.audience_segment, "custom");
assert.deepEqual(draft.custom_audience_subscriber_ids, ["beta_a", "beta_b"]);
assert.equal(draft.is_pinned, false);
assert.deepEqual(
  draft.links.map((link) => [link.label, link.order]),
  [
    ["First", 1],
    ["Second", 2],
  ],
);

const staleSource = {
  ...source,
  email_test_version: 1,
  sms_test_version: 1,
};
const staleDraft = deriveReusableEmailCampaignDraft({
  adminIdentifier: "andrew@example.com",
  id: "email_campaign_33333333-3333-4333-8333-333333333333",
  now,
  source: staleSource,
});

assert.equal(staleDraft.status, "draft");
assert.equal(staleDraft.email_test_version, 0);
assert.equal(staleDraft.sms_test_version, 0);

console.log("admin campaign reuse derivation verified");
