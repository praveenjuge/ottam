import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  type MutationCtx,
} from "./_generated/server";
import { stableJson } from "./lib/studioPolicy";
import { generationRequestSchema } from "../lib/media/generation-contract";

const actorArgs = { actorSubject: v.string() };

function hash(value: unknown): string {
  return bytesToHex(sha256(new TextEncoder().encode(stableJson(value))));
}

async function writeAudit(
  ctx: MutationCtx,
  args: {
    actorSubject: string;
    episodeId: Id<"episodes">;
    eventType: string;
    payload: unknown;
    targetId: string;
  },
) {
  await ctx.db.insert("auditEvents", {
    actorSubject: args.actorSubject,
    createdAt: Date.now(),
    episodeId: args.episodeId,
    eventType: args.eventType,
    immutablePayloadJson: stableJson(args.payload),
    targetId: args.targetId,
  });
}

export const proposeAudioGeneration = internalMutation({
  args: {
    ...actorArgs,
    agentRunId: v.id("agentRuns"),
    episodeId: v.id("episodes"),
    requestJson: v.string(),
    requestHash: v.string(),
    sceneId: v.id("scenes"),
    voiceId: v.id("voices"),
  },
  returns: v.object({
    requestHash: v.string(),
    toolInvocationId: v.id("toolInvocations"),
  }),
  handler: async (ctx, args) => {
    const [run, episode, scene, voice] = await Promise.all([
      ctx.db.get(args.agentRunId),
      ctx.db.get(args.episodeId),
      ctx.db.get(args.sceneId),
      ctx.db.get(args.voiceId),
    ]);
    if (run?.episodeId !== args.episodeId || !episode?.currentRevisionId) {
      throw new ConvexError({
        code: "INVALID_SCOPE",
        message: "Agent run is outside this episode.",
      });
    }
    if (scene?.episodeId !== args.episodeId || voice?.status !== "approved") {
      throw new ConvexError({
        code: "INVALID_ASSET",
        message: "Scene or licensed voice is unavailable.",
      });
    }
    const expectedHash = hash({
      baseRevisionId: episode.currentRevisionId,
      episodeId: args.episodeId,
      request: JSON.parse(args.requestJson) as unknown,
    });
    if (expectedHash !== args.requestHash) {
      throw new ConvexError({
        code: "INVALID_HASH",
        message: "Audio request hash mismatch.",
      });
    }
    const existing = await ctx.db
      .query("toolInvocations")
      .withIndex("by_idempotency_key", (queryBuilder) =>
        queryBuilder.eq("idempotencyKey", args.requestHash),
      )
      .unique();
    if (existing) {
      return { requestHash: args.requestHash, toolInvocationId: existing._id };
    }
    const toolInvocationId = await ctx.db.insert("toolInvocations", {
      agentRunId: args.agentRunId,
      approvalRequired: true,
      baseRevisionId: episode.currentRevisionId,
      episodeId: args.episodeId,
      idempotencyKey: args.requestHash,
      inputJson: args.requestJson,
      startedAt: Date.now(),
      status: "proposed",
      toolName: "generateAudioCandidates",
    });
    await writeAudit(ctx, {
      actorSubject: args.actorSubject,
      episodeId: args.episodeId,
      eventType: "audio_generation.proposed",
      payload: {
        requestHash: args.requestHash,
        sceneId: args.sceneId,
        voiceId: args.voiceId,
      },
      targetId: toolInvocationId,
    });
    return { requestHash: args.requestHash, toolInvocationId };
  },
});

export const approveAudioGeneration = internalMutation({
  args: {
    ...actorArgs,
    episodeId: v.id("episodes"),
    requestHash: v.string(),
    toolInvocationId: v.id("toolInvocations"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const invocation = await ctx.db.get(args.toolInvocationId);
    if (
      invocation?.episodeId !== args.episodeId ||
      invocation.idempotencyKey !== args.requestHash ||
      invocation.toolName !== "generateAudioCandidates"
    ) {
      throw new ConvexError({
        code: "APPROVAL_MISMATCH",
        message: "Audio approval does not match.",
      });
    }
    const request = generationRequestSchema.parse(
      JSON.parse(invocation.inputJson) as unknown,
    );
    const [episode, scene] = await Promise.all([
      ctx.db.get(args.episodeId),
      ctx.db.get(request.sceneId as Id<"scenes">),
    ]);
    if (
      episode?.currentRevisionId !== invocation.baseRevisionId ||
      scene?.episodeId !== args.episodeId ||
      scene.script !== request.script
    ) {
      throw new ConvexError({
        code: "STALE_PROPOSAL",
        message: "Episode content changed after this audio proposal.",
      });
    }
    if (invocation.status === "approved" || invocation.status === "completed")
      return null;
    if (invocation.status !== "proposed") {
      throw new ConvexError({
        code: "INVALID_STATE",
        message: "Audio request is not awaiting approval.",
      });
    }
    const now = Date.now();
    await ctx.db.patch(invocation._id, {
      approvedAt: now,
      approvedBy: args.actorSubject,
      status: "approved",
    });
    await writeAudit(ctx, {
      actorSubject: args.actorSubject,
      episodeId: args.episodeId,
      eventType: "audio_generation.approved",
      payload: { requestHash: args.requestHash },
      targetId: invocation._id,
    });
    return null;
  },
});

export const rejectAudioGeneration = internalMutation({
  args: { ...actorArgs, toolInvocationId: v.id("toolInvocations") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const invocation = await ctx.db.get(args.toolInvocationId);
    if (!invocation)
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Audio request not found.",
      });
    if (invocation.status === "rejected") return null;
    if (invocation.status !== "proposed") {
      throw new ConvexError({
        code: "INVALID_STATE",
        message: "Audio request cannot be rejected.",
      });
    }
    await ctx.db.patch(invocation._id, {
      approvedBy: args.actorSubject,
      completedAt: Date.now(),
      status: "rejected",
    });
    await writeAudit(ctx, {
      actorSubject: args.actorSubject,
      episodeId: invocation.episodeId,
      eventType: "audio_generation.rejected",
      payload: { requestHash: invocation.idempotencyKey },
      targetId: invocation._id,
    });
    return null;
  },
});

export const claimGenerationJob = internalMutation({
  args: {
    ...actorArgs,
    dailyCreditDate: v.string(),
    dailyCreditCeiling: v.number(),
    episodeId: v.id("episodes"),
    estimatedCredits: v.number(),
    maxCandidates: v.number(),
    requestHash: v.string(),
    toolInvocationId: v.id("toolInvocations"),
  },
  returns: v.object({
    claimed: v.boolean(),
    jobId: v.id("generationJobs"),
    status: v.string(),
  }),
  handler: async (ctx, args) => {
    const invocation = await ctx.db.get(args.toolInvocationId);
    if (
      invocation?.status !== "approved" ||
      invocation.episodeId !== args.episodeId ||
      invocation.idempotencyKey !== args.requestHash
    ) {
      throw new ConvexError({
        code: "APPROVAL_REQUIRED",
        message: "A matching audio approval is required.",
      });
    }
    const request = generationRequestSchema.parse(
      JSON.parse(invocation.inputJson) as unknown,
    );
    const [episode, scene] = await Promise.all([
      ctx.db.get(args.episodeId),
      ctx.db.get(request.sceneId as Id<"scenes">),
    ]);
    if (
      episode?.currentRevisionId !== invocation.baseRevisionId ||
      scene?.episodeId !== args.episodeId ||
      scene.script !== request.script
    ) {
      throw new ConvexError({
        code: "STALE_PROPOSAL",
        message: "Episode content changed after audio approval.",
      });
    }
    const existing = await ctx.db
      .query("generationJobs")
      .withIndex("by_idempotency_key", (queryBuilder) =>
        queryBuilder.eq("idempotencyKey", args.requestHash),
      )
      .unique();
    if (existing) {
      return { claimed: false, jobId: existing._id, status: existing.status };
    }
    const today = await ctx.db
      .query("generationJobs")
      .withIndex("by_credit_date", (queryBuilder) =>
        queryBuilder.eq("dailyCreditDate", args.dailyCreditDate),
      )
      .collect();
    const reservedCredits = today.reduce(
      (total, job) => total + job.estimatedCredits,
      0,
    );
    if (reservedCredits + args.estimatedCredits > args.dailyCreditCeiling) {
      throw new ConvexError({
        code: "DAILY_CEILING",
        message: "Daily ElevenLabs credit ceiling reached.",
      });
    }
    const jobId = await ctx.db.insert("generationJobs", {
      candidateAssetIds: [],
      createdAt: Date.now(),
      dailyCreditDate: args.dailyCreditDate,
      episodeId: args.episodeId,
      estimatedCredits: args.estimatedCredits,
      idempotencyKey: args.requestHash,
      maxCandidates: args.maxCandidates,
      requestJson: invocation.inputJson,
      status: "running",
      toolInvocationId: invocation._id,
    });
    await ctx.db.patch(invocation._id, { status: "running" });
    return { claimed: true, jobId, status: "running" };
  },
});

export const recordCandidate = internalMutation({
  args: {
    bytes: v.number(),
    checksumSha256: v.string(),
    episodeId: v.id("episodes"),
    immutableKey: v.string(),
    jobId: v.id("generationJobs"),
    mimeType: v.string(),
    provenanceJson: v.string(),
    sceneId: v.id("scenes"),
  },
  returns: v.id("audioAssets"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("audioAssets")
      .withIndex("by_immutable_key", (queryBuilder) =>
        queryBuilder.eq("immutableKey", args.immutableKey),
      )
      .unique();
    if (existing) return existing._id;
    const job = await ctx.db.get(args.jobId);
    if (job?.status !== "running" || job.episodeId !== args.episodeId) {
      throw new ConvexError({
        code: "INVALID_JOB",
        message: "Generation job is not active.",
      });
    }
    const assetId = await ctx.db.insert("audioAssets", {
      bucket: "editorial",
      bytes: args.bytes,
      checksumSha256: args.checksumSha256,
      createdAt: Date.now(),
      episodeId: args.episodeId,
      immutableKey: args.immutableKey,
      mimeType: args.mimeType,
      provenanceJson: args.provenanceJson,
      sceneId: args.sceneId,
      status: "candidate",
    });
    await ctx.db.patch(job._id, {
      candidateAssetIds: [...job.candidateAssetIds, assetId],
    });
    return assetId;
  },
});

export const finishGenerationJob = internalMutation({
  args: {
    error: v.optional(v.string()),
    jobId: v.id("generationJobs"),
    providerRequestIds: v.array(v.string()),
    status: v.union(
      v.literal("completed"),
      v.literal("ambiguous"),
      v.literal("failed"),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (job?.status !== "running") return null;
    await ctx.db.patch(job._id, {
      completedAt: Date.now(),
      providerRequestId: args.providerRequestIds.join(","),
      status: args.status,
    });
    await ctx.db.patch(job.toolInvocationId, {
      completedAt: Date.now(),
      outputJson: stableJson({
        candidateAssetIds: job.candidateAssetIds,
        ...(args.error === undefined ? {} : { error: args.error }),
        providerRequestIds: args.providerRequestIds,
      }),
      status: args.status === "completed" ? "completed" : "failed",
    });
    return null;
  },
});

export const generationResult = internalQuery({
  args: { jobId: v.id("generationJobs") },
  handler: async (ctx, args) => ctx.db.get(args.jobId),
});

export const generationInvocation = internalQuery({
  args: { toolInvocationId: v.id("toolInvocations") },
  handler: async (ctx, args) => ctx.db.get(args.toolInvocationId),
});

export const audioAsset = internalQuery({
  args: { assetId: v.id("audioAssets") },
  handler: async (ctx, args) => ctx.db.get(args.assetId),
});

export const voice = internalQuery({
  args: { voiceId: v.id("voices") },
  handler: async (ctx, args) => ctx.db.get(args.voiceId),
});
