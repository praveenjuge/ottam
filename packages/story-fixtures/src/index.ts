import {
  episodeManifestSchema,
  type AudioAssetRef,
  type EpisodeManifest,
  type StoryScene,
} from "@ottam/story-contract";

const fixtureChecksum = "0".repeat(64);

function fixtureAudio(sceneKey: string): AudioAssetRef {
  return {
    bytes: 1,
    checksumSha256: fixtureChecksum,
    durationSeconds: sceneKey.startsWith("reaction-") ? 30 : 45,
    immutableKey: `fixtures/the-signal/episode-01/${sceneKey}.m4a`,
    mimeType: "audio/mp4",
  };
}

function core(stableKey: string, title: string, sortOrder: number): StoryScene {
  return {
    audio: { default: fixtureAudio(stableKey) },
    durationSeconds: 45,
    kind: "core",
    script: `Neutral second-person fixture for ${title}.`,
    sortOrder,
    stableKey,
    title,
  };
}

function optional(index: number, sortOrder: number): StoryScene {
  const stableKey = `optional-${String(index).padStart(2, "0")}`;
  return {
    audio: { default: fixtureAudio(stableKey) },
    durationSeconds: 45,
    kind: "optional",
    optionalPriority: index,
    script: `Optional neutral second-person fixture ${String(index)}.`,
    sortOrder,
    stableKey,
    title: `Optional scene ${String(index)}`,
  };
}

function reactive(index: number, sortOrder: number): StoryScene {
  const stableKey = `reaction-${String(index)}`;
  const asset = fixtureAudio(stableKey);
  return {
    audio: {
      running: {
        ...asset,
        immutableKey: asset.immutableKey.replace(".m4a", ".running.m4a"),
      },
      walking: {
        ...asset,
        immutableKey: asset.immutableKey.replace(".m4a", ".walking.m4a"),
      },
    },
    durationSeconds: 30,
    kind: "reactive",
    script: `Supportive convergent movement reaction ${String(index)}.`,
    sortOrder,
    stableKey,
    title: `Movement reaction ${String(index)}`,
  };
}

const scenes: StoryScene[] = [
  core("opening", "Opening", 0),
  ...Array.from({ length: 6 }, (_, index) =>
    optional(index + 1, (index + 1) * 4),
  ),
  core("discovery", "Discovery", 28),
  ...Array.from({ length: 5 }, (_, index) =>
    optional(index + 7, 32 + index * 4),
  ),
  reactive(1, 50),
  core("confrontation", "Confrontation", 52),
  ...Array.from({ length: 5 }, (_, index) =>
    optional(index + 12, 56 + index * 4),
  ),
  reactive(2, 74),
  ...Array.from({ length: 5 }, (_, index) =>
    optional(index + 17, 76 + index * 3),
  ),
  core("climax", "Climax", 92),
  core("ending", "Ending", 96),
];

export const theSignalEpisodeOne: EpisodeManifest = episodeManifestSchema.parse(
  {
    contractVersion: 1,
    episodeId: "fixture-episode-the-signal-01",
    releaseId: "fixture-release-the-signal-01-v1",
    revisionId: "fixture-revision-the-signal-01-v1",
    scenes,
    title: "The Signal — Someone Is Listening",
  },
);

export const fixtureContractVersion = 1 as const;
