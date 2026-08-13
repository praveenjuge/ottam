import { describe, expect, it } from "vitest";
import {
  isAdminEmail,
  isAdminIdentity,
  normalizeEmail,
} from "./authorization";

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

  it("binds admin access to the immutable Clerk user ID", () => {
    const identity = {
      email: "hello@praveenjuge.com",
      subject: "user_admin",
    };
    expect(
      isAdminIdentity(
        identity,
        "user_admin",
        "hello@praveenjuge.com",
      ),
    ).toBe(true);
    expect(
      isAdminIdentity(identity, "user_listener", "hello@praveenjuge.com"),
    ).toBe(false);
    expect(
      isAdminIdentity(
        { ...identity, email: "other@example.com" },
        "user_admin",
        "hello@praveenjuge.com",
      ),
    ).toBe(false);
    expect(isAdminIdentity({ subject: "user_admin" }, "user_admin")).toBe(
      true,
    );
  });
});
