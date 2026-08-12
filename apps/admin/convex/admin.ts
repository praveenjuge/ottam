import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireAdmin } from "./lib/authorization";

export const viewer = query({
  args: {},
  returns: v.object({
    email: v.string(),
    isAdmin: v.literal(true),
    subject: v.string(),
  }),
  handler: async (ctx) => {
    const identity = await requireAdmin(ctx);
    return {
      email: identity.email ?? "",
      isAdmin: true as const,
      subject: identity.subject,
    };
  },
});
