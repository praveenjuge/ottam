import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "./prompt-input";

describe("PromptInput", () => {
  it("submits the textarea under the message field name", () => {
    const markup = renderToStaticMarkup(
      <PromptInput onSubmit={() => undefined}>
        <PromptInputBody>
          <PromptInputTextarea aria-label="Episode production request" />
        </PromptInputBody>
        <PromptInputFooter>
          <PromptInputSubmit />
        </PromptInputFooter>
      </PromptInput>,
    );
    expect(markup).toContain('name="message"');
    expect(markup).toContain('aria-label="Episode production request"');
  });
});
