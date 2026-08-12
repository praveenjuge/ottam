import { describe, expect, it } from "vitest";
import { defaultStudioModel, getStudioModelId } from "./studio-model";

describe("studio model configuration", () => {
  it("uses the verified versioned DeepSeek V4 Flash model", () => {
    expect(getStudioModelId({})).toBe(defaultStudioModel);
    expect(defaultStudioModel).toBe("deepseek/deepseek-v4-flash-0731");
  });

  it("refuses a model outside the DeepSeek V4 Flash family", () => {
    expect(() =>
      getStudioModelId({ OTTAM_STUDIO_MODEL: "openai/gpt-5.4" }),
    ).toThrow(/DeepSeek V4 Flash/);
  });
});
