import { describe, expect, it } from "vitest";
import { assertSupportedDuration } from "./index";

describe("compiler boundary", () => {
  it("accepts all 46 supported whole-minute targets", () => {
    const targets = Array.from({ length: 46 }, (_, index) => index + 15);
    expect(targets.map(assertSupportedDuration)).toEqual(targets);
  });

  it("rejects unsupported durations before planning", () => {
    expect(() => assertSupportedDuration(14)).toThrow();
    expect(() => assertSupportedDuration(61)).toThrow();
  });
});
