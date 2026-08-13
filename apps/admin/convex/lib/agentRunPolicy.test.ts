import { describe, expect, it } from "vitest";
import { canStartAgentRun } from "./agentRunPolicy";

describe("agent run rate policy", () => {
  it("allows normal chat use and bounds rapid expensive turns", () => {
    const now = 100_000;
    expect(canStartAgentRun([now - 59_999], now)).toBe(true);
    expect(
      canStartAgentRun(
        Array.from({ length: 6 }, (_, index) => now - index * 1_000),
        now,
      ),
    ).toBe(false);
    expect(
      canStartAgentRun(
        Array.from({ length: 6 }, (_, index) => now - 61_000 - index),
        now,
      ),
    ).toBe(true);
  });
});
