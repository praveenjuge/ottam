import { describe, expect, it } from "vitest";
import { fixtureContractVersion } from "./index";

describe("fixture package", () => {
  it("declares the contract version its fixtures target", () => {
    expect(fixtureContractVersion).toBe(1);
  });
});
