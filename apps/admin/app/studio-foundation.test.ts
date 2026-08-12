import { describe, expect, it } from "vitest";
import { studioFoundationMessage } from "./studio-foundation";

describe("admin foundation", () => {
  it("identifies the studio as healthy without exposing a public product surface", () => {
    expect(studioFoundationMessage).toBe(
      "Production studio foundation is healthy.",
    );
  });
});
