import { ConvexError, v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { stableJson } from "./lib/studioPolicy";

const actorArgs = { actorSubject: v.string() };

export const reserveRelease = internalMutation({
  args: {
    ...actorArgs,
    episodeId: v.id("episodes"),
    idempotencyKey: v.string(),
    revisionId: v.id("episodeRevisions"),
  },
  returns: v.object({
    releaseId: v.id("episodeReleases"),
    releaseNumber: v.number(),
    status: v.string(),
  }),
  handler: async (ctx, args) => {
    const episode = await ctx.db.get(args.episodeId);
    const revision = await ctx.db.get(args.revisionId);
    if (
      episode?.currentRevisionId !== args.revisionId ||
      revision?.episodeId !== args.episodeId
    ) {
      throw new ConvexError({
        code: "STALE_REVISION",
        message: "Only the current episode revision can be published.",
      });
    }
    const existing = await ctx.db
      .query("episodeReleases")
      .withIndex("by_revision", (queryBuilder) =>
        queryBuilder.eq("revisionId", args.revisionId),
      )
      .unique();
    if (existing) {
      if (existing.status === "failed") {
        await ctx.db.patch(existing._id, {
          idempotencyKey: args.idempotencyKey,
          status: "staging",
          validationReportJson: undefined,
        });
      }
      return {
        releaseId: existing._id,
        releaseNumber: existing.releaseNumber,
        status: existing.status === "failed" ? "staging" : existing.status,
      };
    }
    const latest = await ctx.db
      .query("episodeReleases")
      .withIndex("by_episode_and_number", (queryBuilder) =>
        queryBuilder.eq("episodeId", args.episodeId),
      )
      .order("desc")
      .first();
    const releaseNumber = (latest?.releaseNumber ?? 0) + 1;
    const releaseId = await ctx.db.insert("episodeReleases", {
      createdAt: Date.now(),
      episodeId: args.episodeId,
      idempotencyKey: args.idempotencyKey,
      releaseNumber,
      revisionId: args.revisionId,
      status: "staging",
    });
    return { releaseId, releaseNumber, status: "staging" };
  },
});

export const finalizeRelease = internalMutation({
  args: {
    ...actorArgs,
    manifestChecksumSha256: v.string(),
    manifestKey: v.string(),
    releaseId: v.id("episodeReleases"),
    validationReportJson: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const release = await ctx.db.get(args.releaseId);
    if (!release) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Release reservation not found.",
      });
    }
    if (release.status === "published") return null;
    const episode = await ctx.db.get(release.episodeId);
    if (
      release.status !== "staging" ||
      episode?.currentRevisionId !== release.revisionId
    ) {
      throw new ConvexError({
        code: "STALE_RELEASE",
        message: "Episode changed while the release was staged.",
      });
    }
    const now = Date.now();
    await ctx.db.patch(release._id, {
      manifestChecksumSha256: args.manifestChecksumSha256,
      manifestKey: args.manifestKey,
      publishedAt: now,
      publishedBy: args.actorSubject,
      status: "published",
      validationReportJson: args.validationReportJson,
    });
    await ctx.db.patch(episode._id, {
      publishedReleaseId: release._id,
      status: "published",
      updatedAt: now,
    });
    await ctx.db.insert("auditEvents", {
      actorSubject: args.actorSubject,
      createdAt: now,
      episodeId: episode._id,
      eventType: "episode.published",
      immutablePayloadJson: stableJson({
        manifestChecksumSha256: args.manifestChecksumSha256,
        manifestKey: args.manifestKey,
        releaseNumber: release.releaseNumber,
        revisionId: release.revisionId,
      }),
      targetId: release._id,
    });
    return null;
  },
});

export const failRelease = internalMutation({
  args: {
    error: v.string(),
    releaseId: v.id("episodeReleases"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const release = await ctx.db.get(args.releaseId);
    if (release?.status !== "staging") return null;
    await ctx.db.patch(release._id, {
      status: "failed",
      validationReportJson: stableJson({ error: args.error }),
    });
    return null;
  },
});
