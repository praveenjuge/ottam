import { describe, expect, it } from "vitest";
import { isAdminEmail, normalizeEmail } from "./authorization";

describe("authorization primitives", () => {
  it("normalizes harmless email casing and whitespace", () => {
    expect(normalizeEmail(" Hello@PraveenJuge.com ")).toBe(
      "hello@praveenjuge.com",
    );
  });

  it("grants only an exact configured admin email", () => {
    expect(isAdminEmail("hello@praveenjuge.com", "hello@praveenjuge.com")).toBe(
      true,
    );
    expect(
      isAdminEmail("hello+admin@praveenjuge.com", "hello@praveenjuge.com"),
    ).toBe(false);
    expect(isAdminEmail(undefined, "hello@praveenjuge.com")).toBe(false);
  });
});
