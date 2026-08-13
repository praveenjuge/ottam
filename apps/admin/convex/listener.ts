import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";
import {
  isDuplicateGuestMerge,
  shouldApplyProgress,
} from "./lib/listenerPolicy";

const progressArgs = {
  clientSequence: v.number(),
  completedAt: v.optional(v.number()),
  episodeId: v.id("episodes"),
  planDurationMinutes: v.number(),
  planHash: v.string(),
  positionMilliseconds: v.number(),
  releaseId: v.id("episodeReleases"),
  sceneIndex: v.number(),
};

const runArgs = {
  activeMilliseconds: v.number(),
  completed: v.boolean(),
  distanceMeters: v.optional(v.number()),
  endedAt: v.number(),
  episodeId: v.id("episodes"),
  idempotencyKey: v.string(),
  movementSamples: v.object({
    running: v.number(),
    stationary: v.number(),
    walking: v.number(),
  }),
  planHash: v.string(),
  releaseId: v.id("episodeReleases"),
  startedAt: v.number(),
  steps: v.optional(v.number()),
};

async function listenerSubject(ctx: MutationCtx): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError({
      code: "UNAUTHENTICATED",
      message: "Sign in to sync listener progress.",
    });
  }
  return identity.tokenIdentifier;
}

function validateProgress(args: {
  clientSequence: number;
  completedAt?: number;
  planDurationMinutes: number;
  planHash: string;
  positionMilliseconds: number;
  sceneIndex: number;
}) {
  if (
    !Number.isSafeInteger(args.clientSequence) ||
    args.clientSequence < 0 ||
    !Number.isSafeInteger(args.planDurationMinutes) ||
    args.planDurationMinutes < 15 ||
    args.planDurationMinutes > 60 ||
    (args.completedAt !== undefined &&
      (!Number.isSafeInteger(args.completedAt) || args.completedAt < 0)) ||
    !/^[a-f0-9]{64}$/.test(args.planHash) ||
    !Number.isSafeInteger(args.positionMilliseconds) ||
    args.positionMilliseconds < 0 ||
    args.positionMilliseconds > args.planDurationMinutes * 60_000 ||
    !Number.isSafeInteger(args.sceneIndex) ||
    args.sceneIndex < 0 ||
    args.sceneIndex > 10_000
  ) {
    throw new ConvexError({
      code: "INVALID_PROGRESS",
      message: "Listener progress is invalid.",
    });
  }
}

function validateRun(args: {
  activeMilliseconds: number;
  endedAt: number;
  idempotencyKey: string;
  movementSamples: { running: number; stationary: number; walking: number };
  planHash: string;
  startedAt: number;
  distanceMeters?: number;
  steps?: number;
}) {
  const samples = Object.values(args.movementSamples);
  if (
    args.idempotencyKey.length < 8 ||
    args.idempotencyKey.length > 128 ||
    args.endedAt < args.startedAt ||
    !Number.isSafeInteger(args.startedAt) ||
    args.startedAt < 0 ||
    !Number.isSafeInteger(args.endedAt) ||
    !Number.isSafeInteger(args.activeMilliseconds) ||
    args.activeMilliseconds < 0 ||
    args.activeMilliseconds > args.endedAt - args.startedAt + 60_000 ||
    samples.some(
      (sample) =>
        !Number.isSafeInteger(sample) || sample < 0 || sample > 10_000_000,
    ) ||
    (args.distanceMeters !== undefined &&
      (!Number.isFinite(args.distanceMeters) ||
        args.distanceMeters < 0 ||
        args.distanceMeters > 1_000_000)) ||
    (args.steps !== undefined &&
      (!Number.isSafeInteger(args.steps) ||
        args.steps < 0 ||
        args.steps > 10_000_000)) ||
    !/^[a-f0-9]{64}$/.test(args.planHash)
  ) {
    throw new ConvexError({
      code: "INVALID_RUN",
      message: "Run session is invalid.",
    });
  }
}

async function upsertProgress(
  ctx: MutationCtx,
  listener: string,
  args: {
    clientSequence: number;
    completedAt?: number;
    episodeId: Id<"episodes">;
    planDurationMinutes: number;
    planHash: string;
    positionMilliseconds: number;
    releaseId: Id<"episodeReleases">;
    sceneIndex: number;
  },
) {
  validateProgress(args);
  const release = await ctx.db.get(args.releaseId);
  if (release?.status !== "published" || release.episodeId !== args.episodeId) {
    throw new ConvexError({
      code: "INVALID_RELEASE",
      message: "Progress must reference a published episode release.",
    });
  }
  const existing = await ctx.db
    .query("episodeProgress")
    .withIndex("by_listener_and_episode", (queryBuilder) =>
      queryBuilder
        .eq("listenerSubject", listener)
        .eq("episodeId", args.episodeId),
    )
    .unique();
  if (!shouldApplyProgress(existing?.clientSequence, args.clientSequence)) {
    return false;
  }
  const value = {
    ...args,
    listenerSubject: listener,
    updatedAt: Date.now(),
  };
  if (existing) await ctx.db.replace(existing._id, value);
  else await ctx.db.insert("episodeProgress", value);
  return true;
}

export const saveProgress = mutation({
  args: progressArgs,
  returns: v.boolean(),
  handler: async (ctx, args) =>
    upsertProgress(ctx, await listenerSubject(ctx), args),
});

export const recordRun = mutation({
  args: runArgs,
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const subject = await listenerSubject(ctx);
    validateRun(args);
    const existing = await ctx.db
      .query("runSessions")
      .withIndex("by_listener_and_idempotency", (queryBuilder) =>
        queryBuilder
          .eq("listenerSubject", subject)
          .eq("idempotencyKey", args.idempotencyKey),
      )
      .unique();
    if (existing) return false;
    const release = await ctx.db.get(args.releaseId);
    if (
      release?.status !== "published" ||
      release.episodeId !== args.episodeId
    ) {
      throw new ConvexError({
        code: "INVALID_RELEASE",
        message: "Run must reference a published release.",
      });
    }
    await ctx.db.insert("runSessions", {
      ...args,
      listenerSubject: subject,
    });
    return true;
  },
});

export const mergeGuestState = mutation({
  args: {
    idempotencyKey: v.string(),
    preferredGenres: v.array(v.string()),
    progress: v.array(v.object(progressArgs)),
    runs: v.array(v.object(runArgs)),
  },
  returns: v.object({ mergedProgress: v.number(), mergedRuns: v.number() }),
  handler: async (ctx, args) => {
    const subject = await listenerSubject(ctx);
    if (
      args.idempotencyKey.length < 8 ||
      args.idempotencyKey.length > 128 ||
      args.progress.length > 100 ||
      args.runs.length > 100 ||
      args.preferredGenres.length > 20
    ) {
      throw new ConvexError({
        code: "INVALID_MERGE",
        message: "Guest merge payload is invalid.",
      });
    }
    const profile = await ctx.db
      .query("listenerProfiles")
      .withIndex("by_clerk_subject", (queryBuilder) =>
        queryBuilder.eq("clerkSubject", subject),
      )
      .unique();
    if (
      isDuplicateGuestMerge(
        profile?.guestMergeIdempotencyKey,
        args.idempotencyKey,
      )
    ) {
      return { mergedProgress: 0, mergedRuns: 0 };
    }
    let mergedProgress = 0;
    for (const progress of args.progress) {
      if (await upsertProgress(ctx, subject, progress)) mergedProgress += 1;
    }
    let mergedRuns = 0;
    for (const run of args.runs) {
      validateRun(run);
      const release = await ctx.db.get(run.releaseId);
      if (
        release?.status !== "published" ||
        release.episodeId !== run.episodeId
      ) {
        throw new ConvexError({
          code: "INVALID_RELEASE",
          message: "Guest run must reference a published release.",
        });
      }
      const existing = await ctx.db
        .query("runSessions")
        .withIndex("by_listener_and_idempotency", (queryBuilder) =>
          queryBuilder
            .eq("listenerSubject", subject)
            .eq("idempotencyKey", run.idempotencyKey),
        )
        .unique();
      if (!existing) {
        await ctx.db.insert("runSessions", {
          ...run,
          listenerSubject: subject,
        });
        mergedRuns += 1;
      }
    }
    const now = Date.now();
    if (profile) {
      await ctx.db.patch(profile._id, {
        guestMergeIdempotencyKey: args.idempotencyKey,
        ...(args.preferredGenres.length === 0
          ? {}
          : { preferredGenres: args.preferredGenres }),
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("listenerProfiles", {
        clerkSubject: subject,
        createdAt: now,
        guestMergeIdempotencyKey: args.idempotencyKey,
        preferredGenres: args.preferredGenres,
        updatedAt: now,
      });
    }
    return { mergedProgress, mergedRuns };
  },
});

export const myState = query({
  args: {},
  returns: v.object({
    progress: v.array(
      v.object({
        clientSequence: v.number(),
        completedAt: v.optional(v.number()),
        episodeId: v.id("episodes"),
        planDurationMinutes: v.number(),
        planHash: v.string(),
        positionMilliseconds: v.number(),
        releaseId: v.id("episodeReleases"),
        sceneIndex: v.number(),
      }),
    ),
    runs: v.array(
      v.object({
        activeMilliseconds: v.number(),
        completed: v.boolean(),
        distanceMeters: v.optional(v.number()),
        endedAt: v.number(),
        episodeId: v.id("episodes"),
        idempotencyKey: v.string(),
        planHash: v.string(),
        releaseId: v.id("episodeReleases"),
        startedAt: v.number(),
        steps: v.optional(v.number()),
      }),
    ),
  }),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "Sign in to read listener progress.",
      });
    }
    const [progress, runs] = await Promise.all([
      ctx.db
        .query("episodeProgress")
        .withIndex("by_listener_and_updated", (queryBuilder) =>
          queryBuilder.eq("listenerSubject", identity.tokenIdentifier),
        )
        .collect(),
      ctx.db
        .query("runSessions")
        .withIndex("by_listener_and_started", (queryBuilder) =>
          queryBuilder.eq("listenerSubject", identity.tokenIdentifier),
        )
        .order("desc")
        .take(100),
    ]);
    return {
      progress: progress.map((item) => ({
        clientSequence: item.clientSequence,
        ...(item.completedAt === undefined
          ? {}
          : { completedAt: item.completedAt }),
        episodeId: item.episodeId,
        planDurationMinutes: item.planDurationMinutes,
        planHash: item.planHash,
        positionMilliseconds: item.positionMilliseconds,
        releaseId: item.releaseId,
        sceneIndex: item.sceneIndex,
      })),
      runs: runs.map((run) => ({
        activeMilliseconds: run.activeMilliseconds,
        completed: run.completed,
        ...(run.distanceMeters === undefined
          ? {}
          : { distanceMeters: run.distanceMeters }),
        endedAt: run.endedAt,
        episodeId: run.episodeId,
        idempotencyKey: run.idempotencyKey,
        planHash: run.planHash,
        releaseId: run.releaseId,
        startedAt: run.startedAt,
        ...(run.steps === undefined ? {} : { steps: run.steps }),
      })),
    };
  },
});
