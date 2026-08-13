import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action } from "./_generated/server";
import { requireAdmin } from "./lib/authorization";
import { parseStoredProposal, stableJson } from "./lib/studioPolicy";

const opaqueIdPattern = /^[A-Za-z0-9_-]{8,128}$/;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function assertOpaqueId(value: string, label: string): void {
  if (!opaqueIdPattern.test(value)) {
    throw new ConvexError({
      code: "INVALID_ARGUMENT",
      message: `${label} is invalid.`,
    });
  }
}

function hash(value: unknown): string {
  return bytesToHex(sha256(new TextEncoder().encode(stableJson(value))));
}

export const createDraftEpisode = action({
  args: {
    idempotencyKey: v.string(),
    sequence: v.optional(v.number()),
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
  handler: async (
    ctx,
    args,
  ): Promise<{
    chatId: Id<"productionChats">;
    episodeId: Id<"episodes">;
    revisionId: Id<"episodeRevisions">;
  }> => {
    const identity = await requireAdmin(ctx);
    assertOpaqueId(args.idempotencyKey, "Idempotency key");
    if (
      !slugPattern.test(args.slug) ||
      args.title.trim().length > 120 ||
      args.synopsis.trim().length > 2_000
    ) {
      throw new ConvexError({
        code: "INVALID_ARGUMENT",
        message: "Episode fields are invalid.",
      });
    }
    return ctx.runMutation(internal.studioInternal.createDraftEpisode, {
      ...args,
      actorSubject: identity.tokenIdentifier,
    });
  },
});

export const ensureChat = action({
  args: { episodeId: v.id("episodes") },
  returns: v.id("productionChats"),
  handler: async (ctx, args): Promise<Id<"productionChats">> => {
    const identity = await requireAdmin(ctx);
    return ctx.runMutation(internal.studioInternal.ensureChat, {
      ...args,
      actorSubject: identity.tokenIdentifier,
    });
  },
});

export const saveMessage = action({
  args: {
    chatId: v.id("productionChats"),
    contentJson: v.string(),
    messageId: v.string(),
    role: v.union(v.literal("user"), v.literal("assistant"), v.literal("tool")),
  },
  returns: v.id("chatMessages"),
  handler: async (ctx, args): Promise<Id<"chatMessages">> => {
    const identity = await requireAdmin(ctx);
    assertOpaqueId(args.messageId, "Message ID");
    if (args.contentJson.length > 1_000_000) {
      throw new ConvexError({
        code: "INVALID_ARGUMENT",
        message: "Message is too large.",
      });
    }
    JSON.parse(args.contentJson) as unknown;
    return ctx.runMutation(internal.studioInternal.saveMessage, {
      ...args,
      actorSubject: identity.tokenIdentifier,
    });
  },
});

export const beginAgentRun = action({
  args: {
    baseRevisionId: v.optional(v.id("episodeRevisions")),
    chatId: v.id("productionChats"),
    model: v.string(),
    runId: v.string(),
  },
  returns: v.id("agentRuns"),
  handler: async (ctx, args): Promise<Id<"agentRuns">> => {
    const identity = await requireAdmin(ctx);
    assertOpaqueId(args.runId, "Run ID");
    if (args.model.length > 120) {
      throw new ConvexError({
        code: "INVALID_ARGUMENT",
        message: "Model identifier is invalid.",
      });
    }
    return ctx.runMutation(internal.studioInternal.beginAgentRun, {
      ...args,
      actorSubject: identity.tokenIdentifier,
    });
  },
});

export const finishAgentRun = action({
  args: {
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
  handler: async (ctx, args): Promise<null> => {
    const identity = await requireAdmin(ctx);
    assertOpaqueId(args.runId, "Run ID");
    return ctx.runMutation(internal.studioInternal.finishAgentRun, {
      ...args,
      actorSubject: identity.tokenIdentifier,
    });
  },
});

export const proposeChangeSet = action({
  args: {
    baseRevisionId: v.id("episodeRevisions"),
    episodeId: v.id("episodes"),
    proposalJson: v.string(),
  },
  returns: v.object({
    changeSetId: v.id("changeSets"),
    proposalHash: v.string(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    changeSetId: Id<"changeSets">;
    proposalHash: string;
  }> => {
    const identity = await requireAdmin(ctx);
    const proposal = parseStoredProposal(args.proposalJson);
    const proposalHash = hash({
      baseRevisionId: args.baseRevisionId,
      episodeId: args.episodeId,
      proposal,
    });
    const changeSetId = await ctx.runMutation(
      internal.studioInternal.proposeChangeSet,
      {
        ...args,
        actorSubject: identity.tokenIdentifier,
        proposalHash,
      },
    );
    return { changeSetId, proposalHash };
  },
});

export const applyChangeSet = action({
  args: {
    changeSetId: v.id("changeSets"),
    expectedEpisodeId: v.id("episodes"),
    expectedProposalHash: v.string(),
  },
  returns: v.id("episodeRevisions"),
  handler: async (ctx, args): Promise<Id<"episodeRevisions">> => {
    const identity = await requireAdmin(ctx);
    return ctx.runMutation(internal.studioInternal.applyChangeSet, {
      ...args,
      actorSubject: identity.tokenIdentifier,
    });
  },
});

export const approveChangeSet = action({
  args: {
    changeSetId: v.id("changeSets"),
    expectedEpisodeId: v.id("episodes"),
    expectedProposalHash: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const identity = await requireAdmin(ctx);
    return ctx.runMutation(internal.studioInternal.approveChangeSet, {
      ...args,
      actorSubject: identity.tokenIdentifier,
    });
  },
});

export const rejectChangeSet = action({
  args: { changeSetId: v.id("changeSets") },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const identity = await requireAdmin(ctx);
    return ctx.runMutation(internal.studioInternal.rejectChangeSet, {
      ...args,
      actorSubject: identity.tokenIdentifier,
    });
  },
});
