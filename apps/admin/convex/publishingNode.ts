"use node";

import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { episodeReleaseBundleSchema } from "@ottam/story-contract";
import { ConvexError, v } from "convex/values";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action } from "./_generated/server";
import { requireAdmin } from "./lib/authorization";
import { stableJson } from "./lib/studioPolicy";
import {
  copyEditorialAssetToRelease,
  r2Configuration,
  releaseAudioKey,
  releaseManifestKey,
  uploadReleaseManifest,
} from "../lib/media/r2";
import {
  validateRelease,
  type ValidationReport,
} from "../lib/release-validation";

const validationReportValidator = v.object({
  durationPlanCount: v.number(),
  issues: v.array(v.string()),
  planHashes: v.array(v.string()),
  valid: v.boolean(),
});

function hash(value: string): string {
  return bytesToHex(sha256(new TextEncoder().encode(value)));
}

export const validateEpisode = action({
  args: { episodeId: v.id("episodes") },
  returns: validationReportValidator,
  handler: async (ctx, args): Promise<ValidationReport> => {
    await requireAdmin(ctx);
    const workspace = await ctx.runQuery(api.studio.workspace, args);
    const revisionId = workspace.episode.currentRevisionId;
    if (!revisionId) {
      return {
        durationPlanCount: 0,
        issues: ["Episode has no current revision."],
        planHashes: [],
        valid: false,
      };
    }
    return validateRelease({
      assets: workspace.audioAssets,
      episodeId: args.episodeId,
      releaseId: `validation-${args.episodeId}`,
      releaseKey: (asset) => asset.immutableKey,
      revisionId,
      scenes: workspace.scenes,
      title: workspace.episode.title,
    }).report;
  },
});

export const publishEpisode = action({
  args: {
    confirmationText: v.literal("PUBLISH"),
    episodeId: v.id("episodes"),
    humanIntentNonce: v.string(),
  },
  returns: v.object({
    releaseId: v.id("episodeReleases"),
    releaseNumber: v.number(),
    status: v.string(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    releaseId: Id<"episodeReleases">;
    releaseNumber: number;
    status: string;
  }> => {
    const identity = await requireAdmin(ctx);
    if (!/^[a-f0-9-]{36}$/.test(args.humanIntentNonce)) {
      throw new ConvexError({
        code: "INVALID_INTENT",
        message: "Publishing requires a fresh human confirmation.",
      });
    }
    const workspace = await ctx.runQuery(api.studio.workspace, {
      episodeId: args.episodeId,
    });
    const revisionId = workspace.episode.currentRevisionId;
    if (!revisionId) {
      throw new ConvexError({
        code: "NO_REVISION",
        message: "Episode has no current revision.",
      });
    }
    const reserved = await ctx.runMutation(
      internal.publishingInternal.reserveRelease,
      {
        actorSubject: identity.subject,
        episodeId: args.episodeId,
        idempotencyKey: hash(
          `${identity.subject}:${args.episodeId}:${revisionId}:${args.humanIntentNonce}`,
        ),
        revisionId,
      },
    );
    if (reserved.status === "published") return reserved;

    try {
      const configuration = r2Configuration();
      const releaseKey = (asset: { _id: string; mimeType: string }) =>
        releaseAudioKey({
          assetId: asset._id,
          mimeType: asset.mimeType,
          releaseId: reserved.releaseId,
        });
      const validation = validateRelease({
        assets: workspace.audioAssets,
        episodeId: args.episodeId,
        releaseId: reserved.releaseId,
        releaseKey,
        revisionId,
        scenes: workspace.scenes,
        title: workspace.episode.title,
      });
      if (
        !validation.report.valid ||
        !validation.manifest ||
        !validation.plans
      ) {
        throw new ConvexError({
          code: "VALIDATION_FAILED",
          message: validation.report.issues.join(" "),
        });
      }
      const selectedKeys = new Set(
        validation.manifest.scenes.flatMap((scene) =>
          Object.values(scene.audio).map((asset) => asset.immutableKey),
        ),
      );
      for (const asset of workspace.audioAssets) {
        const key = releaseKey(asset);
        if (asset.status !== "approved" || !selectedKeys.has(key)) continue;
        await copyEditorialAssetToRelease({
          configuration,
          expectedBytes: asset.bytes,
          expectedChecksum: asset.checksumSha256,
          key,
          mimeType: asset.mimeType,
          sourceKey: asset.immutableKey,
        });
      }
      const bundle = episodeReleaseBundleSchema.parse({
        contractVersion: 1,
        manifest: validation.manifest,
        plans: validation.plans,
      });
      const manifestKey = releaseManifestKey(reserved.releaseId);
      const uploaded = await uploadReleaseManifest({
        bytes: new TextEncoder().encode(stableJson(bundle)),
        configuration,
        key: manifestKey,
      });
      await ctx.runMutation(internal.publishingInternal.finalizeRelease, {
        actorSubject: identity.subject,
        manifestChecksumSha256: uploaded.checksum,
        manifestKey,
        releaseId: reserved.releaseId,
        validationReportJson: stableJson(validation.report),
      });
      return { ...reserved, status: "published" };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Publishing failed.";
      await ctx.runMutation(internal.publishingInternal.failRelease, {
        error: message,
        releaseId: reserved.releaseId,
      });
      throw error;
    }
  },
});
