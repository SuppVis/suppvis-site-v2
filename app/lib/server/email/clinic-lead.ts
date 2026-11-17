import { SendEmailCommand, SESv2Client } from "@aws-sdk/client-sesv2";
import { PersistenceError, ServerConfigError } from "../errors";

// Delivers each founding-practice waitlist submission by email through the
// same SES account, region, sender and configuration set the beta welcome
// emails use. The email IS the persistence for now, so a failed send surfaces
// to the user as an error instead of being swallowed.

const DEFAULT_LEADS_TO = "tannerhaslinger@suppvis.health";

export type ClinicLead = {
  practiceName: string;
  roleCredential: string;
  email: string;
  practiceType: string;
  dispensing: string;
  dispensingOther: string;
  sourcePage: string;
  submittedAt: string;
  requestId: string;
};

let client: SESv2Client | null = null;
let clientRegion: string | null = null;

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new ServerConfigError(`Missing required environment variable: ${name}`);
  }
  return value;
}

function ses(region: string) {
  if (!client || clientRegion !== region) {
    client = new SESv2Client({ region });
    clientRegion = region;
  }
  return client;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function singleLine(value: string) {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function leadRows(lead: ClinicLead): [string, string][] {
  const dispensing =
    lead.dispensing === "Other" && lead.dispensingOther
      ? `Other: ${lead.dispensingOther}`
      : lead.dispensing;
  return [
    ["Practice name", lead.practiceName],
    ["Role and credential", lead.roleCredential],
    ["Email", lead.email],
    ["Practice type", lead.practiceType],
    ["Dispensing", dispensing],
    ["Source page", lead.sourcePage],
    ["Submitted at (UTC)", lead.submittedAt],
    ["Request ID", lead.requestId],
  ];
}

export async function sendClinicLeadEmail(lead: ClinicLead) {
  const region = requiredEnv("SES_REGION");
  const fromEmail = requiredEnv("SES_FROM_EMAIL");
  const configurationSetName = process.env.SES_CONFIGURATION_SET?.trim();
  const to = process.env.CLINIC_LEADS_TO_EMAIL?.trim() || DEFAULT_LEADS_TO;

  const rows = leadRows(lead);
  const subject = singleLine(`Founding practice request: ${lead.practiceName}`).slice(0, 200);
  const text = [
    "New founding-practice waitlist submission from suppvis.health/clinics",
    "",
    ...rows.map(([k, v]) => `${k}: ${v}`),
    "",
    "Reply to this email to respond to the practice directly.",
  ].join("\n");
  const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#0A0F14">
<h2 style="margin:0 0 16px">New founding-practice request</h2>
<table cellpadding="6" style="border-collapse:collapse">
${rows
  .map(
    ([k, v]) =>
      `<tr><td style="color:#5A7089;vertical-align:top">${escapeHtml(k)}</td><td><strong>${escapeHtml(v)}</strong></td></tr>`,
  )
  .join("\n")}
</table>
<p style="color:#5A7089;margin-top:16px">Reply to this email to respond to the practice directly.</p>
</body></html>`;

  try {
    const output = await ses(region).send(
      new SendEmailCommand({
        FromEmailAddress: `SuppVis Clinics <${fromEmail}>`,
        ReplyToAddresses: [lead.email],
        Destination: { ToAddresses: [to] },
        ...(configurationSetName ? { ConfigurationSetName: configurationSetName } : {}),
        EmailTags: [{ Name: "message_type", Value: "clinic_lead" }],
        Content: {
          Simple: {
            Subject: { Charset: "UTF-8", Data: subject },
            Body: {
              Html: { Charset: "UTF-8", Data: html },
              Text: { Charset: "UTF-8", Data: text },
            },
          },
        },
      }),
    );
    return { messageId: output.MessageId };
  } catch (error) {
    console.error("[clinic-lead] email send failed", {
      requestId: lead.requestId,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    throw new PersistenceError(
      "Clinic lead email failed",
      "clinic_lead_email_failed",
      error instanceof Error ? error.name : undefined,
      error instanceof Error ? error.message : undefined,
    );
  }
}
