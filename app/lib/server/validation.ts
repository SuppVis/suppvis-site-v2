import { parsePhoneNumberFromString } from "libphonenumber-js/min";
import { z } from "zod";

const emailSchema = z
  .string()
  .trim()
  .min(1, "Email is required.")
  .max(254, "Email is too long.")
  .email("Enter a valid email address.")
  .refine(hasReasonableEmailShape, "Enter a valid email address.");

const nameSchema = z
  .string()
  .trim()
  .min(1, "Enter your first and last name.")
  .max(50, "Name is too long.")
  .refine(hasReasonableNameShape, "Enter a valid name.");

const phoneSchema = z
  .string()
  .trim()
  .max(40, "Phone number is too long.")
  .optional()
  .default("");

const sourceSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .optional()
  .default("unknown");

const honeypotSchema = z.string().trim().max(200).optional().default("");

export const betaApplicationSchema = z
  .object({
    firstName: nameSchema,
    lastName: nameSchema,
    email: emailSchema,
    phone: phoneSchema,
    smsOptIn: z.boolean().optional().default(false),
    sourcePage: sourceSchema,
    botField: honeypotSchema,
  })
  .strict()
  .superRefine((data, ctx) => {
    const hasPhone = Boolean(data.phone.trim());

    if (hasPhone && !normalizePhoneToE164(data.phone)) {
      ctx.addIssue({
        code: "custom",
        path: ["phone"],
        message: "Enter a valid phone number.",
      });
    }

    if (data.smsOptIn && !hasPhone) {
      ctx.addIssue({
        code: "custom",
        path: ["phone"],
        message: "Enter a phone number to opt into texts.",
      });
    }

  });

export const emailSubscriberSchema = z.object({
  email: emailSchema,
  consentSource: sourceSchema,
  botField: honeypotSchema,
}).strict();

export const smsSubscriberSchema = z
  .object({
    phone: z
      .string()
      .trim()
      .min(1, "Phone number is required.")
      .max(40, "Phone number is too long."),
    smsConsent: z.boolean(),
    consentSource: sourceSchema,
    botField: honeypotSchema,
  })
  .strict()
  .superRefine((data, ctx) => {
    if (!normalizePhoneToE164(data.phone)) {
      ctx.addIssue({
        code: "custom",
        path: ["phone"],
        message: "Enter a valid phone number.",
      });
    }

    if (!data.smsConsent) {
      ctx.addIssue({
        code: "custom",
        path: ["smsConsent"],
        message: "SMS consent is required.",
      });
    }
  });

export const broadcastAuditSchema = z.object({
  channel: z.enum(["email", "sms", "both"]),
  intendedAudience: z.string().trim().min(1).max(120),
  messagePreview: z.string().trim().min(1).max(500),
  targetCount: z.number().int().nonnegative().max(1_000_000).optional(),
  dryRun: z.boolean().optional().default(true),
}).strict();

export const emailUnsubscribeSchema = z.object({
  subscriberId: z
    .string()
    .trim()
    .regex(/^email_[a-f0-9]{32}$/, "Invalid unsubscribe link."),
  token: z.string().trim().min(24).max(200),
}).strict();

export const twilioInboundSmsSchema = z.object({
  From: z.string().trim().min(1).max(40),
  Body: z.string().trim().max(1600).default(""),
  MessageSid: z.string().trim().max(80).optional(),
}).passthrough();

export const twilioStatusCallbackSchema = z.object({
  MessageSid: z.string().trim().min(1).max(80),
  MessageStatus: z.string().trim().max(80).optional(),
  SmsStatus: z.string().trim().max(80).optional(),
  ErrorCode: z.string().trim().max(40).optional(),
  ErrorMessage: z.string().trim().max(500).optional(),
}).passthrough();

function hasReasonableEmailShape(email: string) {
  return /^[^\s@]{1,64}@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/.test(
    email.trim(),
  );
}

function hasReasonableNameShape(name: string) {
  return /^[\p{L}][\p{L}\p{M}'’ -]{0,49}$/u.test(name.trim());
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function normalizeDisplayName(name: string) {
  return name
    .trim()
    .replace(/\s+/g, " ")
    .split(/([-'’\s])/u)
    .map((part) => {
      if (!part || /^[-'’\s]$/u.test(part)) {
        return part;
      }

      return (
        part.charAt(0).toLocaleUpperCase("en-US") +
        part.slice(1).toLocaleLowerCase("en-US")
      );
    })
    .join("");
}

export function normalizePhoneToE164(phone: string) {
  const trimmed = phone.trim();

  if (!trimmed) {
    return null;
  }

  const parsed = parsePhoneNumberFromString(
    trimmed,
    trimmed.startsWith("+") ? undefined : "US",
  );

  return parsed?.isValid() ? parsed.number : null;
}
