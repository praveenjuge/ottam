import { z } from "zod";

export const durationMinutesSchema = z.number().int().min(15).max(60);
export type DurationMinutes = z.infer<typeof durationMinutesSchema>;

export const movementStateSchema = z.enum(["walking", "running", "stationary"]);
export type MovementState = z.infer<typeof movementStateSchema>;

export const sceneKindSchema = z.enum(["core", "optional", "reactive"]);
export type SceneKind = z.infer<typeof sceneKindSchema>;

export const sceneDurationSecondsSchema = z.number().int().min(20).max(90);
export const storyDensitySchema = z.number().min(0.3).max(0.4);

export const audioAssetRefSchema = z.object({
  bytes: z.number().int().positive(),
  checksumSha256: z.string().regex(/^[a-f0-9]{64}$/),
  durationSeconds: sceneDurationSecondsSchema,
  immutableKey: z.string().min(1).max(512),
  mimeType: z.enum(["audio/mp4", "audio/mpeg"]),
});
export type AudioAssetRef = z.infer<typeof audioAssetRefSchema>;

const defaultAudioSchema = z.object({ default: audioAssetRefSchema });
const reactiveAudioSchema = z.object({
  running: audioAssetRefSchema,
  walking: audioAssetRefSchema,
});

export const storySceneSchema = z
  .object({
    audio: z.union([defaultAudioSchema, reactiveAudioSchema]),
    durationSeconds: sceneDurationSecondsSchema,
    kind: sceneKindSchema,
    optionalPriority: z.number().int().min(0).optional(),
    script: z.string().min(1),
    sortOrder: z.number().int().min(0),
    stableKey: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    title: z.string().min(1).max(120),
  })
  .superRefine((scene, context) => {
    const isReactiveAudio = "walking" in scene.audio;
    if (scene.kind === "reactive" && !isReactiveAudio) {
      context.addIssue({
        code: "custom",
        message: "Reactive scenes require walking and running audio.",
      });
    }
    if (scene.kind !== "reactive" && isReactiveAudio) {
      context.addIssue({
        code: "custom",
        message: "Only reactive scenes may use movement audio.",
      });
    }
    const durations = Object.values(scene.audio).map(
      (asset) => asset.durationSeconds,
    );
    if (durations.some((duration) => duration !== scene.durationSeconds)) {
      context.addIssue({
        code: "custom",
        message: "Every variant must match the planned scene duration.",
      });
    }
    if (scene.kind === "optional" && scene.optionalPriority === undefined) {
      context.addIssue({
        code: "custom",
        message: "Optional scenes require a priority.",
      });
    }
  });
export type StoryScene = z.infer<typeof storySceneSchema>;

export const episodeManifestSchema = z
  .object({
    contractVersion: z.literal(1),
    episodeId: z.string().min(1),
    releaseId: z.string().min(1),
    revisionId: z.string().min(1),
    scenes: z.array(storySceneSchema).min(2),
    title: z.string().min(1),
  })
  .superRefine((manifest, context) => {
    const keys = new Set<string>();
    const orders = new Set<number>();
    for (const [index, scene] of manifest.scenes.entries()) {
      if (keys.has(scene.stableKey)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate scene key: ${scene.stableKey}`,
          path: ["scenes", index],
        });
      }
      if (orders.has(scene.sortOrder)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate scene order: ${String(scene.sortOrder)}`,
          path: ["scenes", index],
        });
      }
      keys.add(scene.stableKey);
      orders.add(scene.sortOrder);
    }
    const ordered = [...manifest.scenes].sort(
      (left, right) => left.sortOrder - right.sortOrder,
    );
    if (ordered.at(-1)?.kind !== "core") {
      context.addIssue({
        code: "custom",
        message: "The final authored scene must be core.",
      });
    }
  });
export type EpisodeManifest = z.infer<typeof episodeManifestSchema>;

export const playbackSceneSegmentSchema = z.object({
  audio: z.union([defaultAudioSchema, reactiveAudioSchema]),
  durationSeconds: sceneDurationSecondsSchema,
  kind: sceneKindSchema,
  sceneKey: z.string(),
  type: z.literal("scene"),
});

export const playbackMusicSegmentSchema = z.object({
  durationSeconds: z.number().int().positive(),
  type: z.literal("music"),
});

export const playbackPlanSchema = z.object({
  density: storyDensitySchema,
  episodeId: z.string(),
  musicSeconds: z.number().int().nonnegative(),
  planHash: z.string().regex(/^[a-f0-9]{64}$/),
  releaseId: z.string(),
  segments: z.array(
    z.union([playbackSceneSegmentSchema, playbackMusicSegmentSchema]),
  ),
  storySeconds: z.number().int().positive(),
  targetMinutes: durationMinutesSchema,
  targetSeconds: z.number().int().positive(),
});
export type PlaybackPlan = z.infer<typeof playbackPlanSchema>;

export const episodeReleaseBundleSchema = z
  .object({
    contractVersion: z.literal(1),
    manifest: episodeManifestSchema,
    plans: z.array(playbackPlanSchema).length(46),
  })
  .superRefine((bundle, context) => {
    for (const [index, plan] of bundle.plans.entries()) {
      if (
        plan.targetMinutes !== index + 15 ||
        plan.episodeId !== bundle.manifest.episodeId ||
        plan.releaseId !== bundle.manifest.releaseId
      ) {
        context.addIssue({
          code: "custom",
          message: "Release plans must cover every whole minute from 15 to 60.",
          path: ["plans", index],
        });
      }
    }
  });
export type EpisodeReleaseBundle = z.infer<typeof episodeReleaseBundleSchema>;

export const storyContractVersion = 1 as const;
