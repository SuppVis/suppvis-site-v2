import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const generatedPath = resolve("app/admin/catalog/contracts.generated.ts");
const generated = readFileSync(generatedPath);
const digest = createHash("sha256").update(generated).digest("hex");
assert.equal(
  digest,
  "0f7ce95cafbbe84e996ade17b74f8ab6a5bd499e4e1eb47c854c40701d9ee2bf",
  "The generated website catalog contract changed without regenerating its checked digest.",
);

const platformPath = process.env.ADMIN_CATALOG_PLATFORM_CONTRACT
  ? resolve(process.env.ADMIN_CATALOG_PLATFORM_CONTRACT)
  : resolve("../platform-admin-catalog/contracts/adminCatalogWeb.ts");
if (existsSync(platformPath)) {
  assert.deepEqual(
    generated,
    readFileSync(platformPath),
    "Website catalog types differ from the platform portable contract.",
  );
}

console.log("Website admin catalog generated contract check passed.");
