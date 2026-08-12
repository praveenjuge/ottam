"use node";

import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action } from "./_generated/server";
import { requireAdmin } from "./lib/authorization";
import {
  ElevenLabsAudioGenerationProvider,
  type AudioGenerationProvider,
} from "../lib/media/generation-provider";
import {
  estimatedCredits,
  generationRequestSchema,
} from "../lib/media/generation-contract";
import {
  immutableObjectKey,
  r2Configuration,
  signedEditorialReadUrl,
  uploadEditorialCandidate,
} from "../lib/media/r2";

function dailyCeiling(): number {
  const value = Number(process.env.ELEVENLABS_DAILY_CREDIT_CEILING);
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(
      "ELEVENLABS_DAILY_CREDIT_CEILING must be a positive integer.",
    );
  }
  return value;
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function productionProvider(): AudioGenerationProvider {
  return new ElevenLabsAudioGenerationProvider(
    process.env.ELEVENLABS_API_KEY ?? "",
  );
}

export const generateAudioCandidates = action({
  args: {
    episodeId: v.id("episodes"),
    requestHash: v.string(),
    toolInvocationId: v.id("toolInvocations"),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    candidateAssetIds: Id<"audioAssets">[];
    jobId: Id<"generationJobs">;
    status: string;
  }> => {
    const identity = await requireAdmin(ctx);
    const invocation = await ctx.runQuery(
      internal.mediaInternal.generationInvocation,
      { toolInvocationId: args.toolInvocationId },
    );
    if (invocation?.idempotencyKey !== args.requestHash) {
      throw new ConvexError({
        code: "REQUEST_MISMATCH",
        message: "Audio request not found.",
      });
    }
    const request = generationRequestSchema.parse(
      JSON.parse(invocation.inputJson) as unknown,
    );
    const [voice, scene] = await Promise.all([
      ctx.runQuery(internal.mediaInternal.voice, {
        voiceId: request.voiceId as Id<"voices">,
      }),
      ctx.runQuery(internal.mediaInternal.scene, {
        sceneId: request.sceneId as Id<"scenes">,
      }),
    ]);
    if (
      voice?.status !== "approved" ||
      scene?.episodeId !== args.episodeId ||
      scene.script !== request.script
    ) {
      throw new ConvexError({
        code: "ASSET_UNAVAILABLE",
        message: "The scene or approved licensed voice is unavailable.",
      });
    }
    const providerRequest = {
      ...request,
      voiceId: voice.elevenLabsVoiceId,
    };
    const claim = await ctx.runMutation(
      internal.mediaInternal.claimGenerationJob,
      {
        actorSubject: identity.subject,
        dailyCreditCeiling: dailyCeiling(),
        dailyCreditDate: todayUtc(),
        episodeId: args.episodeId,
        estimatedCredits: estimatedCredits(request),
        maxCandidates: request.candidateCount,
        requestHash: args.requestHash,
        toolInvocationId: args.toolInvocationId,
      },
    );
    if (!claim.claimed) {
      const existing = await ctx.runQuery(
        internal.mediaInternal.generationResult,
        {
          jobId: claim.jobId,
        },
      );
      return {
        candidateAssetIds: existing?.candidateAssetIds ?? [],
        jobId: claim.jobId,
        status: claim.status,
      };
    }

    const providerRequestIds: string[] = [];
    let externalCallStarted = false;
    try {
      const configuration = r2Configuration();
      const provider = productionProvider();
      for (
        let candidateIndex = 0;
        candidateIndex < request.candidateCount;
        candidateIndex += 1
      ) {
        externalCallStarted = true;
        const generated = await provider.generate(
          providerRequest,
          candidateIndex,
        );
        providerRequestIds.push(generated.providerRequestId);
        const key = immutableObjectKey({
          candidateIndex,
          episodeId: args.episodeId,
          jobId: claim.jobId,
          mimeType: generated.mimeType,
          sceneId: request.sceneId,
        });
        const uploaded = await uploadEditorialCandidate({
          bytes: generated.bytes,
          configuration,
          key,
          mimeType: generated.mimeType,
        });
        await ctx.runMutation(internal.mediaInternal.recordCandidate, {
          bytes: uploaded.bytes,
          checksumSha256: uploaded.checksum,
          durationSeconds: scene.durationSeconds,
          episodeId: args.episodeId,
          immutableKey: key,
          jobId: claim.jobId,
          mimeType: generated.mimeType,
          provenanceJson: JSON.stringify({
            candidateIndex,
            characterCost: generated.characterCost,
            generatedAt: Date.now(),
            modelId: request.modelId,
            outputFormat: request.outputFormat,
            provider: "elevenlabs",
            providerRequestId: generated.providerRequestId,
            requestHash: args.requestHash,
            voiceId: request.voiceId,
            providerVoiceId: voice.elevenLabsVoiceId,
            voiceSettings: request.voiceSettings,
          }),
          sceneId: request.sceneId as Id<"scenes">,
        });
      }
      await ctx.runMutation(internal.mediaInternal.finishGenerationJob, {
        jobId: claim.jobId,
        providerRequestIds,
        status: "completed",
      });
    } catch (error) {
      await ctx.runMutation(internal.mediaInternal.finishGenerationJob, {
        error:
          error instanceof Error ? error.message : "Audio generation failed.",
        jobId: claim.jobId,
        providerRequestIds,
        status: externalCallStarted ? "ambiguous" : "failed",
      });
      throw error;
    }
    const completed = await ctx.runQuery(
      internal.mediaInternal.generationResult,
      {
        jobId: claim.jobId,
      },
    );
    return {
      candidateAssetIds: completed?.candidateAssetIds ?? [],
      jobId: claim.jobId,
      status: completed?.status ?? "ambiguous",
    };
  },
});

export const candidateReadUrl = action({
  args: { assetId: v.id("audioAssets"), episodeId: v.id("episodes") },
  returns: v.object({ expiresInSeconds: v.number(), url: v.string() }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    expiresInSeconds: number;
    url: string;
  }> => {
    await requireAdmin(ctx);
    const asset = await ctx.runQuery(internal.mediaInternal.audioAsset, {
      assetId: args.assetId,
    });
    if (
      asset?.episodeId !== args.episodeId ||
      asset.bucket !== "editorial" ||
      asset.status !== "candidate"
    ) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Candidate audio not found.",
      });
    }
    const expiresInSeconds = 300;
    return {
      expiresInSeconds,
      url: await signedEditorialReadUrl({
        configuration: r2Configuration(),
        key: asset.immutableKey,
        ttlSeconds: expiresInSeconds,
      }),
    };
  },
});
