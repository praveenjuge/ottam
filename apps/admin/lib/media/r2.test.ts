import { describe, expect, it } from "vitest";
import {
  checksumSha256,
  immutableObjectKey,
  releaseAudioKey,
  releaseManifestKey,
} from "./r2";

describe("private R2 object policy", () => {
  it("creates immutable server-owned candidate keys", () => {
    expect(
      immutableObjectKey({
        candidateIndex: 0,
        episodeId: "episode_12345678",
        jobId: "job_12345678",
        mimeType: "audio/mpeg",
        sceneId: "scene_12345678",
      }),
    ).toBe(
      "episodes/episode_12345678/scenes/scene_12345678/jobs/job_12345678/candidate-1.mp3",
    );
  });

  it("rejects path traversal and unsupported content", () => {
    expect(() =>
      immutableObjectKey({
        candidateIndex: 0,
        episodeId: "../secrets",
        jobId: "job_12345678",
        mimeType: "text/html",
        sceneId: "scene_12345678",
      }),
    ).toThrow();
  });

  it("computes a stable SHA-256 checksum", () => {
    expect(checksumSha256(new TextEncoder().encode("ottam"))).toMatch(
      /^[a-f0-9]{64}$/,
    );
  });

  it("creates release-owned keys and rejects user-controlled paths", () => {
    expect(
      releaseAudioKey({
        assetId: "asset_12345678",
        mimeType: "audio/mpeg",
        releaseId: "release_12345678",
      }),
    ).toBe("releases/release_12345678/audio/asset_12345678.mp3");
    expect(releaseManifestKey("release_12345678")).toBe(
      "releases/release_12345678/manifest.json",
    );
    expect(() => releaseManifestKey("../release")).toThrow();
  });
});
