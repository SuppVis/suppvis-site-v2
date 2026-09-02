import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  canonicalCatalogProxyPath,
  catalogBridgeBodySha256,
  createCatalogBridgeAssertion,
  isCatalogBridgeRouteAllowed,
  isCatalogBridgeSameOrigin,
} from "../app/lib/server/catalog-bridge-contract.ts";

const body = new TextEncoder().encode('{"product":{"labelName":"Example"}}');
const hash = catalogBridgeBodySha256(body);
assert.equal(hash, "34cc6208052a6b57d11c473b39113b97e9b3e2fa65b5e8c74a6d3221b9cad6f0");

const path = canonicalCatalogProxyPath(new URL("https://admin.example/api/admin/catalog/products/search?view=summary&q=zinc&limit=30&q=iron"));
assert.equal(path, "/api/admin/catalog/products/search?limit=30&q=iron&q=zinc&view=summary");

const secret = "0123456789abcdef0123456789abcdef";
const assertion = createCatalogBridgeAssertion({
  email: "ADMIN@SuppVis.Health ",
  httpMethod: "post",
  httpPath: "/api/admin/catalog/products",
  bodySha256: hash,
  nowSeconds: 2_000_000_000,
  secret,
  jti: "9d2d2b96-53c5-4b17-8aee-df90ad2730b1",
});
const [encodedHeader, encodedPayload, signature] = assertion.split(".");
assert.deepEqual(JSON.parse(Buffer.from(encodedHeader, "base64url").toString()), { alg: "HS256", typ: "JWT" });
assert.deepEqual(JSON.parse(Buffer.from(encodedPayload, "base64url").toString()), {
  iss: "suppvis-site-v2",
  aud: "suppvis-platform:admin-catalog",
  purpose: "catalog_admin_bridge",
  sub: "entra:admin@suppvis.health",
  email: "admin@suppvis.health",
  iat: 2_000_000_000,
  exp: 2_000_000_060,
  jti: "9d2d2b96-53c5-4b17-8aee-df90ad2730b1",
  http_method: "POST",
  http_path: "/api/admin/catalog/products",
  body_sha256: hash,
});
assert.equal(signature, createHmac("sha256", secret).update(`${encodedHeader}.${encodedPayload}`).digest("base64url"));
assert.throws(() => createCatalogBridgeAssertion({ email: "admin@suppvis.health", httpMethod: "GET", httpPath: "/", bodySha256: hash, secret: "short" }));

assert.equal(isCatalogBridgeRouteAllowed("GET", "/api/admin/catalog/products/search"), true);
assert.equal(isCatalogBridgeRouteAllowed("POST", "/api/admin/catalog/templates/ocr"), true);
assert.equal(isCatalogBridgeRouteAllowed("DELETE", "/api/admin/catalog/products/abc"), false);
assert.equal(isCatalogBridgeRouteAllowed("GET", "/api/admin/catalog/not-authorized"), false);
assert.equal(isCatalogBridgeSameOrigin("https://admin.suppvis.health", "https://admin.suppvis.health"), true);
assert.equal(isCatalogBridgeSameOrigin("https://evil.example", "https://admin.suppvis.health"), false);
assert.equal(isCatalogBridgeSameOrigin(null, "https://admin.suppvis.health"), false);

const proxySource = readFileSync("app/lib/server/catalog-bridge.ts", "utf8");
assert.match(proxySource, /method !== "GET" && !hasSameOrigin/);
assert.match(proxySource, /Authorization: `Bearer \$\{assertion\}`/);
assert.doesNotMatch(proxySource, /request\.headers\.get\(["']cookie["']\)/i);
assert.doesNotMatch(proxySource, /["']Authorization["']:\s*response\.headers/i);
assert.match(proxySource, /"Cache-Control": "private, no-store"/);

console.log("Website admin catalog bridge checks passed.");
