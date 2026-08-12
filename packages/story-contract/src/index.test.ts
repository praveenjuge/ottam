import { describe, expect, it } from "vitest";
import {
  episodeManifestSchema,
  durationMinutesSchema,
  movementStateSchema,
  sceneDurationSecondsSchema,
  storyContractVersion,
  storyDensitySchema,
} from "./index";

describe("story contract foundation", () => {
  it("accepts only supported whole-minute durations", () => {
    expect(durationMinutesSchema.parse(15)).toBe(15);
    expect(durationMinutesSchema.parse(60)).toBe(60);
    expect(() => durationMinutesSchema.parse(14)).toThrow();
    expect(() => durationMinutesSchema.parse(30.5)).toThrow();
  });

  it("starts with an explicit contract version", () => {
    expect(storyContractVersion).toBe(1);
  });

  it("models supportive movement reactions and short audio bursts", () => {
    expect(movementStateSchema.options).toEqual([
      "walking",
      "running",
      "stationary",
    ]);
    expect(sceneDurationSecondsSchema.parse(20)).toBe(20);
    expect(sceneDurationSecondsSchema.parse(90)).toBe(90);
    expect(() => sceneDurationSecondsSchema.parse(91)).toThrow();
  });

  it("keeps initial plans within the target story density", () => {
    expect(storyDensitySchema.parse(0.3)).toBe(0.3);
    expect(storyDensitySchema.parse(0.4)).toBe(0.4);
    expect(() => storyDensitySchema.parse(0.5)).toThrow();
  });

  it("rejects duplicate scene keys before compilation", () => {
    const audio = {
      bytes: 1,
      checksumSha256: "0".repeat(64),
      durationSeconds: 20,
      immutableKey: "fixture.m4a",
      mimeType: "audio/mp4" as const,
    };
    const scene = {
      audio: { default: audio },
      durationSeconds: 20,
      kind: "core" as const,
      script: "You hear a signal.",
      sortOrder: 0,
      stableKey: "opening",
      title: "Opening",
    };
    expect(() =>
      episodeManifestSchema.parse({
        contractVersion: 1,
        episodeId: "episode",
        releaseId: "release",
        revisionId: "revision",
        scenes: [scene, { ...scene, sortOrder: 1 }],
        title: "Fixture",
      }),
    ).toThrow(/Duplicate scene key/);
  });
});
