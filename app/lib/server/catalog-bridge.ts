import type { NextRequest } from "next/server";
import { requireAdminSession } from "./admin-session";
import {
  CATALOG_PROXY_MAX_BODY_BYTES,
  canonicalCatalogProxyPath,
  catalogBridgeBodySha256,
  createCatalogBridgeAssertion,
  isCatalogBridgeRouteAllowed,
  isCatalogBridgeSameOrigin,
} from "./catalog-bridge-contract";

function platformBaseUrl() {
  const raw = process.env.CATALOG_PLATFORM_BASE_URL?.trim();
  if (!raw) throw new Error("Catalog platform URL is unavailable.");
  const parsed = new URL(raw);
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error("Catalog platform URL is invalid.");
  }
  if (parsed.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(parsed.hostname)) {
    throw new Error("Catalog platform URL must use HTTPS.");
  }
  parsed.pathname = "/";
  return parsed;
}

function proxyError(status: number, code: string, message: string) {
  return Response.json(
    { error: { code, message } },
    { status, headers: { "Cache-Control": "private, no-store" } },
  );
}

function configuredSiteOrigin(request: NextRequest) {
  const raw = process.env.ADMIN_SITE_ORIGIN?.trim();
  if (!raw) return request.nextUrl.origin;
  return new URL(raw).origin;
}

function hasSameOrigin(request: NextRequest) {
  return isCatalogBridgeSameOrigin(request.headers.get("origin"), configuredSiteOrigin(request));
}

export async function proxyCatalogAdminRequest(request: NextRequest) {
  const method = request.method.toUpperCase();
  const pathname = request.nextUrl.pathname;
  if (!isCatalogBridgeRouteAllowed(method, pathname)) {
    return proxyError(404, "INVALID_REQUEST", "Catalog route not found.");
  }
  if (method !== "GET" && !hasSameOrigin(request)) {
    return proxyError(403, "ADMIN_REQUIRED", "A same-origin catalog request is required.");
  }

  let admin;
  try {
    admin = await requireAdminSession();
  } catch (error) {
    const status = typeof error === "object" && error !== null && "status" in error
      ? Number(error.status)
      : 500;
    return proxyError(
      Number.isInteger(status) ? status : 500,
      status === 401 ? "UNAUTHENTICATED" : status === 403 ? "ADMIN_REQUIRED" : "INTERNAL_ERROR",
      status === 401
        ? "Sign in to access the catalog admin tools."
        : status === 403
          ? "Catalog administrator access is required."
          : "Catalog authorization is temporarily unavailable.",
    );
  }

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > CATALOG_PROXY_MAX_BODY_BYTES) {
    return proxyError(400, "INVALID_REQUEST", "The catalog request body is too large.");
  }
  const body = method === "GET"
    ? new Uint8Array()
    : new Uint8Array(await request.arrayBuffer());
  if (body.byteLength > CATALOG_PROXY_MAX_BODY_BYTES) {
    return proxyError(400, "INVALID_REQUEST", "The catalog request body is too large.");
  }

  const httpPath = canonicalCatalogProxyPath(new URL(request.url));
  let upstream: URL;
  let assertion: string;
  try {
    upstream = new URL(httpPath, platformBaseUrl());
    assertion = createCatalogBridgeAssertion({
      email: admin.email,
      httpMethod: method,
      httpPath,
      bodySha256: catalogBridgeBodySha256(body),
    });
  } catch {
    return proxyError(503, "INTERNAL_ERROR", "The catalog bridge is temporarily unavailable.");
  }

  try {
    const response = await fetch(upstream, {
      method,
      headers: {
        Authorization: `Bearer ${assertion}`,
        Accept: "application/json",
        ...(request.headers.get("content-type")
          ? { "Content-Type": request.headers.get("content-type")! }
          : {}),
      },
      body: method === "GET" ? undefined : body,
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(90_000),
    });
    const responseBytes = await response.arrayBuffer();
    return new Response(responseBytes, {
      status: response.status,
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Type": response.headers.get("content-type") ?? "application/json",
      },
    });
  } catch {
    return proxyError(503, "DATABASE_UNAVAILABLE", "The catalog is temporarily unavailable.");
  }
}
