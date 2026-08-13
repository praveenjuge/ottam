import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdmin } from "./lib/authorization";

const publishedSeries = v.object({
  description: v.string(),
  genre: v.string(),
  id: v.id("series"),
  slug: v.string(),
  title: v.string(),
});

export const listPublished = query({
  args: {},
  returns: v.array(publishedSeries),
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("series")
      .withIndex("by_status", (index) => index.eq("status", "published"))
      .take(200);
    return rows.map((row) => ({
      description: row.description,
      genre: row.genre,
      id: row._id,
      slug: row.slug,
      title: row.title,
    }));
  },
});

export const listAdmin = query({
  args: {},
  returns: v.array(
    v.object({
      description: v.string(),
      genre: v.string(),
      id: v.id("series"),
      slug: v.string(),
      status: v.string(),
      title: v.string(),
    }),
  ),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query("series").take(200);
    return rows
      .map((row) => ({
        description: row.description,
        genre: row.genre,
        id: row._id,
        slug: row.slug,
        status: row.status,
        title: row.title,
      }))
      .sort((left, right) => left.title.localeCompare(right.title));
  },
});

export const createDraft = mutation({
  args: {
    description: v.string(),
    genre: v.string(),
    slug: v.string(),
    title: v.string(),
  },
  returns: v.id("series"),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const slug = args.slug.trim().toLocaleLowerCase("en-US");
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      throw new ConvexError({
        code: "INVALID_SLUG",
        message: "Use a lowercase URL slug.",
      });
    }
    const existing = await ctx.db
      .query("series")
      .withIndex("by_slug", (index) => index.eq("slug", slug))
      .unique();
    if (existing) {
      return existing._id;
    }
    const now = Date.now();
    return await ctx.db.insert("series", {
      createdAt: now,
      description: args.description.trim(),
      genre: args.genre.trim(),
      slug,
      status: "draft",
      title: args.title.trim(),
      updatedAt: now,
    });
  },
});
