import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { ConvexError, v } from "convex/values";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action } from "./_generated/server";
import { requireAdmin } from "./lib/authorization";
import { stableJson } from "./lib/studioPolicy";
import {
  estimatedCredits,
  generationRequestSchema,
} from "../lib/media/generation-contract";
import { assignmentRequestSchema } from "../lib/media/audio-assignment";

export const proposeAudioAssignment = action({
  args: {
    agentRunId: v.id("agentRuns"),
    episodeId: v.id("episodes"),
    requestJson: v.string(),
  },
  returns: v.object({
    assignmentHash: v.string(),
    toolInvocationId: v.id("toolInvocations"),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    assignmentHash: string;
    toolInvocationId: Id<"toolInvocations">;
  }> => {
    const identity = await requireAdmin(ctx);
    const request = assignmentRequestSchema.parse(
      JSON.parse(args.requestJson) as unknown,
    );
    const workspace = await ctx.runQuery(api.studio.workspace, {
      episodeId: args.episodeId,
    });
    if (!workspace.episode.currentRevisionId) {
      throw new ConvexError({
        code: "NO_REVISION",
        message: "Episode has no current revision.",
      });
    }
    const candidate = workspace.audioAssets.find(
      (asset) => asset._id === request.assetId,
    );
    const variant = request.variant === "default" ? undefined : request.variant;
    const current = workspace.audioAssets.find(
      (asset) =>
        asset.sceneId === request.sceneId &&
        asset.status === "approved" &&
        asset.variant === variant,
    );
    if (candidate?.status !== "candidate") {
      throw new ConvexError({
        code: "INVALID_CANDIDATE",
        message: "Audio candidate is unavailable.",
      });
    }
    const assignment = {
      ...request,
      baseRevisionId: workspace.episode.currentRevisionId,
      beforeAssetId: current?._id ?? null,
      episodeId: args.episodeId,
    };
    const assignmentHash = hash(assignment);
    return ctx.runMutation(internal.mediaInternal.proposeAudioAssignment, {
      actorSubject: identity.subject,
      agentRunId: args.agentRunId,
      assignmentHash,
      assignmentJson: stableJson(assignment),
    });
  },
});

function hash(value: unknown): string {
  return bytesToHex(sha256(new TextEncoder().encode(stableJson(value))));
}

export const proposeAudioGeneration = action({
  args: {
    agentRunId: v.id("agentRuns"),
    episodeId: v.id("episodes"),
    requestJson: v.string(),
  },
  returns: v.object({
    estimatedCredits: v.number(),
    requestHash: v.string(),
    toolInvocationId: v.id("toolInvocations"),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    estimatedCredits: number;
    requestHash: string;
    toolInvocationId: Id<"toolInvocations">;
  }> => {
    const identity = await requireAdmin(ctx);
    const request = generationRequestSchema.parse(
      JSON.parse(args.requestJson) as unknown,
    );
    const workspace = await ctx.runQuery(api.studio.workspace, {
      episodeId: args.episodeId,
    });
    const baseRevisionId = workspace.episode.currentRevisionId;
    if (!baseRevisionId) {
      throw new ConvexError({
        code: "NO_REVISION",
        message: "Episode has no current revision.",
      });
    }
    const scene = workspace.scenes.find(
      (candidate) => candidate._id === request.sceneId,
    );
    if (scene?.script !== request.script) {
      throw new ConvexError({
        code: "TRANSCRIPT_MISMATCH",
        message: "Audio must use the exact current scene transcript.",
      });
    }
    const requestHash = hash({
      baseRevisionId,
      episodeId: args.episodeId,
      request,
    });
    const result = await ctx.runMutation(
      internal.mediaInternal.proposeAudioGeneration,
      {
        actorSubject: identity.subject,
        agentRunId: args.agentRunId,
        episodeId: args.episodeId,
        requestHash,
        requestJson: stableJson(request),
        sceneId: request.sceneId as Id<"scenes">,
        voiceId: request.voiceId as Id<"voices">,
      },
    );
    return { ...result, estimatedCredits: estimatedCredits(request) };
  },
});

export const approveAudioGeneration = action({
  args: {
    episodeId: v.id("episodes"),
    requestHash: v.string(),
    toolInvocationId: v.id("toolInvocations"),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const identity = await requireAdmin(ctx);
    return ctx.runMutation(internal.mediaInternal.approveAudioGeneration, {
      ...args,
      actorSubject: identity.subject,
    });
  },
});

export const rejectAudioGeneration = action({
  args: { toolInvocationId: v.id("toolInvocations") },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const identity = await requireAdmin(ctx);
    return ctx.runMutation(internal.mediaInternal.rejectAudioGeneration, {
      ...args,
      actorSubject: identity.subject,
    });
  },
});

export const approveAudioAssignment = action({
  args: {
    assignmentHash: v.string(),
    episodeId: v.id("episodes"),
    toolInvocationId: v.id("toolInvocations"),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const identity = await requireAdmin(ctx);
    return ctx.runMutation(internal.mediaInternal.approveAudioAssignment, {
      ...args,
      actorSubject: identity.subject,
    });
  },
});

export const applyAudioAssignment = action({
  args: {
    assignmentHash: v.string(),
    episodeId: v.id("episodes"),
    toolInvocationId: v.id("toolInvocations"),
  },
  returns: v.id("audioAssets"),
  handler: async (ctx, args): Promise<Id<"audioAssets">> => {
    const identity = await requireAdmin(ctx);
    return ctx.runMutation(internal.mediaInternal.applyAudioAssignment, {
      ...args,
      actorSubject: identity.subject,
    });
  },
});
