import { createHash, createHmac, randomUUID } from "node:crypto";

export const CATALOG_ASSERTION_TTL_SECONDS = 60;
export const CATALOG_PROXY_MAX_BODY_BYTES = 512 * 1024;

const routes: Record<string, RegExp[]> = {
  GET: [
    /^\/api\/admin\/catalog\/access$/,
    /^\/api\/admin\/catalog\/barcodes\/[^/]+$/,
    /^\/api\/admin\/catalog\/brands$/,
    /^\/api\/admin\/catalog\/canonical-supplements$/,
    /^\/api\/admin\/catalog\/products\/search$/,
    /^\/api\/admin\/catalog\/products\/[0-9a-f-]+$/i,
  ],
  POST: [
    /^\/api\/admin\/catalog\/products$/,
    /^\/api\/admin\/catalog\/products\/[0-9a-f-]+\/barcodes$/i,
    /^\/api\/admin\/catalog\/products\/[0-9a-f-]+\/template-diff$/i,
    /^\/api\/admin\/catalog\/images\/uploads$/,
    /^\/api\/admin\/catalog\/images\/[0-9a-f-]+\/access$/i,
    /^\/api\/admin\/catalog\/templates\/(front-label|barcode|ocr|public)$/,
  ],
  PATCH: [
    /^\/api\/admin\/catalog\/products\/[0-9a-f-]+$/i,
    /^\/api\/admin\/catalog\/barcodes\/[^/]+\/assignment$/,
  ],
};

type BridgeBinding = {
  bodySha256: string;
  email: string;
  httpMethod: string;
  httpPath: string;
  nowSeconds?: number;
  secret?: string;
  jti?: string;
};

function base64url(value: unknown) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

export function canonicalCatalogProxyPath(url: URL) {
  const entries = [...url.searchParams.entries()].sort(
    ([leftKey, leftValue], [rightKey, rightValue]) =>
      leftKey.localeCompare(rightKey) || leftValue.localeCompare(rightValue),
  );
  const query = new URLSearchParams(entries).toString();
  return query ? `${url.pathname}?${query}` : url.pathname;
}

export function catalogBridgeBodySha256(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function isCatalogBridgeRouteAllowed(method: string, pathname: string) {
  return routes[method.toUpperCase()]?.some((pattern) => pattern.test(pathname)) ?? false;
}

export function isCatalogBridgeSameOrigin(origin: string | null, expectedOrigin: string) {
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(expectedOrigin).origin;
  } catch {
    return false;
  }
}

export function createCatalogBridgeAssertion(binding: BridgeBinding) {
  const secret = binding.secret ?? process.env.CATALOG_ADMIN_BRIDGE_SECRET ?? "";
  if (Buffer.byteLength(secret, "utf8") < 32) throw new Error("Catalog bridge secret is unavailable.");
  const email = binding.email.trim().toLowerCase();
  if (!email) throw new Error("Catalog bridge identity is unavailable.");
  const now = binding.nowSeconds ?? Math.floor(Date.now() / 1000);
  const header = base64url({ alg: "HS256", typ: "JWT" });
  const payload = base64url({
    iss: "suppvis-site-v2",
    aud: "suppvis-platform:admin-catalog",
    purpose: "catalog_admin_bridge",
    sub: `entra:${email}`,
    email,
    iat: now,
    exp: now + CATALOG_ASSERTION_TTL_SECONDS,
    jti: binding.jti ?? randomUUID(),
    http_method: binding.httpMethod.toUpperCase(),
    http_path: binding.httpPath,
    body_sha256: binding.bodySha256,
  });
  const signature = createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${signature}`;
}
