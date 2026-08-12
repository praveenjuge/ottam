"use client";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { cn } from "@/lib/utils";
import type { ChatStatus } from "ai";
import { CornerDownLeftIcon, SquareIcon, XIcon } from "lucide-react";
import {
  useCallback,
  useState,
  type ComponentProps,
  type HTMLAttributes,
  type KeyboardEventHandler,
  type SyntheticEvent,
} from "react";

export interface PromptInputMessage {
  text: string;
}

export interface PromptInputProps extends Omit<
  HTMLAttributes<HTMLFormElement>,
  "onSubmit"
> {
  onSubmit: (
    message: PromptInputMessage,
    event: SyntheticEvent<HTMLFormElement>,
  ) => void | Promise<void>;
}

export function PromptInput({
  children,
  className,
  onSubmit,
  ...props
}: PromptInputProps) {
  const handleSubmit = useCallback(
    (event: SyntheticEvent<HTMLFormElement>) => {
      event.preventDefault();
      const form = event.currentTarget;
      const data = new FormData(form);
      const rawText = data.get("message");
      const text = typeof rawText === "string" ? rawText.trim() : "";
      if (!text) return;
      void Promise.resolve(onSubmit({ text }, event)).then(() => {
        form.reset();
      });
    },
    [onSubmit],
  );

  return (
    <form
      className={cn("w-full", className)}
      onSubmit={handleSubmit}
      {...props}
    >
      <InputGroup className="h-auto min-h-12 overflow-hidden">
        {children}
      </InputGroup>
    </form>
  );
}

export type PromptInputBodyProps = HTMLAttributes<HTMLDivElement>;

export function PromptInputBody({ className, ...props }: PromptInputBodyProps) {
  return <div className={cn("contents", className)} {...props} />;
}

export type PromptInputTextareaProps = ComponentProps<
  typeof InputGroupTextarea
>;

export function PromptInputTextarea({
  className,
  onKeyDown,
  placeholder = "What would you like to make?",
  ...props
}: PromptInputTextareaProps) {
  const [isComposing, setIsComposing] = useState(false);
  const handleKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = useCallback(
    (event) => {
      onKeyDown?.(event);
      if (event.defaultPrevented || event.key !== "Enter" || event.shiftKey)
        return;
      if (isComposing || event.nativeEvent.isComposing) return;
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    },
    [isComposing, onKeyDown],
  );

  return (
    <InputGroupTextarea
      className={cn("min-h-20 max-h-48 px-3 py-3", className)}
      name="message"
      onCompositionEnd={() => {
        setIsComposing(false);
      }}
      onCompositionStart={() => {
        setIsComposing(true);
      }}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      {...props}
    />
  );
}

export type PromptInputFooterProps = ComponentProps<typeof InputGroupAddon>;

export function PromptInputFooter({
  className,
  ...props
}: PromptInputFooterProps) {
  return (
    <InputGroupAddon
      align="block-end"
      className={cn("justify-between", className)}
      {...props}
    />
  );
}

export interface PromptInputSubmitProps extends Omit<
  ComponentProps<typeof InputGroupButton>,
  "size"
> {
  onStop?: () => void;
  status?: ChatStatus;
}

export function PromptInputSubmit({
  children,
  className,
  onClick,
  onStop,
  status,
  ...props
}: PromptInputSubmitProps) {
  const isGenerating = status === "submitted" || status === "streaming";
  const icon =
    children ??
    (status === "streaming" ? (
      <SquareIcon className="size-4" />
    ) : status === "error" ? (
      <XIcon className="size-4" />
    ) : (
      <CornerDownLeftIcon className="size-4" />
    ));

  return (
    <InputGroupButton
      aria-label={isGenerating ? "Stop generation" : "Send message"}
      className={cn(className)}
      onClick={(event) => {
        if (isGenerating && onStop) {
          event.preventDefault();
          onStop();
          return;
        }
        onClick?.(event);
      }}
      size="icon-sm"
      type="submit"
      {...props}
    >
      {icon}
    </InputGroupButton>
  );
}
