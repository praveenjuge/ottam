import { ConvexError } from "convex/values";
import type { ActionCtx, MutationCtx, QueryCtx } from "../_generated/server";

type AuthContext = Pick<ActionCtx | MutationCtx | QueryCtx, "auth">;

export function normalizeEmail(email: string): string {
  return email.trim().toLocaleLowerCase("en-US");
}

export function isAdminEmail(
  email: string | undefined,
  configuredAdmin: string,
): boolean {
  return (
    email !== undefined &&
    normalizeEmail(email) === normalizeEmail(configuredAdmin)
  );
}

export async function requireIdentity(ctx: AuthContext) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError({
      code: "UNAUTHENTICATED",
      message: "Sign in is required.",
    });
  }
  return identity;
}

export async function requireAdmin(ctx: AuthContext) {
  const identity = await requireIdentity(ctx);
  const configuredAdmin = process.env.OTTAM_ADMIN_EMAIL;
  if (!configuredAdmin) {
    throw new ConvexError({
      code: "MISCONFIGURED",
      message: "Admin access is not configured.",
    });
  }
  if (!isAdminEmail(identity.email, configuredAdmin)) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "Administrator access is required.",
    });
  }
  return identity;
}
