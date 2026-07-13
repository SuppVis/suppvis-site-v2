import type { Session } from "next-auth";

export type AdminAccess =
  | {
      ok: true;
      email: string;
      identifier: string;
    }
  | {
      ok: false;
      reason: "not_authenticated" | "not_allowed" | "not_configured";
      email?: string;
    };

function splitEnvList(value: string | undefined) {
  return (value || "")
    .split(/[,\n]/)
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

export function getAllowedAdminEmails() {
  return splitEnvList(process.env.ADMIN_ALLOWED_EMAILS);
}

export function isMicrosoftAuthConfigured() {
  return Boolean(
    process.env.AUTH_SECRET?.trim() &&
      process.env.AUTH_MICROSOFT_ENTRA_ID_ID?.trim() &&
      process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET?.trim() &&
      process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER?.trim(),
  );
}

export function isAdminEmailAllowed(email: string | null | undefined) {
  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail) {
    return false;
  }

  const allowedEmails = getAllowedAdminEmails();
  return allowedEmails.includes(normalizedEmail);
}

export function getAdminAccess(session: Session | null): AdminAccess {
  if (!isMicrosoftAuthConfigured()) {
    return { ok: false, reason: "not_configured" };
  }

  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) {
    return { ok: false, reason: "not_authenticated" };
  }

  if (!isAdminEmailAllowed(email)) {
    return { ok: false, reason: "not_allowed", email };
  }

  return {
    ok: true,
    email,
    identifier: `entra:${email}`,
  };
}

export function maskAdminEmail(email: string | null | undefined) {
  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail) {
    return "unknown";
  }

  const [name, domain] = normalizedEmail.split("@");
  if (!name || !domain) {
    return "invalid";
  }

  const visible = name.length <= 2 ? name[0] || "*" : name.slice(0, 2);
  return `${visible}***@${domain}`;
}
