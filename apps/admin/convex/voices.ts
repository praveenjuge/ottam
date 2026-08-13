import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdmin } from "./lib/authorization";
import { voiceDocument } from "./lib/documentValidators";

export const listApproved = query({
  args: {},
  returns: v.array(voiceDocument),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return ctx.db
      .query("voices")
      .withIndex("by_status", (queryBuilder) =>
        queryBuilder.eq("status", "approved"),
      )
      .take(250);
  },
});

export const registerLicensedLibraryVoice = mutation({
  args: {
    displayName: v.string(),
    elevenLabsVoiceId: v.string(),
    licenseReference: v.string(),
    provenance: v.string(),
  },
  returns: v.id("voices"),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    if (
      !/^[A-Za-z0-9_-]{8,128}$/.test(args.elevenLabsVoiceId) ||
      !args.licenseReference.trim() ||
      !args.provenance.trim()
    ) {
      throw new ConvexError({
        code: "INVALID_VOICE",
        message: "A licensed library voice and provenance are required.",
      });
    }
    const existing = await ctx.db
      .query("voices")
      .withIndex("by_provider_id", (queryBuilder) =>
        queryBuilder.eq("elevenLabsVoiceId", args.elevenLabsVoiceId),
      )
      .unique();
    if (existing) return existing._id;
    return ctx.db.insert("voices", {
      displayName: args.displayName.trim(),
      elevenLabsVoiceId: args.elevenLabsVoiceId,
      licenseReference: args.licenseReference.trim(),
      provenance: args.provenance.trim(),
      status: "approved",
      updatedAt: Date.now(),
    });
  },
});
