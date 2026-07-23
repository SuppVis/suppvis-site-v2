import { parsePhoneNumberFromString } from "libphonenumber-js/min";
import { z } from "zod";
import { SMS_CONSENT_VERSION } from "@/app/lib/smsConsent";
import {
  ADMIN_SMS_MAX_SEGMENTS,
  hasAdminSmsRequiredCopyDuplication,
  isAdminSmsWithinLimits,
  renderAdminSmsAnnouncement,
} from "@/app/lib/server/messages/admin-sms";

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
    smsInformationalConsent: z.boolean().optional().default(false),
    smsMarketingConsent: z.boolean().optional().default(false),
    smsConsentVersion: z
      .string()
      .trim()
      .max(40)
      .optional()
      .default(SMS_CONSENT_VERSION),
    // Legacy cached clients may still submit this combined field. Preserve the
    // value for audit, but never infer either new consent category from it.
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

    if (
      (data.smsInformationalConsent || data.smsMarketingConsent) &&
      !hasPhone
    ) {
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
    smsInformationalConsent: z.boolean().optional().default(false),
    smsMarketingConsent: z.boolean().optional().default(false),
    smsConsentVersion: z
      .string()
      .trim()
      .max(40)
      .optional()
      .default(SMS_CONSENT_VERSION),
    smsConsent: z.boolean().optional().default(false),
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

    if (!data.smsInformationalConsent) {
      ctx.addIssue({
        code: "custom",
        path: ["smsInformationalConsent"],
        message: "Select beta SMS consent.",
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

export const adminEmailCampaignMessageTypes = [
  "beta_update",
  "testflight_update",
  "product_update",
  "feedback_request",
  "important_notice",
] as const;

export const adminEmailCampaignStatuses = [
  "draft",
  "test_ready",
  "tested",
  "approved",
  "queueing",
  "queued",
  "sending",
  "completed",
  "completed_with_failures",
  "canceled",
  "failed",
] as const;

const optionalTrimmedString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .default("");

const adminCampaignCtaUrlSchema = optionalTrimmedString(300).refine(
  (value) => !value || isAllowedAdminCampaignUrl(value),
  "Enter an https:// link.",
);

const adminCampaignSmsBodySchema = z.string().trim().max(260).optional().default("");

function validateAdminSmsBody(
  smsEnabled: boolean,
  smsBody: string,
  ctx: z.RefinementCtx,
) {
  if (!smsEnabled) {
    return;
  }

  if (!smsBody) {
    ctx.addIssue({
      code: "custom",
      path: ["smsBody"],
      message: "Add text message copy before continuing.",
    });
    return;
  }

  if (hasAdminSmsRequiredCopyDuplication(smsBody)) {
    ctx.addIssue({
      code: "custom",
      path: ["smsBody"],
      message:
        "Do not include SuppVis: or the message/data-rates footer. Those are added automatically.",
    });
    return;
  }

  const rendered = renderAdminSmsAnnouncement(smsBody);

  if (!isAdminSmsWithinLimits(rendered)) {
    ctx.addIssue({
      code: "custom",
      path: ["smsBody"],
      message: `Keep the full text to ${ADMIN_SMS_MAX_SEGMENTS} SMS segments or fewer.`,
    });
  }
}

export const adminCampaignContentSchema = z
  .object({
    messageType: z.enum(adminEmailCampaignMessageTypes).default("beta_update"),
    subject: z.string().trim().min(1).max(120),
    heading: z.string().trim().min(1).max(160),
    body: z.string().trim().min(1).max(5000),
    ctaLabel: optionalTrimmedString(64),
    ctaUrl: adminCampaignCtaUrlSchema,
    smsEnabled: z.boolean().optional().default(false),
    smsBody: adminCampaignSmsBodySchema,
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.ctaUrl && !data.ctaLabel) {
      ctx.addIssue({
        code: "custom",
        path: ["ctaLabel"],
        message: "Add link text or remove the link URL.",
      });
    }

    if (data.ctaLabel && !data.ctaUrl) {
      ctx.addIssue({
        code: "custom",
        path: ["ctaUrl"],
        message: "Add a link URL or remove the link text.",
      });
    }

    validateAdminSmsBody(data.smsEnabled, data.smsBody, ctx);
  });

export const createAdminCampaignSchema = adminCampaignContentSchema;

export const updateAdminCampaignSchema = adminCampaignContentSchema.extend({
  expectedVersion: z.number().int().min(1).max(1_000_000),
}).superRefine((data, ctx) => {
  validateAdminSmsBody(true, data.smsBody, ctx);
});

export const adminCampaignIdSchema = z
  .string()
  .trim()
  .regex(/^email_campaign_[0-9a-f-]{36}$/);

export const adminCampaignPreviewSchema = adminCampaignContentSchema;

export const adminCampaignSmsPreviewSchema = z
  .object({
    smsEnabled: z.boolean().optional().default(false),
    smsBody: adminCampaignSmsBodySchema,
  })
  .strict()
  .superRefine((data, ctx) => {
    validateAdminSmsBody(true, data.smsBody, ctx);
  });

export const adminCampaignTestSendSchema = z.object({}).strict();

export const adminCampaignVersionSchema = z.object({
  expectedVersion: z.number().int().min(1).max(1_000_000),
}).strict();

export const adminCampaignPinSchema = adminCampaignVersionSchema.extend({
  pinned: z.boolean(),
});

export const adminCampaignStartSchema = adminCampaignVersionSchema.extend({
  confirmationPhrase: z.string().trim().min(1).max(80),
});

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

function isAllowedAdminCampaignUrl(value: string) {
  try {
    const url = new URL(value);

    if (url.protocol === "https:") {
      return true;
    }

    if (
      process.env.NODE_ENV !== "production" &&
      url.protocol === "http:" &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1")
    ) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}
