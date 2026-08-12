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
