import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import ts from "typescript";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const rendererPath = path.resolve(
  "app/lib/server/messages/admin-campaign.ts",
);
const source = fs.readFileSync(rendererPath, "utf8");
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
  process: { env: {} },
  require,
  URL,
};

vm.runInNewContext(transpiled, sandbox, { filename: rendererPath });

const {
  normalizeAdminCampaignLinks,
  renderAdminCampaignEmail,
} = sandbox.module.exports;

function render(input) {
  return renderAdminCampaignEmail({
    body: "First paragraph.\n\nSecond paragraph.\n\nThird paragraph.",
    heading: "Announcement heading",
    subject: "Announcement subject",
    ...input,
  });
}

function assertOrder(haystack, needles) {
  let previousIndex = -1;

  for (const needle of needles) {
    const currentIndex = haystack.indexOf(needle, previousIndex + 1);
    assert.notEqual(currentIndex, -1, `${needle} was not rendered`);
    assert(
      currentIndex > previousIndex,
      `${needle} rendered before the previous expected item`,
    );
    previousIndex = currentIndex;
  }
}

{
  const email = render({ links: [] });

  assert(!email.html.includes("<a href="), "zero-link email rendered a link");
  assert(!email.text.includes("http"), "zero-link text rendered a link");
}

{
  const links = normalizeAdminCampaignLinks({
    ctaLabel: "Legacy CTA",
    ctaUrl: "https://example.com/legacy",
  });
  const email = render({ links });

  assertOrder(email.html, [
    "First paragraph.",
    "Second paragraph.",
    "Third paragraph.",
    "Legacy CTA",
    "https://example.com/legacy",
  ]);
}

{
  const email = render({
    links: [
      {
        id: "link_before",
        label: "Before",
        order: 1,
        placement: { type: "before_body" },
        style: "text",
        url: "https://example.com/before",
      },
      {
        id: "link_after_two",
        label: "After Two",
        order: 2,
        placement: { paragraphIndex: 2, type: "after_paragraph" },
        style: "button",
        url: "https://example.com/two",
      },
      {
        id: "link_bottom",
        label: "Bottom",
        order: 3,
        placement: { type: "footer" },
        style: "text",
        url: "https://example.com/bottom",
      },
    ],
  });

  assertOrder(email.html, [
    "Before",
    "First paragraph.",
    "Second paragraph.",
    "After Two",
    "Third paragraph.",
    "Bottom",
  ]);
  assertOrder(email.text, [
    "Before: https://example.com/before",
    "First paragraph.",
    "Second paragraph.",
    "After Two: https://example.com/two",
    "Third paragraph.",
    "Bottom: https://example.com/bottom",
  ]);
}

{
  const email = render({
    body: "Only paragraph.",
    links: [
      {
        id: "link_missing",
        label: "Missing Paragraph",
        order: 1,
        placement: { paragraphIndex: 5, type: "after_paragraph" },
        style: "button",
        url: "https://example.com/missing",
      },
    ],
  });

  assertOrder(email.html, ["Only paragraph.", "Missing Paragraph"]);
}

{
  const links = normalizeAdminCampaignLinks({
    links: [
      {
        id: "link_c",
        label: "Third",
        order: 3,
        placement: { type: "after_body" },
        style: "text",
        url: "https://example.com/third",
      },
      {
        id: "link_a",
        label: "First",
        order: 1,
        placement: { type: "after_body" },
        style: "text",
        url: "https://example.com/first",
      },
    ],
  });

  assert.deepEqual(
    links.map((link) => [link.label, link.order]),
    [
      ["First", 1],
      ["Third", 2],
    ],
  );
}

console.log("admin campaign link rendering verified");
