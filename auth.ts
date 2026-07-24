import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import {
  isAdminEmailAllowed,
  isMicrosoftAuthConfigured,
  maskAdminEmail,
} from "@/app/lib/server/admin-access";

const microsoftAuthConfigured = isMicrosoftAuthConfigured();
const ADMIN_SESSION_ABSOLUTE_MAX_AGE_SECONDS = 8 * 60 * 60;

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: {
    strategy: "jwt",
    maxAge: ADMIN_SESSION_ABSOLUTE_MAX_AGE_SECONDS,
    updateAge: 60,
  },
  pages: {
    signIn: "/admin/sign-in",
    error: "/admin/sign-in",
  },
  providers: microsoftAuthConfigured
    ? [
        MicrosoftEntraID({
          authorization: {
            params: {
              max_age: "0",
              prompt: "login",
            },
          },
          clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
          clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
          issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
        }),
      ]
    : [],
  callbacks: {
    async signIn({ user, profile }) {
      const email =
        user.email ||
        (typeof profile?.email === "string" ? profile.email : undefined) ||
        (typeof profile?.preferred_username === "string"
          ? profile.preferred_username
          : undefined);

      const allowed = isAdminEmailAllowed(email);
      if (!allowed) {
        console.warn("[admin-auth] sign-in rejected", {
          reason: "email_not_allowed",
          email: maskAdminEmail(email),
        });
      }

      return allowed;
    },
    async jwt({ token, user }) {
      const email = user?.email || token.email;
      if (user || typeof token.adminSessionStartedAt !== "number") {
        token.adminSessionStartedAt = Date.now();
      }
      token.isSuppvisAdmin = isAdminEmailAllowed(email);
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.isSuppvisAdmin = Boolean(token.isSuppvisAdmin);
        session.user.adminSessionStartedAt =
          typeof token.adminSessionStartedAt === "number"
            ? token.adminSessionStartedAt
            : undefined;
      }
      return session;
    },
  },
});
