import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { internalQuery } from "./_generated/server";
import { episodeReleaseDocument } from "./lib/documentValidators";

export const publishedRelease = internalQuery({
  args: { releaseId: v.id("episodeReleases") },
  returns: v.union(v.null(), episodeReleaseDocument),
  handler: async (ctx, args): Promise<Doc<"episodeReleases"> | null> => {
    const release = await ctx.db.get(args.releaseId);
    if (release?.status !== "published" || !release.manifestKey) return null;
    return release;
  },
});
