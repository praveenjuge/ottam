import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { canStartAgentRun } from "./lib/agentRunPolicy";
import {
  parseStoredProposal,
  stableJson,
  type ChangeSetProposal,
} from "./lib/studioPolicy";

const actorArgs = { actorSubject: v.string() };

function contentHash(value: unknown): string {
  return bytesToHex(sha256(new TextEncoder().encode(stableJson(value))));
}

function editableEpisode(episode: Doc<"episodes">) {
  return { synopsis: episode.synopsis, title: episode.title };
}

function editableScene(scene: Doc<"scenes">) {
  return {
    durationSeconds: scene.durationSeconds,
    ...(scene.earliestSecond === undefined
      ? {}
      : { earliestSecond: scene.earliestSecond }),
    kind: scene.kind,
    ...(scene.latestSecond === undefined
      ? {}
      : { latestSecond: scene.latestSecond }),
    ...(scene.optionalPriority === undefined
      ? {}
      : { optionalPriority: scene.optionalPriority }),
    script: scene.script,
    sortOrder: scene.sortOrder,
    stableKey: scene.stableKey,
    title: scene.title,
  };
}

function storedSceneFields(
  scene: Extract<
    ChangeSetProposal["operations"][number],
    { entity: "scene" }
  >["after"],
) {
  return {
    durationSeconds: scene.durationSeconds,
    ...(scene.earliestSecond === undefined
      ? {}
      : { earliestSecond: scene.earliestSecond }),
    kind: scene.kind,
    ...(scene.latestSecond === undefined
      ? {}
      : { latestSecond: scene.latestSecond }),
    ...(scene.optionalPriority === undefined
      ? {}
      : { optionalPriority: scene.optionalPriority }),
    script: scene.script,
    sortOrder: scene.sortOrder,
    stableKey: scene.stableKey,
    title: scene.title,
  };
}

async function snapshotEpisode(ctx: MutationCtx, episodeId: Id<"episodes">) {
  const episode = await ctx.db.get(episodeId);
  if (!episode) {
    throw new ConvexError({ code: "NOT_FOUND", message: "Episode not found." });
  }
  const scenes = await ctx.db
    .query("scenes")
    .withIndex("by_episode_and_order", (queryBuilder) =>
      queryBuilder.eq("episodeId", episodeId),
    )
    .collect();
  return {
    contractVersion: 1,
    episode: editableEpisode(episode),
    scenes: scenes.map(editableScene),
  };
}

async function audit(
  ctx: MutationCtx,
  args: {
    actorSubject: string;
    episodeId?: Id<"episodes">;
    eventType: string;
    payload: unknown;
    targetId?: string;
  },
) {
  await ctx.db.insert("auditEvents", {
    actorSubject: args.actorSubject,
    createdAt: Date.now(),
    ...(args.episodeId === undefined ? {} : { episodeId: args.episodeId }),
    eventType: args.eventType,
    immutablePayloadJson: stableJson(args.payload),
    ...(args.targetId === undefined ? {} : { targetId: args.targetId }),
  });
}

export const createDraftEpisode = internalMutation({
  args: {
    ...actorArgs,
    idempotencyKey: v.string(),
    sequence: v.number(),
    seriesId: v.id("series"),
    slug: v.string(),
    synopsis: v.string(),
    title: v.string(),
  },
  returns: v.object({
    chatId: v.id("productionChats"),
    episodeId: v.id("episodes"),
    revisionId: v.id("episodeRevisions"),
  }),
  handler: async (ctx, args) => {
    const series = await ctx.db.get(args.seriesId);
    if (!series) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Series not found.",
      });
    }
    const existing = await ctx.db
      .query("episodes")
      .withIndex("by_series_and_slug", (queryBuilder) =>
        queryBuilder.eq("seriesId", args.seriesId).eq("slug", args.slug),
      )
      .unique();
    if (existing) {
      const [revision, chat] = await Promise.all([
        existing.currentRevisionId
          ? ctx.db.get(existing.currentRevisionId)
          : null,
        ctx.db
          .query("productionChats")
          .withIndex("by_episode", (queryBuilder) =>
            queryBuilder.eq("episodeId", existing._id),
          )
          .unique(),
      ]);
      if (revision && chat) {
        return {
          chatId: chat._id,
          episodeId: existing._id,
          revisionId: revision._id,
        };
      }
      throw new ConvexError({
        code: "INCONSISTENT_STATE",
        message: "The existing episode is missing its initial studio records.",
      });
    }
    const now = Date.now();
    const episodeId = await ctx.db.insert("episodes", {
      createdAt: now,
      sequence: args.sequence,
      seriesId: args.seriesId,
      slug: args.slug,
      status: "draft",
      synopsis: args.synopsis,
      title: args.title,
      updatedAt: now,
    });
    const snapshot = await snapshotEpisode(ctx, episodeId);
    const revisionId = await ctx.db.insert("episodeRevisions", {
      createdAt: now,
      createdBy: args.actorSubject,
      episodeId,
      revisionNumber: 1,
      snapshotHash: contentHash(snapshot),
      snapshotJson: stableJson(snapshot),
    });
    await ctx.db.patch(episodeId, { currentRevisionId: revisionId });
    const chatId = await ctx.db.insert("productionChats", {
      createdAt: now,
      episodeId,
      updatedAt: now,
    });
    await audit(ctx, {
      actorSubject: args.actorSubject,
      episodeId,
      eventType: "episode.created",
      payload: { idempotencyKey: args.idempotencyKey, revisionId },
      targetId: episodeId,
    });
    return { chatId, episodeId, revisionId };
  },
});

export const ensureChat = internalMutation({
  args: { ...actorArgs, episodeId: v.id("episodes") },
  returns: v.id("productionChats"),
  handler: async (ctx, args) => {
    const episode = await ctx.db.get(args.episodeId);
    if (!episode) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Episode not found.",
      });
    }
    const existing = await ctx.db
      .query("productionChats")
      .withIndex("by_episode", (queryBuilder) =>
        queryBuilder.eq("episodeId", args.episodeId),
      )
      .unique();
    if (existing) return existing._id;
    return ctx.db.insert("productionChats", {
      createdAt: Date.now(),
      episodeId: args.episodeId,
      updatedAt: Date.now(),
    });
  },
});

export const saveMessage = internalMutation({
  args: {
    ...actorArgs,
    chatId: v.id("productionChats"),
    contentJson: v.string(),
    messageId: v.string(),
    role: v.union(v.literal("user"), v.literal("assistant"), v.literal("tool")),
  },
  returns: v.id("chatMessages"),
  handler: async (ctx, args) => {
    const chat = await ctx.db.get(args.chatId);
    if (!chat) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Chat not found." });
    }
    const existing = await ctx.db
      .query("chatMessages")
      .withIndex("by_chat_and_message", (queryBuilder) =>
        queryBuilder.eq("chatId", args.chatId).eq("messageId", args.messageId),
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { contentJson: args.contentJson });
      return existing._id;
    }
    const latest = await ctx.db
      .query("chatMessages")
      .withIndex("by_chat_and_sequence", (queryBuilder) =>
        queryBuilder.eq("chatId", args.chatId),
      )
      .order("desc")
      .first();
    const messageId = await ctx.db.insert("chatMessages", {
      chatId: args.chatId,
      contentJson: args.contentJson,
      createdAt: Date.now(),
      messageId: args.messageId,
      role: args.role,
      sequence: (latest?.sequence ?? 0) + 1,
    });
    await ctx.db.patch(args.chatId, { updatedAt: Date.now() });
    return messageId;
  },
});

export const beginAgentRun = internalMutation({
  args: {
    ...actorArgs,
    baseRevisionId: v.optional(v.id("episodeRevisions")),
    chatId: v.id("productionChats"),
    model: v.string(),
    runId: v.string(),
  },
  returns: v.id("agentRuns"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("agentRuns")
      .withIndex("by_run_id", (queryBuilder) =>
        queryBuilder.eq("runId", args.runId),
      )
      .unique();
    if (existing) return existing._id;
    const chat = await ctx.db.get(args.chatId);
    if (!chat) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Chat not found." });
    }
    const now = Date.now();
    const recentRuns = await ctx.db
      .query("agentRuns")
      .withIndex("by_chat_and_started", (queryBuilder) =>
        queryBuilder.eq("chatId", args.chatId).gte("startedAt", now - 60_000),
      )
      .take(6);
    if (
      !canStartAgentRun(
        recentRuns.map((run) => run.startedAt),
        now,
      )
    ) {
      throw new ConvexError({
        code: "RATE_LIMITED",
        message: "Wait before starting another production chat turn.",
      });
    }
    return ctx.db.insert("agentRuns", {
      ...(args.baseRevisionId === undefined
        ? {}
        : { baseRevisionId: args.baseRevisionId }),
      chatId: args.chatId,
      episodeId: chat.episodeId,
      model: args.model,
      runId: args.runId,
      startedAt: now,
      status: "running",
    });
  },
});

export const finishAgentRun = internalMutation({
  args: {
    ...actorArgs,
    outputTokens: v.optional(v.number()),
    promptTokens: v.optional(v.number()),
    runId: v.string(),
    status: v.union(
      v.literal("completed"),
      v.literal("failed"),
      v.literal("cancelled"),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await ctx.db
      .query("agentRuns")
      .withIndex("by_run_id", (queryBuilder) =>
        queryBuilder.eq("runId", args.runId),
      )
      .unique();
    if (run?.status !== "running") return null;
    await ctx.db.patch(run._id, {
      completedAt: Date.now(),
      ...(args.outputTokens === undefined
        ? {}
        : { outputTokens: args.outputTokens }),
      ...(args.promptTokens === undefined
        ? {}
        : { promptTokens: args.promptTokens }),
      status: args.status,
    });
    return null;
  },
});

function proposalBeforeMatches(
  proposal: ChangeSetProposal,
  episode: Doc<"episodes">,
  scenesByKey: Map<string, Doc<"scenes">>,
): boolean {
  return proposal.operations.every((operation) => {
    if (operation.entity === "episode") {
      return (
        stableJson(operation.before) === stableJson(editableEpisode(episode))
      );
    }
    const current = scenesByKey.get(operation.after.stableKey);
    return operation.before === null
      ? current === undefined
      : current !== undefined &&
          stableJson(operation.before) === stableJson(editableScene(current));
  });
}

export const proposeChangeSet = internalMutation({
  args: {
    ...actorArgs,
    baseRevisionId: v.id("episodeRevisions"),
    episodeId: v.id("episodes"),
    proposalHash: v.string(),
    proposalJson: v.string(),
  },
  returns: v.id("changeSets"),
  handler: async (ctx, args) => {
    parseStoredProposal(args.proposalJson);
    const episode = await ctx.db.get(args.episodeId);
    if (!episode) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Episode not found.",
      });
    }
    if (episode.currentRevisionId !== args.baseRevisionId) {
      throw new ConvexError({
        code: "STALE_REVISION",
        message: "Refresh before proposing changes.",
      });
    }
    const expectedHash = contentHash({
      baseRevisionId: args.baseRevisionId,
      episodeId: args.episodeId,
      proposal: parseStoredProposal(args.proposalJson),
    });
    if (expectedHash !== args.proposalHash) {
      throw new ConvexError({
        code: "INVALID_HASH",
        message: "Proposal hash does not match its content.",
      });
    }
    const existing = await ctx.db
      .query("changeSets")
      .withIndex("by_proposal_hash", (queryBuilder) =>
        queryBuilder.eq("proposalHash", args.proposalHash),
      )
      .unique();
    if (existing) return existing._id;
    const changeSetId = await ctx.db.insert("changeSets", {
      baseRevisionId: args.baseRevisionId,
      changeJson: args.proposalJson,
      createdAt: Date.now(),
      episodeId: args.episodeId,
      proposalHash: args.proposalHash,
      proposedBy: args.actorSubject,
      status: "proposed",
    });
    await audit(ctx, {
      actorSubject: args.actorSubject,
      episodeId: args.episodeId,
      eventType: "change_set.proposed",
      payload: {
        baseRevisionId: args.baseRevisionId,
        proposalHash: args.proposalHash,
      },
      targetId: changeSetId,
    });
    return changeSetId;
  },
});

export const applyChangeSet = internalMutation({
  args: {
    ...actorArgs,
    changeSetId: v.id("changeSets"),
    expectedEpisodeId: v.id("episodes"),
    expectedProposalHash: v.string(),
  },
  returns: v.id("episodeRevisions"),
  handler: async (ctx, args) => {
    const changeSet = await ctx.db.get(args.changeSetId);
    if (!changeSet) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Change set not found.",
      });
    }
    if (changeSet.episodeId !== args.expectedEpisodeId) {
      throw new ConvexError({
        code: "CROSS_EPISODE_DENIED",
        message: "A production run cannot cross episode boundaries.",
      });
    }
    if (changeSet.status === "applied" && changeSet.appliedRevisionId) {
      return changeSet.appliedRevisionId;
    }
    if (
      changeSet.status !== "approved" ||
      changeSet.proposalHash !== args.expectedProposalHash
    ) {
      throw new ConvexError({
        code: "INVALID_STATE",
        message: "This proposal cannot be applied.",
      });
    }
    const episode = await ctx.db.get(changeSet.episodeId);
    if (!episode) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Episode not found.",
      });
    }
    if (episode.currentRevisionId !== changeSet.baseRevisionId) {
      await ctx.db.patch(changeSet._id, { status: "stale" });
      throw new ConvexError({
        code: "STALE_REVISION",
        message: "The episode changed after this proposal.",
      });
    }
    const proposal = parseStoredProposal(changeSet.changeJson);
    const scenes = await ctx.db
      .query("scenes")
      .withIndex("by_episode_and_order", (queryBuilder) =>
        queryBuilder.eq("episodeId", changeSet.episodeId),
      )
      .collect();
    const scenesByKey = new Map(
      scenes.map((scene) => [scene.stableKey, scene]),
    );
    if (!proposalBeforeMatches(proposal, episode, scenesByKey)) {
      await ctx.db.patch(changeSet._id, { status: "stale" });
      throw new ConvexError({
        code: "STALE_CONTENT",
        message: "Proposal before-values no longer match.",
      });
    }
    const now = Date.now();
    for (const operation of proposal.operations) {
      if (operation.entity === "episode") {
        await ctx.db.patch(episode._id, { ...operation.after, updatedAt: now });
        continue;
      }
      const current = scenesByKey.get(operation.after.stableKey);
      const storedFields = storedSceneFields(operation.after);
      if (current) {
        await ctx.db.patch(current._id, { ...storedFields, updatedAt: now });
      } else {
        await ctx.db.insert("scenes", {
          ...storedFields,
          episodeId: episode._id,
          updatedAt: now,
        });
      }
    }
    const baseRevision = await ctx.db.get(changeSet.baseRevisionId);
    if (!baseRevision) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Base revision not found.",
      });
    }
    const snapshot = await snapshotEpisode(ctx, episode._id);
    const revisionId = await ctx.db.insert("episodeRevisions", {
      createdAt: now,
      createdBy: args.actorSubject,
      episodeId: episode._id,
      parentRevisionId: baseRevision._id,
      revisionNumber: baseRevision.revisionNumber + 1,
      snapshotHash: contentHash(snapshot),
      snapshotJson: stableJson(snapshot),
      sourceChangeSetId: changeSet._id,
    });
    await ctx.db.patch(episode._id, {
      currentRevisionId: revisionId,
      updatedAt: now,
    });
    await ctx.db.patch(changeSet._id, {
      appliedRevisionId: revisionId,
      reviewedAt: now,
      reviewedBy: args.actorSubject,
      status: "applied",
    });
    await audit(ctx, {
      actorSubject: args.actorSubject,
      episodeId: episode._id,
      eventType: "change_set.applied",
      payload: { proposalHash: changeSet.proposalHash, revisionId },
      targetId: changeSet._id,
    });
    return revisionId;
  },
});

export const approveChangeSet = internalMutation({
  args: {
    ...actorArgs,
    changeSetId: v.id("changeSets"),
    expectedEpisodeId: v.id("episodes"),
    expectedProposalHash: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const changeSet = await ctx.db.get(args.changeSetId);
    if (!changeSet) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Change set not found.",
      });
    }
    if (
      changeSet.episodeId !== args.expectedEpisodeId ||
      changeSet.proposalHash !== args.expectedProposalHash
    ) {
      throw new ConvexError({
        code: "APPROVAL_MISMATCH",
        message: "Approval does not match this episode proposal.",
      });
    }
    if (changeSet.status === "approved" || changeSet.status === "applied") {
      return null;
    }
    if (changeSet.status !== "proposed") {
      throw new ConvexError({
        code: "INVALID_STATE",
        message: "Only a current proposal can be approved.",
      });
    }
    const episode = await ctx.db.get(changeSet.episodeId);
    if (episode?.currentRevisionId !== changeSet.baseRevisionId) {
      await ctx.db.patch(changeSet._id, { status: "stale" });
      throw new ConvexError({
        code: "STALE_REVISION",
        message: "The episode changed before approval.",
      });
    }
    const now = Date.now();
    await ctx.db.patch(changeSet._id, {
      reviewedAt: now,
      reviewedBy: args.actorSubject,
      status: "approved",
    });
    await audit(ctx, {
      actorSubject: args.actorSubject,
      episodeId: changeSet.episodeId,
      eventType: "change_set.approved",
      payload: { proposalHash: changeSet.proposalHash },
      targetId: changeSet._id,
    });
    return null;
  },
});

export const rejectChangeSet = internalMutation({
  args: { ...actorArgs, changeSetId: v.id("changeSets") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const changeSet = await ctx.db.get(args.changeSetId);
    if (!changeSet) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Change set not found.",
      });
    }
    if (changeSet.status === "rejected") return null;
    if (changeSet.status !== "proposed") {
      throw new ConvexError({
        code: "INVALID_STATE",
        message: "Only proposed changes can be rejected.",
      });
    }
    await ctx.db.patch(changeSet._id, {
      reviewedAt: Date.now(),
      reviewedBy: args.actorSubject,
      status: "rejected",
    });
    await audit(ctx, {
      actorSubject: args.actorSubject,
      episodeId: changeSet.episodeId,
      eventType: "change_set.rejected",
      payload: { proposalHash: changeSet.proposalHash },
      targetId: changeSet._id,
    });
    return null;
  },
});
