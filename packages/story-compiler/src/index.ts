import { createHash } from "node:crypto";
import {
  durationMinutesSchema,
  episodeManifestSchema,
  playbackPlanSchema,
  type DurationMinutes,
  type EpisodeManifest,
  type PlaybackPlan,
  type StoryScene,
} from "@ottam/story-contract";

const TARGET_DENSITY = 0.35;
const MIN_DENSITY = 0.3;
const MAX_DENSITY = 0.4;

export class StoryCompilationError extends Error {
  override readonly name = "StoryCompilationError";
}

export function assertSupportedDuration(value: number): DurationMinutes {
  return durationMinutesSchema.parse(value);
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function hashPlan(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function selectScenes(
  manifest: EpisodeManifest,
  targetSeconds: number,
): StoryScene[] {
  const required = manifest.scenes.filter((scene) => scene.kind !== "optional");
  const optional = manifest.scenes
    .filter((scene) => scene.kind === "optional")
    .sort(
      (left, right) =>
        (left.optionalPriority ?? 0) - (right.optionalPriority ?? 0) ||
        left.sortOrder - right.sortOrder ||
        left.stableKey.localeCompare(right.stableKey),
    );
  const maxStorySeconds = Math.floor(targetSeconds * MAX_DENSITY);
  const targetStorySeconds = Math.floor(targetSeconds * TARGET_DENSITY);
  const selected = [...required];
  let storySeconds = required.reduce(
    (total, scene) => total + scene.durationSeconds,
    0,
  );
  if (storySeconds > maxStorySeconds) {
    throw new StoryCompilationError(
      "Required scenes exceed the 40% story-density ceiling.",
    );
  }
  for (const scene of optional) {
    if (storySeconds >= targetStorySeconds) break;
    if (storySeconds + scene.durationSeconds <= maxStorySeconds) {
      selected.push(scene);
      storySeconds += scene.durationSeconds;
    }
  }
  if (storySeconds < Math.ceil(targetSeconds * MIN_DENSITY)) {
    throw new StoryCompilationError(
      "The episode has too little optional material for this duration.",
    );
  }
  return selected.sort(
    (left, right) =>
      left.sortOrder - right.sortOrder ||
      left.stableKey.localeCompare(right.stableKey),
  );
}

function distributeMusic(totalSeconds: number, gapCount: number): number[] {
  if (gapCount < 1 || totalSeconds < gapCount) {
    throw new StoryCompilationError(
      "Every scene boundary requires at least one second of music.",
    );
  }
  const base = Math.floor(totalSeconds / gapCount);
  const remainder = totalSeconds % gapCount;
  return Array.from(
    { length: gapCount },
    (_, index) => base + (index < remainder ? 1 : 0),
  );
}

export function compileStoryPlan(
  input: EpisodeManifest,
  minutes: number,
): PlaybackPlan {
  const manifest = episodeManifestSchema.parse(input);
  const targetMinutes = assertSupportedDuration(minutes);
  const targetSeconds = targetMinutes * 60;
  const scenes = selectScenes(manifest, targetSeconds);
  const storySeconds = scenes.reduce(
    (total, scene) => total + scene.durationSeconds,
    0,
  );
  const musicSeconds = targetSeconds - storySeconds;
  const musicDurations = distributeMusic(musicSeconds, scenes.length - 1);
  const segments = scenes.flatMap((scene, index) => {
    const sceneSegment = {
      audio: scene.audio,
      durationSeconds: scene.durationSeconds,
      kind: scene.kind,
      sceneKey: scene.stableKey,
      type: "scene" as const,
    };
    const musicDuration = musicDurations[index];
    return musicDuration === undefined
      ? [sceneSegment]
      : [
          sceneSegment,
          { durationSeconds: musicDuration, type: "music" as const },
        ];
  });
  const unsignedPlan = {
    density: storySeconds / targetSeconds,
    episodeId: manifest.episodeId,
    musicSeconds,
    releaseId: manifest.releaseId,
    segments,
    storySeconds,
    targetMinutes,
    targetSeconds,
  };
  return playbackPlanSchema.parse({
    ...unsignedPlan,
    planHash: hashPlan(unsignedPlan),
  });
}

export function compileAllDurationPlans(
  manifest: EpisodeManifest,
): PlaybackPlan[] {
  return Array.from({ length: 46 }, (_, index) =>
    compileStoryPlan(manifest, index + 15),
  );
}
