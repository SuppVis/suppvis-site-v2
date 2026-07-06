import type { NextRequest } from "next/server";
import { sha256Hex, safeCompareHex } from "./crypto";
import { PublicApiError, ServerConfigError } from "./errors";

export function requireAdminIdentifier(request: NextRequest) {
  const expectedHash = process.env.ADMIN_BROADCAST_TOKEN_HASH?.trim().toLowerCase();

  if (!expectedHash) {
    throw new ServerConfigError(
      "Missing required environment variable: ADMIN_BROADCAST_TOKEN_HASH",
    );
  }

  const authorization = request.headers.get("authorization") || "";
  const [scheme, token] = authorization.split(" ");

  if (scheme !== "Bearer" || !token) {
    throw new PublicApiError(
      401,
      "admin_auth_required",
      "Admin authorization is required.",
    );
  }

  const tokenHash = sha256Hex(token.trim());

  if (!safeCompareHex(tokenHash, expectedHash)) {
    throw new PublicApiError(
      403,
      "admin_auth_forbidden",
      "Admin authorization failed.",
    );
  }

  return `token:${tokenHash.slice(0, 12)}`;
}
