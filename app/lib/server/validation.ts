import { parsePhoneNumberFromString } from "libphonenumber-js/min";
import { z } from "zod";

const emailSchema = z
  .string()
  .trim()
  .min(1, "Email is required.")
  .max(254, "Email is too long.")
  .email("Enter a valid email address.");

const nameSchema = z
  .string()
  .trim()
  .min(1, "Enter your first and last name.")
  .max(80, "Name is too long.");

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

    if (hasPhone && !data.smsOptIn) {
      ctx.addIssue({
        code: "custom",
        path: ["smsOptIn"],
        message: "Check the SMS consent box or remove the phone number.",
      });
    }
  });

export const emailSubscriberSchema = z.object({
  email: emailSchema,
  consentSource: sourceSchema,
  botField: honeypotSchema,
});

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
});

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
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
