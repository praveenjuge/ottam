import { ConvexError, v } from "convex/values";
import { query } from "./_generated/server";
import { requireAdmin } from "./lib/authorization";

export const listEpisodes = query({
  args: {},
  returns: v.array(
    v.object({
      episodeId: v.id("episodes"),
      sequence: v.number(),
      seriesTitle: v.string(),
      status: v.string(),
      title: v.string(),
    }),
  ),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const episodes = await ctx.db.query("episodes").collect();
    const rows = await Promise.all(
      episodes.map(async (episode) => {
        const series = await ctx.db.get(episode.seriesId);
        return {
          episodeId: episode._id,
          sequence: episode.sequence,
          seriesTitle: series?.title ?? "Unknown series",
          status: episode.status,
          title: episode.title,
        };
      }),
    );
    return rows.sort((left, right) =>
      left.seriesTitle === right.seriesTitle
        ? left.sequence - right.sequence
        : left.seriesTitle.localeCompare(right.seriesTitle),
    );
  },
});

export const workspace = query({
  args: { episodeId: v.id("episodes") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const episode = await ctx.db.get(args.episodeId);
    if (!episode) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Episode not found.",
      });
    }
    const [
      series,
      scenes,
      audioAssets,
      voices,
      chat,
      revisions,
      changeSets,
      toolInvocations,
    ] = await Promise.all([
      ctx.db.get(episode.seriesId),
      ctx.db
        .query("scenes")
        .withIndex("by_episode_and_order", (queryBuilder) =>
          queryBuilder.eq("episodeId", args.episodeId),
        )
        .collect(),
      ctx.db
        .query("audioAssets")
        .withIndex("by_episode_and_status", (queryBuilder) =>
          queryBuilder.eq("episodeId", args.episodeId),
        )
        .collect(),
      ctx.db.query("voices").collect(),
      ctx.db
        .query("productionChats")
        .withIndex("by_episode", (queryBuilder) =>
          queryBuilder.eq("episodeId", args.episodeId),
        )
        .unique(),
      ctx.db
        .query("episodeRevisions")
        .withIndex("by_episode_and_number", (queryBuilder) =>
          queryBuilder.eq("episodeId", args.episodeId),
        )
        .order("desc")
        .take(20),
      ctx.db
        .query("changeSets")
        .withIndex("by_episode_and_created", (queryBuilder) =>
          queryBuilder.eq("episodeId", args.episodeId),
        )
        .order("desc")
        .take(30),
      ctx.db
        .query("toolInvocations")
        .withIndex("by_episode_and_started", (queryBuilder) =>
          queryBuilder.eq("episodeId", args.episodeId),
        )
        .order("desc")
        .take(30),
    ]);
    const messages = chat
      ? await ctx.db
          .query("chatMessages")
          .withIndex("by_chat_and_sequence", (queryBuilder) =>
            queryBuilder.eq("chatId", chat._id),
          )
          .collect()
      : [];
    return {
      audioAssets,
      changeSets,
      chat,
      episode,
      messages,
      revisions,
      scenes,
      series,
      toolInvocations,
      voices: voices.filter((voice) => voice.status === "approved"),
    };
  },
});

export const storyContext = query({
  args: { episodeId: v.id("episodes") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const currentEpisode = await ctx.db.get(args.episodeId);
    if (!currentEpisode) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Episode not found.",
      });
    }
    const series = await ctx.db.get(currentEpisode.seriesId);
    if (!series) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Series not found.",
      });
    }
    const episodes = await ctx.db
      .query("episodes")
      .withIndex("by_series_and_sequence", (queryBuilder) =>
        queryBuilder.eq("seriesId", series._id),
      )
      .collect();
    const episodeContexts = await Promise.all(
      episodes.map(async (episode) => {
        const scenes = await ctx.db
          .query("scenes")
          .withIndex("by_episode_and_order", (queryBuilder) =>
            queryBuilder.eq("episodeId", episode._id),
          )
          .collect();
        const revision = episode.currentRevisionId
          ? await ctx.db.get(episode.currentRevisionId)
          : null;
        return {
          isWritableEpisode: episode._id === currentEpisode._id,
          sequence: episode.sequence,
          slug: episode.slug,
          ...(revision ? { snapshotHash: revision.snapshotHash } : {}),
          synopsis: episode.synopsis,
          title: episode.title,
          transcripts: scenes.map((scene) => ({
            kind: scene.kind,
            script: scene.script,
            sortOrder: scene.sortOrder,
            stableKey: scene.stableKey,
            title: scene.title,
          })),
        };
      }),
    );
    return {
      currentEpisodeId: currentEpisode._id,
      episodes: episodeContexts,
      series: {
        description: series.description,
        genre: series.genre,
        slug: series.slug,
        title: series.title,
      },
    };
  },
});
