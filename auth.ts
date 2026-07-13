import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import {
  isAdminEmailAllowed,
  isMicrosoftAuthConfigured,
  maskAdminEmail,
} from "@/app/lib/server/admin-access";

const microsoftAuthConfigured = isMicrosoftAuthConfigured();

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/admin/sign-in",
    error: "/admin/sign-in",
  },
  providers: microsoftAuthConfigured
    ? [
        MicrosoftEntraID({
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
      token.isSuppvisAdmin = isAdminEmailAllowed(email);
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.isSuppvisAdmin = Boolean(token.isSuppvisAdmin);
      }
      return session;
    },
  },
});
