import {
  episodeManifestSchema,
  type AudioAssetRef,
  type EpisodeManifest,
  type PlaybackPlan,
} from "@ottam/story-contract";
import { compileAllDurationPlans } from "@ottam/story-compiler";

interface ReleaseAsset {
  _id: string;
  bytes: number;
  checksumSha256: string;
  durationSeconds: number;
  immutableKey: string;
  mimeType: string;
  sceneId?: string;
  status: string;
  variant?: "walking" | "running" | "stationary";
}

interface ReleaseScene {
  _id: string;
  durationSeconds: number;
  kind: "core" | "optional" | "reactive";
  optionalPriority?: number;
  script: string;
  sortOrder: number;
  stableKey: string;
  title: string;
}

export interface ValidationReport {
  durationPlanCount: number;
  issues: string[];
  planHashes: string[];
  valid: boolean;
}

export interface ReleaseValidationResult {
  manifest?: EpisodeManifest;
  plans?: PlaybackPlan[];
  report: ValidationReport;
}

function assetReference(
  asset: ReleaseAsset,
  releaseKey: (asset: ReleaseAsset) => string,
): AudioAssetRef {
  return {
    bytes: asset.bytes,
    checksumSha256: asset.checksumSha256,
    durationSeconds: asset.durationSeconds,
    immutableKey: releaseKey(asset),
    mimeType: asset.mimeType as "audio/mp4" | "audio/mpeg",
  };
}

export function validateRelease(args: {
  assets: ReleaseAsset[];
  episodeId: string;
  releaseId: string;
  releaseKey: (asset: ReleaseAsset) => string;
  revisionId: string;
  scenes: ReleaseScene[];
  title: string;
}): ReleaseValidationResult {
  const issues: string[] = [];
  const approved = args.assets.filter((asset) => asset.status === "approved");
  const scenes = args.scenes.map((scene) => {
    const assigned = approved.filter((asset) => asset.sceneId === scene._id);
    if (scene.kind === "reactive") {
      const walking = assigned.filter((asset) => asset.variant === "walking");
      const running = assigned.filter((asset) => asset.variant === "running");
      const [walkingAsset] = walking;
      const [runningAsset] = running;
      if (
        walking.length !== 1 ||
        running.length !== 1 ||
        !walkingAsset ||
        !runningAsset
      ) {
        issues.push(
          `${scene.stableKey} requires exactly one walking and one running asset.`,
        );
        return null;
      }
      return {
        audio: {
          running: assetReference(runningAsset, args.releaseKey),
          walking: assetReference(walkingAsset, args.releaseKey),
        },
        durationSeconds: scene.durationSeconds,
        kind: scene.kind,
        script: scene.script,
        sortOrder: scene.sortOrder,
        stableKey: scene.stableKey,
        title: scene.title,
      };
    }
    const defaults = assigned.filter((asset) => asset.variant === undefined);
    const [defaultAsset] = defaults;
    if (defaults.length !== 1 || !defaultAsset) {
      issues.push(`${scene.stableKey} requires exactly one default asset.`);
      return null;
    }
    return {
      audio: { default: assetReference(defaultAsset, args.releaseKey) },
      durationSeconds: scene.durationSeconds,
      kind: scene.kind,
      ...(scene.optionalPriority === undefined
        ? {}
        : { optionalPriority: scene.optionalPriority }),
      script: scene.script,
      sortOrder: scene.sortOrder,
      stableKey: scene.stableKey,
      title: scene.title,
    };
  });
  if (issues.length > 0 || scenes.some((scene) => scene === null)) {
    return {
      report: { durationPlanCount: 0, issues, planHashes: [], valid: false },
    };
  }
  try {
    const manifest = episodeManifestSchema.parse({
      contractVersion: 1,
      episodeId: args.episodeId,
      releaseId: args.releaseId,
      revisionId: args.revisionId,
      scenes,
      title: args.title,
    });
    const plans = compileAllDurationPlans(manifest);
    return {
      manifest,
      plans,
      report: {
        durationPlanCount: plans.length,
        issues: [],
        planHashes: plans.map((plan) => plan.planHash),
        valid: plans.length === 46,
      },
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Release validation failed.";
    return {
      report: {
        durationPlanCount: 0,
        issues: [message],
        planHashes: [],
        valid: false,
      },
    };
  }
}
