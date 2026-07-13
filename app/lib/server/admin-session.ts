import { auth } from "@/auth";
import { getAdminAccess } from "./admin-access";
import { PublicApiError } from "./errors";

export async function requireAdminSession() {
  const session = await auth();
  const access = getAdminAccess(session);

  if (access.ok) {
    return access;
  }

  if (access.reason === "not_authenticated") {
    throw new PublicApiError(
      401,
      "admin_auth_required",
      "Admin authorization is required.",
    );
  }

  if (access.reason === "not_configured") {
    throw new PublicApiError(
      503,
      "admin_auth_unavailable",
      "Admin authorization is temporarily unavailable.",
    );
  }

  throw new PublicApiError(
    403,
    "admin_auth_forbidden",
    "Admin authorization failed.",
  );
}

export function adminEmailFromIdentifier(identifier: string) {
  return identifier.startsWith("entra:") ? identifier.slice("entra:".length) : "";
}
