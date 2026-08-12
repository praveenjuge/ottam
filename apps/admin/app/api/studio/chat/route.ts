import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { consumeStream, createAgentUIStreamResponse } from "ai";
import { nanoid } from "nanoid";
import { z } from "zod";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  createProductionAgent,
  type ProductionMessage,
} from "@/lib/production-agent";
import { getStudioModelId } from "@/lib/studio-model";

export const maxDuration = 300;

const requestSchema = z
  .object({
    chatId: z.string().min(1).max(128),
    episodeId: z.string().min(1).max(128),
    message: z.unknown(),
  })
  .strict();

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

function parseStoredMessages(
  rows: { contentJson: string }[],
): ProductionMessage[] {
  return rows.map((row) => JSON.parse(row.contentJson) as ProductionMessage);
}

function mergeIncomingMessage(
  persisted: ProductionMessage[],
  incoming: ProductionMessage,
): ProductionMessage[] {
  if (incoming.role !== "user" && incoming.role !== "assistant") {
    throw new Error("Only user or assistant chat messages are accepted.");
  }
  const existingIndex = persisted.findIndex(
    (message) => message.id === incoming.id,
  );
  if (existingIndex === -1) return [...persisted, incoming];
  if (persisted[existingIndex]?.role !== incoming.role) {
    throw new Error("A persisted message role cannot be changed.");
  }
  return persisted.map((message, index) =>
    index === existingIndex ? incoming : message,
  );
}

export async function POST(request: Request): Promise<Response> {
  const session = await auth();
  if (!session.userId) return jsonError("Sign in is required.", 401);
  const convexToken = await session.getToken({ template: "convex" });
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexToken || !convexUrl) {
    return jsonError("Studio authentication is not configured.", 503);
  }

  let parsedRequest: z.infer<typeof requestSchema>;
  try {
    parsedRequest = requestSchema.parse(await request.json());
  } catch {
    return jsonError("Invalid studio chat request.", 400);
  }

  const episodeId = parsedRequest.episodeId as Id<"episodes">;
  const chatId = parsedRequest.chatId as Id<"productionChats">;
  const client = new ConvexHttpClient(convexUrl);
  client.setAuth(convexToken);

  try {
    const workspace = await client.query(api.studio.workspace, { episodeId });
    if (workspace.chat?._id !== chatId) {
      return jsonError("Chat does not belong to the selected episode.", 403);
    }
    const incoming = parsedRequest.message as ProductionMessage;
    const persisted = parseStoredMessages(workspace.messages);
    const messages = mergeIncomingMessage(persisted, incoming);
    await client.action(api.studioActions.saveMessage, {
      chatId,
      contentJson: JSON.stringify(incoming),
      messageId: incoming.id,
      role: incoming.role === "user" ? "user" : "assistant",
    });

    const runId = `run_${nanoid(20)}`;
    const model = getStudioModelId();
    await client.action(api.studioActions.beginAgentRun, {
      ...(workspace.episode.currentRevisionId
        ? { baseRevisionId: workspace.episode.currentRevisionId }
        : {}),
      chatId,
      model,
      runId,
    });
    let inputTokens = 0;
    let outputTokens = 0;
    const agent = createProductionAgent({
      actorSubject: session.userId,
      client,
      episodeId,
    });

    return await createAgentUIStreamResponse({
      agent,
      consumeSseStream: consumeStream,
      onEnd: async ({ isAborted, responseMessage }) => {
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
      },
      onError: () => "The production agent could not complete this turn.",
      onStepEnd: ({ usage }) => {
        inputTokens += usage.inputTokens ?? 0;
        outputTokens += usage.outputTokens ?? 0;
      },
      originalMessages: messages,
      timeout: { totalMs: 240_000 },
      uiMessages: messages,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Studio request failed.";
    return jsonError(message, 400);
  }
}
