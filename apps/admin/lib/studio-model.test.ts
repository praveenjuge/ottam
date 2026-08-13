import { describe, expect, it } from "vitest";
import {
  defaultStudioModel,
  getStudioModelId,
  getStudioModelLabel,
} from "./studio-model";

describe("studio model configuration", () => {
  it("uses OpenCode Go's current DeepSeek V4 Flash model", () => {
    expect(getStudioModelId({})).toBe(defaultStudioModel);
    expect(defaultStudioModel).toBe("deepseek-v4-flash");
    expect(getStudioModelLabel({})).toBe(
      "opencode-go/deepseek-v4-flash",
    );
  });

  it("refuses a model outside the DeepSeek V4 Flash family", () => {
    expect(() =>
      getStudioModelId({ OTTAM_STUDIO_MODEL: "gpt-5.4" }),
    ).toThrow(/DeepSeek V4 Flash/);
  });
});
