export type AdminSmsEncoding = "GSM-7" | "Unicode";

export type AdminSmsRenderResult = {
  body: string;
  characterCount: number;
  editableBody: string;
  encoding: AdminSmsEncoding;
  segmentCount: number;
};

export const ADMIN_SMS_MAX_SEGMENTS = 2;
export const ADMIN_SMS_REQUIRED_PREFIX = "SuppVis:";
export const ADMIN_SMS_REQUIRED_FOOTER =
  "Msg frequency varies. Msg & data rates may apply.";

const GSM_7_EXTENSION_CHARS = "^{}\\[~]|";
const GSM_7_BASIC_SET = new Set(
  Array.from({ length: 95 }, (_, index) => String.fromCharCode(index + 32))
    .filter((char) => !GSM_7_EXTENSION_CHARS.includes(char))
    .concat(["\n", "\r"]),
);
const GSM_7_EXTENSION_SET = new Set(GSM_7_EXTENSION_CHARS.split(""));

function normalizedAdminBody(body: string) {
  return body.trim().replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n");
}

export function hasAdminSmsRequiredCopyDuplication(body: string) {
  const normalized = normalizedAdminBody(body).toLowerCase();

  return (
    normalized.startsWith("suppvis:") ||
    normalized.includes("msg frequency varies") ||
    normalized.includes("msg & data rates") ||
    normalized.includes("message and data rates")
  );
}

export function detectAdminSmsEncoding(message: string): AdminSmsEncoding {
  for (const char of message) {
    if (!GSM_7_BASIC_SET.has(char) && !GSM_7_EXTENSION_SET.has(char)) {
      return "Unicode";
    }
  }

  return "GSM-7";
}

function gsm7SeptetLength(message: string) {
  let length = 0;

  for (const char of message) {
    length += GSM_7_EXTENSION_SET.has(char) ? 2 : 1;
  }

  return length;
}

export function estimateAdminSmsSegments(message: string) {
  const encoding = detectAdminSmsEncoding(message);
  const characterCount =
    encoding === "GSM-7"
      ? gsm7SeptetLength(message)
      : Array.from(message).length;
  const singleSegmentLimit = encoding === "GSM-7" ? 160 : 70;
  const multipartSegmentLimit = encoding === "GSM-7" ? 153 : 67;
  const segmentCount =
    characterCount <= singleSegmentLimit
      ? 1
      : Math.ceil(characterCount / multipartSegmentLimit);

  return {
    characterCount,
    encoding,
    segmentCount,
  };
}

export function renderAdminSmsAnnouncement(
  editableBody: string,
): AdminSmsRenderResult {
  const normalizedBody = normalizedAdminBody(editableBody);
  const rendered = `${ADMIN_SMS_REQUIRED_PREFIX} ${normalizedBody}\n\n${ADMIN_SMS_REQUIRED_FOOTER}`;
  const metrics = estimateAdminSmsSegments(rendered);

  return {
    body: rendered,
    editableBody: normalizedBody,
    ...metrics,
  };
}

export function isAdminSmsWithinLimits(message: AdminSmsRenderResult) {
  return message.segmentCount <= ADMIN_SMS_MAX_SEGMENTS;
}
