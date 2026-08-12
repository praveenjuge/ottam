import { theSignalEpisodeOne } from "@ottam/story-fixtures";
import { describe, expect, it } from "vitest";
import { validateRelease } from "./release-validation";

function fixtureInput() {
  const assets: {
    _id: string;
    bytes: number;
    checksumSha256: string;
    durationSeconds: number;
    immutableKey: string;
    mimeType: string;
    sceneId: string;
    status: string;
    variant?: "walking" | "running";
  }[] = [];
  const scenes = theSignalEpisodeOne.scenes.map((scene, index) => {
    const sceneId = `scene-${String(index)}`;
    for (const [variant, audio] of Object.entries(scene.audio)) {
      assets.push({
        _id: `asset-${String(assets.length)}`,
        ...audio,
        sceneId,
        status: "approved",
        ...(variant === "default"
          ? {}
          : { variant: variant as "walking" | "running" }),
      });
    }
    return {
      _id: sceneId,
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
  return { assets, scenes };
}

describe("release validation", () => {
  it("proves all 46 plans when every audio slot is assigned", () => {
    const input = fixtureInput();
    const result = validateRelease({
      ...input,
      episodeId: "episode-1",
      releaseId: "release-1",
      releaseKey: (asset) => `releases/release-1/${asset._id}.m4a`,
      revisionId: "revision-1",
      title: "The Signal",
    });
    expect(result.report.valid).toBe(true);
    expect(result.report.durationPlanCount).toBe(46);
    expect(new Set(result.report.planHashes).size).toBe(46);
  });

  it("fails closed when a required assignment is missing", () => {
    const input = fixtureInput();
    input.assets.shift();
    const result = validateRelease({
      ...input,
      episodeId: "episode-1",
      releaseId: "release-1",
      releaseKey: (asset) => asset.immutableKey,
      revisionId: "revision-1",
      title: "The Signal",
    });
    expect(result.report.valid).toBe(false);
    expect(result.report.issues[0]).toMatch(/requires exactly one/);
  });
});
