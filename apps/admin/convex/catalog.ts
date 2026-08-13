import { v } from "convex/values";
import { query } from "./_generated/server";

export const listPublished = query({
  args: {},
  returns: v.array(
    v.object({
      description: v.string(),
      episodes: v.array(
        v.object({
          episodeId: v.id("episodes"),
          releaseId: v.id("episodeReleases"),
          sequence: v.number(),
          slug: v.string(),
          synopsis: v.string(),
          title: v.string(),
        }),
      ),
      genre: v.string(),
      seriesId: v.id("series"),
      slug: v.string(),
      title: v.string(),
    }),
  ),
  handler: async (ctx) => {
    const seriesRows = await ctx.db
      .query("series")
      .withIndex("by_status", (queryBuilder) =>
        queryBuilder.eq("status", "published"),
      )
      .collect();
    return await Promise.all(
      seriesRows.map(async (series) => {
        const episodes = await ctx.db
          .query("episodes")
          .withIndex("by_series_and_sequence", (queryBuilder) =>
            queryBuilder.eq("seriesId", series._id),
          )
          .collect();
        return {
          description: series.description,
          episodes: episodes.flatMap((episode) =>
            episode.status === "published" && episode.publishedReleaseId
              ? [
                  {
                    episodeId: episode._id,
                    releaseId: episode.publishedReleaseId,
                    sequence: episode.sequence,
                    slug: episode.slug,
                    synopsis: episode.synopsis,
                    title: episode.title,
                  },
                ]
              : [],
          ),
          genre: series.genre,
          seriesId: series._id,
          slug: series.slug,
          title: series.title,
        };
      }),
    );
  },
});
