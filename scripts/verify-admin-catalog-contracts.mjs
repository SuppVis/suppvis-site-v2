import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const generatedPath = resolve("app/admin/catalog/contracts.generated.ts");
const generated = readFileSync(generatedPath);
const digest = createHash("sha256").update(generated).digest("hex");
assert.equal(
  digest,
  "c25a14ae44826df20f0caecf6525102a90085c18c49995d895753a1b26e2c5e6",
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
