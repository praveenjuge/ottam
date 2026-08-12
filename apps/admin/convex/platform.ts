import { query } from "./_generated/server";
import { v } from "convex/values";

export const health = query({
  args: {},
  returns: v.object({
    contractVersion: v.literal(1),
    service: v.literal("ottam-convex"),
    status: v.literal("ok"),
  }),
  handler: () => ({
    contractVersion: 1 as const,
    service: "ottam-convex" as const,
    status: "ok" as const,
  }),
});
