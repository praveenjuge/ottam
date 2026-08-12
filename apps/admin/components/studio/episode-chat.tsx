"use client";

import { useChat } from "@ai-sdk/react";
import { useAction, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
  DefaultChatTransport,
  isToolUIPart,
  lastAssistantMessageIsCompleteWithApprovalResponses,
} from "ai";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { parseStoredProposal } from "@/convex/lib/studioPolicy";
import {
  Checkpoint,
  CheckpointIcon,
  CheckpointTrigger,
} from "@/components/ai-elements/checkpoint";
import {
  Confirmation,
  ConfirmationAccepted,
  ConfirmationAction,
  ConfirmationActions,
  ConfirmationRejected,
  ConfirmationRequest,
  ConfirmationTitle,
} from "@/components/ai-elements/confirmation";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import { Button } from "@/components/ui/button";
import type { ProductionMessage } from "@/lib/production-agent";
import { ChangeDiff } from "./change-diff";

type Workspace = FunctionReturnType<typeof api.studio.workspace>;
type MessagePart = ProductionMessage["parts"][number];
type StudioToolPart = Extract<MessagePart, { toolCallId: string }>;

const applyInputSchema = {
  parse(value: unknown): {
    changeSetId: Id<"changeSets">;
    expectedProposalHash: string;
  } {
    if (
      value === null ||
      typeof value !== "object" ||
      !("changeSetId" in value) ||
      !("expectedProposalHash" in value) ||
      typeof value.changeSetId !== "string" ||
      typeof value.expectedProposalHash !== "string"
    ) {
      throw new Error("Invalid apply-change-set input.");
    }
    return {
      changeSetId: value.changeSetId as Id<"changeSets">,
      expectedProposalHash: value.expectedProposalHash,
    };
  },
};

function persistedMessages(workspace: Workspace): ProductionMessage[] {
  return workspace.messages.map(
    (message) => JSON.parse(message.contentJson) as ProductionMessage,
  );
}

function proposalForApply(part: StudioToolPart, workspace: Workspace) {
  if (!part.type.endsWith("applyChangeSet")) {
    return null;
  }
  const input = applyInputSchema.parse(
    "input" in part ? part.input : undefined,
  );
  const changeSet = workspace.changeSets.find(
    (candidate) => candidate._id === input.changeSetId,
  );
  return changeSet ? parseStoredProposal(changeSet.changeJson) : null;
}

function StudioTool({
  episodeId,
  part,
  respond,
  workspace,
}: {
  episodeId: Id<"episodes">;
  part: StudioToolPart;
  respond: (args: { approved: boolean; id: string }) => Promise<void> | void;
  workspace: Workspace;
}) {
  const approveChangeSet = useAction(api.studioActions.approveChangeSet);
  const rejectChangeSet = useAction(api.studioActions.rejectChangeSet);
  const [decisionPending, setDecisionPending] = useState(false);
  const proposal = proposalForApply(part, workspace);

  async function decide(approved: boolean) {
    if (
      !part.type.endsWith("applyChangeSet") ||
      part.state !== "approval-requested" ||
      part.approval.isAutomatic
    ) {
      return;
    }
    const input = applyInputSchema.parse(
      "input" in part ? part.input : undefined,
    );
    setDecisionPending(true);
    try {
      if (approved) {
        await approveChangeSet({
          changeSetId: input.changeSetId,
          expectedEpisodeId: episodeId,
          expectedProposalHash: input.expectedProposalHash,
        });
      } else {
        await rejectChangeSet({
          changeSetId: input.changeSetId,
        });
      }
      await respond({ approved, id: part.approval.id });
    } finally {
      setDecisionPending(false);
    }
  }

  return (
    <Tool defaultOpen={part.state === "approval-requested"}>
      {part.type === "dynamic-tool" ? (
        <ToolHeader
          state={part.state}
          toolName={part.toolName}
          type={part.type}
        />
      ) : (
        <ToolHeader state={part.state} type={part.type} />
      )}
      <ToolContent>
        {proposal ? (
          <ChangeDiff proposal={proposal} />
        ) : (
          <ToolInput input={part.input} />
        )}
        <Confirmation approval={part.approval} state={part.state}>
          <ConfirmationRequest>
            <ConfirmationTitle>
              Review this exact change set. Approval applies it once against the
              shown base revision.
            </ConfirmationTitle>
            <ConfirmationActions>
              <ConfirmationAction
                disabled={decisionPending}
                onClick={() => {
                  void decide(false);
                }}
                variant="outline"
              >
                Reject
              </ConfirmationAction>
              <ConfirmationAction
                disabled={decisionPending}
                onClick={() => {
                  void decide(true);
                }}
              >
                Approve and apply
              </ConfirmationAction>
            </ConfirmationActions>
          </ConfirmationRequest>
          <ConfirmationAccepted>
            Approved by the administrator.
          </ConfirmationAccepted>
          <ConfirmationRejected>
            Rejected. The agent will not retry it.
          </ConfirmationRejected>
        </Confirmation>
        <ToolOutput
          errorText={"errorText" in part ? part.errorText : undefined}
          output={"output" in part ? part.output : undefined}
        />
      </ToolContent>
    </Tool>
  );
}

function ChatMessage({
  episodeId,
  message,
  respond,
  workspace,
}: {
  episodeId: Id<"episodes">;
  message: ProductionMessage;
  respond: (args: { approved: boolean; id: string }) => void;
  workspace: Workspace;
}) {
  return (
    <Message from={message.role}>
      <MessageContent>
        {message.parts.map((part, index) => {
          if (part.type === "text") {
            return (
              <MessageResponse key={`${message.id}-${String(index)}`}>
                {part.text}
              </MessageResponse>
            );
          }
          if (isToolUIPart(part)) {
            return (
              <StudioTool
                episodeId={episodeId}
                key={part.toolCallId}
                part={part}
                respond={respond}
                workspace={workspace}
              />
            );
          }
          return null;
        })}
      </MessageContent>
    </Message>
  );
}

function ChatSurface({
  chatId,
  episodeId,
  workspace,
}: {
  chatId: Id<"productionChats">;
  episodeId: Id<"episodes">;
  workspace: Workspace;
}) {
  const initialMessages = useMemo(
    () => persistedMessages(workspace),
    [workspace],
  );
  const transport = useMemo(
    () =>
      new DefaultChatTransport<ProductionMessage>({
        api: "/api/studio/chat",
        prepareSendMessagesRequest: ({ messages }) => ({
          body: {
            chatId,
            episodeId,
            message: messages.at(-1),
          },
        }),
      }),
    [chatId, episodeId],
  );
  const {
    addToolApprovalResponse,
    error,
    messages,
    sendMessage,
    status,
    stop,
  } = useChat<ProductionMessage>({
    id: chatId,
    messages: initialMessages,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    transport,
  });

  return (
    <section className="chat-column" aria-label="Episode production chat">
      <Conversation>
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState
              description="Ask for an outline, transcript, scene revision, or duration validation. Nothing is applied without your approval."
              title="Develop this episode in chat"
            />
          ) : (
            messages.map((message) => (
              <ChatMessage
                episodeId={episodeId}
                key={message.id}
                message={message}
                respond={(response) => {
                  void addToolApprovalResponse(response);
                }}
                workspace={workspace}
              />
            ))
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      {error ? <p className="chat-error">{error.message}</p> : null}
      <PromptInput
        className="studio-prompt"
        onSubmit={({ text }) => {
          if (text.trim()) void sendMessage({ text: text.trim() });
        }}
      >
        <PromptInputBody>
          <PromptInputTextarea placeholder="Develop the transcript, check continuity, or preview a duration…" />
        </PromptInputBody>
        <PromptInputFooter>
          <span className="model-label">
            DeepSeek V4 Flash · episode scoped
          </span>
          <PromptInputSubmit
            onStop={() => {
              void stop();
            }}
            status={status}
          />
        </PromptInputFooter>
      </PromptInput>
    </section>
  );
}

function Inspector({ workspace }: { workspace: Workspace }) {
  const validationReady =
    workspace.audioAssets.length > 0 && workspace.scenes.length > 0;
  return (
    <aside className="studio-inspector">
      <p className="nav-label">Episode state</p>
      <dl className="episode-facts">
        <div>
          <dt>Revision</dt>
          <dd>{workspace.revisions[0]?.revisionNumber ?? 0}</dd>
        </div>
        <div>
          <dt>Scenes</dt>
          <dd>{workspace.scenes.length}</dd>
        </div>
        <div>
          <dt>Audio</dt>
          <dd>{workspace.audioAssets.length}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{workspace.episode.status}</dd>
        </div>
      </dl>
      <Checkpoint>
        <CheckpointIcon />
        <CheckpointTrigger
          disabled={!validationReady}
          tooltip="Validation requires approved scene audio."
        >
          15–60 min validation
        </CheckpointTrigger>
      </Checkpoint>
      <section className="proposal-list">
        <h2>Recent proposals</h2>
        {workspace.changeSets.length === 0 ? (
          <p>No proposals yet.</p>
        ) : (
          workspace.changeSets.slice(0, 8).map((changeSet) => (
            <Button
              className="proposal-row"
              key={changeSet._id}
              variant="ghost"
            >
              <span>{parseStoredProposal(changeSet.changeJson).summary}</span>
              <small>{changeSet.status}</small>
            </Button>
          ))
        )}
      </section>
    </aside>
  );
}

export function EpisodeChat({ episodeId }: { episodeId: Id<"episodes"> }) {
  const workspace = useQuery(api.studio.workspace, { episodeId });
  const ensureChat = useAction(api.studioActions.ensureChat);

  useEffect(() => {
    if (workspace && !workspace.chat) void ensureChat({ episodeId });
  }, [ensureChat, episodeId, workspace]);

  if (!workspace) return <p className="loading-state">Loading episode…</p>;
  return (
    <section className="episode-workspace">
      <header className="episode-header">
        <div>
          <p>
            {workspace.series?.title ?? "Series"} · Episode{" "}
            {String(workspace.episode.sequence).padStart(2, "0")}
          </p>
          <h1>{workspace.episode.title}</h1>
        </div>
        <span className="status-pill">{workspace.episode.status}</span>
      </header>
      {workspace.chat ? (
        <ChatSurface
          chatId={workspace.chat._id}
          episodeId={episodeId}
          workspace={workspace}
        />
      ) : (
        <p className="loading-state">Creating persistent chat…</p>
      )}
      <Inspector workspace={workspace} />
    </section>
  );
}
