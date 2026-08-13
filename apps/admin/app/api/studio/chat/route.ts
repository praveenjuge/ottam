import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import {
  consumeStream,
  createAgentUIStreamResponse,
  safeValidateUIMessages,
  type InferUITools,
  type UIDataTypes,
  type UIMessage,
} from "ai";
import { nanoid } from "nanoid";
import { z } from "zod";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { mergeIncomingMessage } from "@/lib/chat-message-policy";
import {
  createProductionAgent,
  type ProductionMessage,
  type ProductionTools,
} from "@/lib/production-agent";
import { getStudioModelLabel } from "@/lib/studio-model";

export const maxDuration = 300;
const maximumRequestBytes = 256_000;
const opaqueIdPattern = /^[A-Za-z0-9_-]{8,128}$/;

type ValidatableProductionMessage = UIMessage<
  unknown,
  UIDataTypes,
  InferUITools<ProductionTools>
>;

const messageEnvelopeSchema = z.looseObject({
  id: z.string().regex(opaqueIdPattern),
  parts: z.array(z.unknown()).min(1).max(128),
  role: z.enum(["user", "assistant"]),
});

const requestSchema = z
  .object({
    chatId: z.string().min(1).max(128),
    episodeId: z.string().min(1).max(128),
    message: z.unknown(),
  })
  .strict();

function jsonError(message: string, status: number): Response {
  return Response.json(
    { error: message },
    { headers: { "Cache-Control": "no-store" }, status },
  );
}

async function readRequest(request: Request) {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maximumRequestBytes) {
    return null;
  }
  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > maximumRequestBytes) {
    return null;
  }
  return requestSchema.parse(JSON.parse(body) as unknown);
}

function parseStoredMessages(
  rows: { contentJson: string }[],
): ProductionMessage[] {
  return rows.map((row) => JSON.parse(row.contentJson) as ProductionMessage);
}

export async function POST(request: Request): Promise<Response> {
  const session = await auth();
  if (!session.userId) return jsonError("Sign in is required.", 401);
  const convexToken =
    session.sessionClaims.aud === "convex"
      ? await session.getToken()
      : await session.getToken({ template: "convex" });
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexToken || !convexUrl) {
    return jsonError("Studio authentication is not configured.", 503);
  }

  let parsedRequest: z.infer<typeof requestSchema> | null;
  try {
    parsedRequest = await readRequest(request);
  } catch {
    return jsonError("Invalid studio chat request.", 400);
  }
  if (!parsedRequest) {
    return jsonError("Studio chat request is too large.", 413);
  }

  const episodeId = parsedRequest.episodeId as Id<"episodes">;
  const chatId = parsedRequest.chatId as Id<"productionChats">;
  const client = new ConvexHttpClient(convexUrl);
  client.setAuth(convexToken);

  let activeRunId: string | undefined;
  try {
    const workspace = await client.query(api.studio.workspace, { episodeId });
    if (workspace.chat?._id !== chatId) {
      return jsonError("Chat does not belong to the selected episode.", 403);
    }
    const incomingEnvelope = messageEnvelopeSchema.parse(parsedRequest.message);
    const incoming = incomingEnvelope as ProductionMessage;
    const persisted = parseStoredMessages(workspace.messages);
    const messages = mergeIncomingMessage(persisted, incoming);
    const runId = `run_${nanoid(20)}`;
    const model = getStudioModelLabel();
    const agentRunId = await client.action(api.studioActions.beginAgentRun, {
      ...(workspace.episode.currentRevisionId
        ? { baseRevisionId: workspace.episode.currentRevisionId }
        : {}),
      chatId,
      model,
      runId,
    });
    activeRunId = runId;
    let inputTokens = 0;
    let outputTokens = 0;
    const agent = createProductionAgent({
      actorSubject: session.userId,
      agentRunId,
      client,
      episodeId,
    });
    const validation =
      await safeValidateUIMessages<ValidatableProductionMessage>({
        messages,
        tools: agent.tools,
      });
    if (!validation.success) {
      await client.action(api.studioActions.finishAgentRun, {
        runId,
        status: "failed",
      });
      activeRunId = undefined;
      return jsonError("Invalid production chat message.", 400);
    }
    const acceptedIncoming = validation.data.find(
      (message) => message.id === incoming.id,
    );
    if (!acceptedIncoming) {
      throw new Error(
        "The incoming message was not retained after validation.",
      );
    }
    await client.action(api.studioActions.saveMessage, {
      chatId,
      contentJson: JSON.stringify(acceptedIncoming),
      messageId: incoming.id,
      role: incomingEnvelope.role,
    });

    return await createAgentUIStreamResponse({
      agent,
      consumeSseStream: consumeStream,
      generateMessageId: () => `message_${nanoid(20)}`,
      onEnd: async ({ isAborted, responseMessage }) => {
        try {
          await client.action(api.studioActions.saveMessage, {
            chatId,
            contentJson: JSON.stringify(responseMessage),
            messageId: responseMessage.id,
            role: "assistant",
          });
          await client.action(api.studioActions.finishAgentRun, {
            outputTokens,
            promptTokens: inputTokens,
            runId,
            status: isAborted ? "cancelled" : "completed",
          });
        } catch (error) {
          await client.action(api.studioActions.finishAgentRun, {
            runId,
            status: "failed",
          });
          throw error;
        }
      },
      onError: () => "The production agent could not complete this turn.",
      onStepEnd: ({ usage }) => {
        inputTokens += usage.inputTokens ?? 0;
        outputTokens += usage.outputTokens ?? 0;
      },
      originalMessages: validation.data as ProductionMessage[],
      timeout: { totalMs: 240_000 },
      uiMessages: validation.data,
    });
  } catch {
    if (activeRunId) {
      try {
        await client.action(api.studioActions.finishAgentRun, {
          runId: activeRunId,
          status: "failed",
        });
      } catch {
        // Preserve the original failure response; Convex logs the cleanup error.
      }
    }
    return jsonError("Studio request failed.", 500);
  }
}
