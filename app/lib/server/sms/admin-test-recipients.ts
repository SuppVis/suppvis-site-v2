import { parsePhoneNumberFromString } from "libphonenumber-js/min";
import { isAdminEmailAllowed } from "@/app/lib/server/admin-access";
import { ServerConfigError } from "@/app/lib/server/errors";

const ADMIN_SMS_TEST_RECIPIENTS_ENV = "ADMIN_SMS_TEST_RECIPIENTS";

export type AdminSmsTestRecipient = {
  adminEmail: string;
  maskedPhone: string;
  phoneE164: string;
  recipientId: string;
};

function normalizeAdminEmail(email: string) {
  return email.trim().toLowerCase();
}

function hasReasonableAdminEmailShape(email: string) {
  return /^[^\s@]{1,64}@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/.test(
    email,
  );
}

export function normalizeAdminSmsTestPhoneToE164(phone: string) {
  const parsed = parsePhoneNumberFromString(phone.trim(), "US");

  if (!parsed?.isValid() || parsed.country !== "US") {
    return null;
  }

  return parsed.number.startsWith("+1") ? parsed.number : null;
}

export function maskAdminSmsTestPhone(phoneE164: string) {
  const lastFour = phoneE164.slice(-4);
  return `(***) ***-${lastFour}`;
}

export function parseAdminSmsTestRecipients(
  value = process.env[ADMIN_SMS_TEST_RECIPIENTS_ENV],
) {
  const recipients = new Map<string, AdminSmsTestRecipient>();
  const rawValue = value?.trim();

  if (!rawValue) {
    return recipients;
  }

  const seenPhones = new Set<string>();
  const entries = rawValue
    .split(/[,\n]/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  for (const entry of entries) {
    const separatorIndex = entry.indexOf("=");

    if (separatorIndex <= 0 || separatorIndex !== entry.lastIndexOf("=")) {
      throw new ServerConfigError("Invalid admin SMS test recipient mapping.");
    }

    const adminEmail = normalizeAdminEmail(entry.slice(0, separatorIndex));
    const phoneE164 = normalizeAdminSmsTestPhoneToE164(
      entry.slice(separatorIndex + 1),
    );

    if (!hasReasonableAdminEmailShape(adminEmail) || !phoneE164) {
      throw new ServerConfigError("Invalid admin SMS test recipient mapping.");
    }

    if (recipients.has(adminEmail) || seenPhones.has(phoneE164)) {
      throw new ServerConfigError("Duplicate admin SMS test recipient mapping.");
    }

    recipients.set(adminEmail, {
      adminEmail,
      maskedPhone: maskAdminSmsTestPhone(phoneE164),
      phoneE164,
      recipientId: `admin:${adminEmail}:last4:${phoneE164.slice(-4)}`,
    });
    seenPhones.add(phoneE164);
  }

  return recipients;
}

export function getAdminSmsTestRecipientForEmail(email: string) {
  const adminEmail = normalizeAdminEmail(email);

  if (!isAdminEmailAllowed(adminEmail)) {
    return null;
  }

  return parseAdminSmsTestRecipients().get(adminEmail) || null;
}

export function getAdminSmsTestRecipientPreview(email: string) {
  try {
    const recipient = getAdminSmsTestRecipientForEmail(email);

    return {
      configError: false,
      maskedPhone: recipient?.maskedPhone || null,
    };
  } catch {
    return {
      configError: true,
      maskedPhone: null,
    };
  }
}
