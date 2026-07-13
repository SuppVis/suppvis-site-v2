import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user?: DefaultSession["user"] & {
      isSuppvisAdmin?: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    isSuppvisAdmin?: boolean;
  }
}
