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

export function isAdminIdentity(
  identity: { email?: string; subject: string },
  configuredUserId: string,
  configuredEmail?: string,
): boolean {
  if (identity.subject !== configuredUserId) return false;
  return (
    configuredEmail === undefined ||
    identity.email === undefined ||
    isAdminEmail(identity.email, configuredEmail)
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
  const configuredUserId = process.env.OTTAM_ADMIN_CLERK_USER_ID;
  if (!configuredUserId) {
    throw new ConvexError({
      code: "MISCONFIGURED",
      message: "Admin access is not configured.",
    });
  }
  if (
    !isAdminIdentity(
      identity,
      configuredUserId,
      process.env.OTTAM_ADMIN_EMAIL,
    )
  ) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "Administrator access is required.",
    });
  }
  return identity;
}
