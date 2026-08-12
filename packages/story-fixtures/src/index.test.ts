import { describe, expect, it } from "vitest";
import {
  compileAllDurationPlans,
  compileStoryPlan,
  StoryCompilationError,
} from "@ottam/story-compiler";
import { fixtureContractVersion, theSignalEpisodeOne } from "./index";

function durationOfPlan(plan: ReturnType<typeof compileStoryPlan>): number {
  return plan.segments.reduce(
    (total, segment) => total + segment.durationSeconds,
    0,
  );
}

describe("The Signal fixture", () => {
  it("targets the current story contract", () => {
    expect(fixtureContractVersion).toBe(1);
  });

  it("compiles all 46 exact, deterministic duration plans", () => {
    const firstCompilation = compileAllDurationPlans(theSignalEpisodeOne);
    const secondCompilation = compileAllDurationPlans(theSignalEpisodeOne);
    expect(firstCompilation).toHaveLength(46);
    expect(firstCompilation.map((plan) => plan.targetMinutes)).toEqual(
      Array.from({ length: 46 }, (_, index) => index + 15),
    );
    expect(firstCompilation.map((plan) => plan.planHash)).toEqual(
      secondCompilation.map((plan) => plan.planHash),
    );
    for (const plan of firstCompilation) {
      expect(durationOfPlan(plan)).toBe(plan.targetSeconds);
      expect(plan.density).toBeGreaterThanOrEqual(0.3);
      expect(plan.density).toBeLessThanOrEqual(0.4);
      const musicDurations = plan.segments
        .filter((segment) => segment.type === "music")
        .map((segment) => segment.durationSeconds);
      expect(Math.max(...musicDurations)).toBeLessThanOrEqual(90);
    }
  });

  it("keeps core plot and reactive checkpoints in authored order", () => {
    const requiredKeys = [
      "opening",
      "discovery",
      "reaction-1",
      "confrontation",
      "reaction-2",
      "climax",
      "ending",
    ];
    for (const plan of compileAllDurationPlans(theSignalEpisodeOne)) {
      const actual = plan.segments.flatMap((segment) =>
        segment.type === "scene" && segment.kind !== "optional"
          ? [segment.sceneKey]
          : [],
      );
      expect(actual).toEqual(requiredKeys);
    }
  });

  it("only adds optional scenes as duration increases", () => {
    let previous = new Set<string>();
    for (const plan of compileAllDurationPlans(theSignalEpisodeOne)) {
      const current = new Set(
        plan.segments.flatMap((segment) =>
          segment.type === "scene" && segment.kind === "optional"
            ? [segment.sceneKey]
            : [],
        ),
      );
      expect([...previous].every((key) => current.has(key))).toBe(true);
      previous = current;
    }
  });

  it("rejects episodes without enough authored material", () => {
    const requiredOnly = {
      ...theSignalEpisodeOne,
      scenes: theSignalEpisodeOne.scenes.filter(
        (scene) => scene.kind !== "optional",
      ),
    };
    expect(() => compileStoryPlan(requiredOnly, 60)).toThrow(
      StoryCompilationError,
    );
  });
});
