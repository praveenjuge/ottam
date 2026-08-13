import { describe, expect, it } from "vitest";
import { isDuplicateGuestMerge, shouldApplyProgress } from "./listenerPolicy";

describe("listener merge policy", () => {
  it("accepts only newer client progress sequences", () => {
    expect(shouldApplyProgress(undefined, 0)).toBe(true);
    expect(shouldApplyProgress(4, 5)).toBe(true);
    expect(shouldApplyProgress(5, 5)).toBe(false);
    expect(shouldApplyProgress(6, 5)).toBe(false);
    expect(shouldApplyProgress(undefined, -1)).toBe(false);
  });

  it("makes guest merge retries idempotent", () => {
    expect(isDuplicateGuestMerge("merge-1", "merge-1")).toBe(true);
    expect(isDuplicateGuestMerge("merge-1", "merge-2")).toBe(false);
  });
});
