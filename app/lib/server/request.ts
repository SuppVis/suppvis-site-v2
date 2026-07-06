import { NextResponse, type NextRequest } from "next/server";
import { PublicApiError } from "./errors";
import {
  checkRateLimit,
  getClientRateLimitKey,
} from "./rate-limit";

type RateLimitConfig = {
  scope: string;
  limit: number;
  windowMs: number;
};

export async function readJsonBody(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    throw new PublicApiError(
      415,
      "unsupported_content_type",
      "Please submit the form again.",
    );
  }

  try {
    return await request.json();
  } catch {
    throw new PublicApiError(
      400,
      "invalid_json",
      "Please submit the form again.",
    );
  }
}

export function enforceRateLimit(
  request: NextRequest,
  config: RateLimitConfig,
) {
  const key = getClientRateLimitKey(request, config.scope);
  const result = checkRateLimit(key, {
    limit: config.limit,
    windowMs: config.windowMs,
  });

  if (result.allowed) {
    return null;
  }

  return NextResponse.json(
    {
      ok: false,
      code: "rate_limited",
      message: "Too many submissions. Please wait a moment and try again.",
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfterSeconds),
      },
    },
  );
}

export function isHoneypotFilled(value: string | undefined) {
  return Boolean(value?.trim());
}
