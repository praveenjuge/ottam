"use node";

import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";
import { r2Configuration, signedReleaseReadUrl } from "../lib/media/r2";

interface ReleaseAccessResult {
  assets: { key: string; url: string }[];
  expiresInSeconds: number;
  manifestChecksumSha256: string;
  manifestUrl: string;
}

export const bundle = action({
  args: { releaseId: v.id("episodeReleases") },
  returns: v.object({
    assets: v.array(v.object({ key: v.string(), url: v.string() })),
    expiresInSeconds: v.number(),
    manifestChecksumSha256: v.string(),
    manifestUrl: v.string(),
  }),
  handler: async (ctx, args): Promise<ReleaseAccessResult> => {
    const release = await ctx.runQuery(
      internal.releaseInternal.publishedRelease,
      args,
    );
    if (!release?.manifestKey || !release.manifestChecksumSha256) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Published release not found.",
      });
    }
    const configuration = r2Configuration();
    const expiresInSeconds = 300;
    const [manifestUrl, assets] = await Promise.all([
      signedReleaseReadUrl({
        configuration,
        key: release.manifestKey,
        ttlSeconds: expiresInSeconds,
      }),
      Promise.all(
        release.assetKeys.map(async (key) => ({
          key,
          url: await signedReleaseReadUrl({
            configuration,
            key,
            ttlSeconds: expiresInSeconds,
          }),
        })),
      ),
    ]);
    return {
      assets,
      expiresInSeconds,
      manifestChecksumSha256: release.manifestChecksumSha256,
      manifestUrl,
    };
  },
});
