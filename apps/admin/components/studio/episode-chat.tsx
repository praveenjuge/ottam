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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
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
import type { ProductionMessage } from "@/lib/production-agent";
import { generationRequestSchema } from "@/lib/media/generation-contract";
import { audioAssignmentSchema } from "@/lib/media/audio-assignment";
import { AudioGenerationDiff } from "./audio-generation-diff";
import { AudioAssignmentDiff } from "./audio-assignment-diff";
import { CandidateAudio } from "./candidate-audio";
import { ChangeDiff } from "./change-diff";
import { ReleasePanel } from "./release-panel";

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

function audioToolInput(part: StudioToolPart): {
  requestHash: string;
  toolInvocationId: Id<"toolInvocations">;
} | null {
  if (!part.type.endsWith("generateAudioCandidates")) return null;
  const value = "input" in part ? part.input : undefined;
  if (
    value === null ||
    typeof value !== "object" ||
    !("requestHash" in value) ||
    !("toolInvocationId" in value) ||
    typeof value.requestHash !== "string" ||
    typeof value.toolInvocationId !== "string"
  ) {
    throw new Error("Invalid audio generation input.");
  }
  return {
    requestHash: value.requestHash,
    toolInvocationId: value.toolInvocationId as Id<"toolInvocations">,
  };
}

function assignmentToolInput(part: StudioToolPart): {
  assignmentHash: string;
  toolInvocationId: Id<"toolInvocations">;
} | null {
  if (!part.type.endsWith("applyAudioAssignment")) return null;
  const value = "input" in part ? part.input : undefined;
  if (
    value === null ||
    typeof value !== "object" ||
    !("assignmentHash" in value) ||
    !("toolInvocationId" in value) ||
    typeof value.assignmentHash !== "string" ||
    typeof value.toolInvocationId !== "string"
  ) {
    throw new Error("Invalid audio assignment input.");
  }
  return {
    assignmentHash: value.assignmentHash,
    toolInvocationId: value.toolInvocationId as Id<"toolInvocations">,
  };
}

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
  const approveAudio = useAction(api.mediaActions.approveAudioGeneration);
  const rejectAudio = useAction(api.mediaActions.rejectAudioGeneration);
  const approveAssignment = useAction(api.mediaActions.approveAudioAssignment);
  const [decisionPending, setDecisionPending] = useState(false);
  const proposal = proposalForApply(part, workspace);
  const audioInput = audioToolInput(part);
  const assignmentInput = assignmentToolInput(part);
  const audioInvocation = audioInput
    ? workspace.toolInvocations.find(
        (invocation) => invocation._id === audioInput.toolInvocationId,
      )
    : undefined;
  const audioRequest = audioInvocation
    ? generationRequestSchema.parse(
        JSON.parse(audioInvocation.inputJson) as unknown,
      )
    : undefined;
  const assignmentInvocation = assignmentInput
    ? workspace.toolInvocations.find(
        (invocation) => invocation._id === assignmentInput.toolInvocationId,
      )
    : undefined;
  const assignment = assignmentInvocation
    ? audioAssignmentSchema.parse(
        JSON.parse(assignmentInvocation.inputJson) as unknown,
      )
    : undefined;
  const voice = audioRequest
    ? workspace.voices.find(
        (candidate) => candidate._id === audioRequest.voiceId,
      )
    : undefined;

  async function decide(approved: boolean) {
    if (part.state !== "approval-requested" || part.approval.isAutomatic) {
      return;
    }
    setDecisionPending(true);
    try {
      if (part.type.endsWith("applyChangeSet")) {
        const input = applyInputSchema.parse(
          "input" in part ? part.input : undefined,
        );
        if (approved) {
          await approveChangeSet({
            changeSetId: input.changeSetId,
            expectedEpisodeId: episodeId,
            expectedProposalHash: input.expectedProposalHash,
          });
        } else {
          await rejectChangeSet({ changeSetId: input.changeSetId });
        }
      } else if (assignmentInput) {
        if (approved) {
          await approveAssignment({
            assignmentHash: assignmentInput.assignmentHash,
            episodeId,
            toolInvocationId: assignmentInput.toolInvocationId,
          });
        } else {
          await rejectAudio({
            toolInvocationId: assignmentInput.toolInvocationId,
          });
        }
      } else if (audioInput) {
        if (approved) {
          await approveAudio({
            episodeId,
            requestHash: audioInput.requestHash,
            toolInvocationId: audioInput.toolInvocationId,
          });
        } else {
          await rejectAudio({ toolInvocationId: audioInput.toolInvocationId });
        }
      } else {
        throw new Error("This tool does not support human approval.");
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
        ) : assignment ? (
          <AudioAssignmentDiff assignment={assignment} />
        ) : audioRequest ? (
          <AudioGenerationDiff
            request={audioRequest}
            voiceName={voice?.displayName ?? "Approved library voice"}
          />
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
    <section
      className="grid min-h-0 grid-rows-[minmax(0,1fr)_auto_auto] px-5 pb-4"
      aria-label="Episode production chat"
    >
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
      {error ? (
        <p aria-live="polite" className="py-2 text-sm text-destructive">
          {error.message}
        </p>
      ) : null}
      <PromptInput
        className="mx-auto w-full max-w-3xl bg-card"
        onSubmit={({ text }) => {
          if (text.trim()) void sendMessage({ text: text.trim() });
        }}
      >
        <PromptInputBody>
          <PromptInputTextarea
            aria-label="Episode production request"
            autoComplete="off"
            name="request"
            placeholder="Develop the transcript, check continuity, or preview a duration…"
          />
        </PromptInputBody>
        <PromptInputFooter>
          <span className="self-center pl-2 text-xs text-muted-foreground">
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
    <aside
      aria-labelledby="inspector-heading"
      className="grid content-start gap-5 overflow-y-auto border-l bg-sidebar p-5 max-[70rem]:hidden"
    >
      <h2
        className="text-xs font-medium text-muted-foreground"
        id="inspector-heading"
      >
        Episode state
      </h2>
      <dl className="grid gap-3 text-sm">
        <div className="flex justify-between gap-4">
          <dt>Revision</dt>
          <dd>{workspace.revisions[0]?.revisionNumber ?? 0}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>Scenes</dt>
          <dd>{workspace.scenes.length}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>Audio</dt>
          <dd>{workspace.audioAssets.length}</dd>
        </div>
        <div className="flex justify-between gap-4">
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
      <Separator />
      <ReleasePanel episodeId={workspace.episode._id} />
      <section className="grid gap-2">
        <h2 className="text-sm font-medium">Recent proposals</h2>
        {workspace.changeSets.length === 0 ? (
          <p className="text-sm text-muted-foreground">No proposals yet.</p>
        ) : (
          workspace.changeSets.slice(0, 8).map((changeSet) => (
            <article
              className="flex justify-between gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
              key={changeSet._id}
            >
              <span className="min-w-0 truncate">
                {parseStoredProposal(changeSet.changeJson).summary}
              </span>
              <small className="text-muted-foreground">
                {changeSet.status}
              </small>
            </article>
          ))
        )}
      </section>
      <section className="grid gap-3">
        <h2 className="text-sm font-medium">Audio candidates</h2>
        {workspace.audioAssets.filter((asset) => asset.status === "candidate")
          .length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No generated candidates.
          </p>
        ) : (
          workspace.audioAssets
            .filter((asset) => asset.status === "candidate")
            .map((asset) => (
              <article className="grid gap-2" key={asset._id}>
                <span className="truncate text-xs text-muted-foreground">
                  {asset.immutableKey.split("/").at(-1)}
                </span>
                <CandidateAudio
                  assetId={asset._id}
                  episodeId={workspace.episode._id}
                />
              </article>
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

  if (!workspace)
    return (
      <main
        className="grid min-h-svh place-items-center text-sm text-muted-foreground"
        id="main-content"
      >
        Loading episode…
      </main>
    );
  return (
    <main
      className="grid h-svh min-w-0 grid-cols-[minmax(28rem,1fr)_18rem] grid-rows-[auto_minmax(0,1fr)] max-[70rem]:grid-cols-1"
      id="main-content"
    >
      <header className="col-span-full flex min-h-19 items-center justify-between gap-4 border-b px-5 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <SidebarTrigger />
          <div className="min-w-0">
            <p className="truncate text-xs text-muted-foreground">
              {workspace.series?.title ?? "Series"} · Episode{" "}
              {String(workspace.episode.sequence).padStart(2, "0")}
            </p>
            <h1 className="truncate text-lg font-semibold tracking-tight">
              {workspace.episode.title}
            </h1>
          </div>
        </div>
        <Badge variant="outline">{workspace.episode.status}</Badge>
      </header>
      {workspace.chat ? (
        <ChatSurface
          chatId={workspace.chat._id}
          episodeId={episodeId}
          workspace={workspace}
        />
      ) : (
        <p className="grid place-items-center text-sm text-muted-foreground">
          Creating persistent chat…
        </p>
      )}
      <Inspector workspace={workspace} />
    </main>
  );
}
