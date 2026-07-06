import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function sha256Hex(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function stableId(prefix: string, value: string) {
  return `${prefix}_${sha256Hex(value).slice(0, 32)}`;
}

export function createUrlSafeToken() {
  return randomBytes(32).toString("base64url");
}

export function safeCompareHex(actualHex: string, expectedHex: string) {
  try {
    const actual = Buffer.from(actualHex, "hex");
    const expected = Buffer.from(expectedHex, "hex");

    if (actual.length !== expected.length) {
      return false;
    }

    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
