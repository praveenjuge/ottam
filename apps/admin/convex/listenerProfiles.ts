import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireIdentity } from "./lib/authorization";

const profile = v.object({
  _creationTime: v.number(),
  _id: v.id("listenerProfiles"),
  clerkSubject: v.string(),
  createdAt: v.number(),
  email: v.optional(v.string()),
  guestMergeIdempotencyKey: v.optional(v.string()),
  preferredGenres: v.array(v.string()),
  updatedAt: v.number(),
});

export const current = query({
  args: {},
  returns: v.union(v.null(), profile),
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    return await ctx.db
      .query("listenerProfiles")
      .withIndex("by_clerk_subject", (index) =>
        index.eq("clerkSubject", identity.subject),
      )
      .unique();
  },
});

export const ensureCurrent = mutation({
  args: { preferredGenres: v.array(v.string()) },
  returns: v.id("listenerProfiles"),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const existing = await ctx.db
      .query("listenerProfiles")
      .withIndex("by_clerk_subject", (index) =>
        index.eq("clerkSubject", identity.subject),
      )
      .unique();
    if (existing) {
      return existing._id;
    }
    const now = Date.now();
    return await ctx.db.insert("listenerProfiles", {
      clerkSubject: identity.subject,
      createdAt: now,
      ...(identity.email === undefined ? {} : { email: identity.email }),
      preferredGenres: [...new Set(args.preferredGenres)].slice(0, 8),
      updatedAt: now,
    });
  },
});
