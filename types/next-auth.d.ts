import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user?: DefaultSession["user"] & {
      adminSessionStartedAt?: number;
      isSuppvisAdmin?: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    adminSessionStartedAt?: number;
    isSuppvisAdmin?: boolean;
  }
}
