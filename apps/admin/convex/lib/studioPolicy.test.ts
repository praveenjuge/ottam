import { describe, expect, it } from "vitest";
import {
  decideStudioTool,
  parseChangeSetProposal,
  stableJson,
} from "./studioPolicy";

const episodeChange = {
  after: { synopsis: "After", title: "A stronger title" },
  before: { synopsis: "Before", title: "Old title" },
  entity: "episode" as const,
};

describe("production studio policy", () => {
  it("requires approval for side effects and denies unknown capabilities", () => {
    expect(decideStudioTool("readEpisode")).toEqual({ type: "allow" });
    expect(decideStudioTool("proposeChangeSet")).toEqual({ type: "allow" });
    expect(decideStudioTool("proposeAudioGeneration")).toEqual({
      type: "allow",
    });
    expect(decideStudioTool("applyChangeSet")).toEqual({
      type: "user-approval",
    });
    expect(decideStudioTool("generateAudioCandidates")).toEqual({
      type: "user-approval",
    });
    expect(decideStudioTool("publishEpisode").type).toBe("deny");
    expect(decideStudioTool("runShell").type).toBe("deny");
    expect(decideStudioTool("readSecrets").type).toBe("deny");
  });

  it("rejects duplicate or destructive scene operations", () => {
    const scene = {
      durationSeconds: 45,
      kind: "core" as const,
      script: "You hear the receiver click on.",
      sortOrder: 0,
      stableKey: "opening",
      title: "Opening",
    };
    expect(() =>
      parseChangeSetProposal({
        operations: [
          { after: scene, before: null, entity: "scene" },
          { after: scene, before: null, entity: "scene" },
        ],
        summary: "Duplicate",
      }),
    ).toThrow();
    expect(() =>
      parseChangeSetProposal({
        operations: [{ before: scene, entity: "scene" }],
        summary: "Delete the opening",
      }),
    ).toThrow();
  });

  it("produces stable canonical JSON for proposal hashing", () => {
    expect(stableJson({ z: 1, a: [episodeChange] })).toBe(
      stableJson({ a: [episodeChange], z: 1 }),
    );
  });
});
