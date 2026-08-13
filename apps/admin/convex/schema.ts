import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  audioAssetFields,
  changeSetFields,
  chatMessageFields,
  episodeFields,
  episodeReleaseFields,
  episodeRevisionFields,
  generationJobFields,
  productionChatFields,
  sceneFields,
  seriesFields,
  toolInvocationFields,
  voiceFields,
} from "./lib/documentValidators";

export default defineSchema({
  listenerProfiles: defineTable({
    clerkSubject: v.string(),
    createdAt: v.number(),
    email: v.optional(v.string()),
    guestMergeIdempotencyKey: v.optional(v.string()),
    preferredGenres: v.array(v.string()),
    updatedAt: v.number(),
  }).index("by_clerk_subject", ["clerkSubject"]),

  series: defineTable(seriesFields)
    .index("by_slug", ["slug"])
    .index("by_status", ["status"]),

  episodes: defineTable(episodeFields)
    .index("by_series_and_sequence", ["seriesId", "sequence"])
    .index("by_series_and_slug", ["seriesId", "slug"])
    .index("by_status", ["status"]),

  scenes: defineTable(sceneFields)
    .index("by_episode_and_order", ["episodeId", "sortOrder"])
    .index("by_episode_and_key", ["episodeId", "stableKey"]),

  characters: defineTable({
    description: v.string(),
    displayName: v.string(),
    episodeId: v.optional(v.id("episodes")),
    seriesId: v.id("series"),
    stableKey: v.string(),
    voiceId: v.optional(v.id("voices")),
  })
    .index("by_series_and_key", ["seriesId", "stableKey"])
    .index("by_episode", ["episodeId"]),

  voices: defineTable(voiceFields)
    .index("by_provider_id", ["elevenLabsVoiceId"])
    .index("by_status", ["status"]),

  audioAssets: defineTable(audioAssetFields)
    .index("by_immutable_key", ["immutableKey"])
    .index("by_episode_and_status", ["episodeId", "status"])
    .index("by_scene", ["sceneId"]),

  episodeRevisions: defineTable(episodeRevisionFields)
    .index("by_episode_and_number", ["episodeId", "revisionNumber"])
    .index("by_snapshot_hash", ["snapshotHash"]),

  episodeReleases: defineTable(episodeReleaseFields)
    .index("by_episode_and_number", ["episodeId", "releaseNumber"])
    .index("by_manifest_key", ["manifestKey"])
    .index("by_idempotency_key", ["idempotencyKey"])
    .index("by_revision", ["revisionId"]),

  episodeProgress: defineTable({
    clientSequence: v.number(),
    completedAt: v.optional(v.number()),
    episodeId: v.id("episodes"),
    listenerSubject: v.string(),
    planDurationMinutes: v.number(),
    planHash: v.string(),
    positionMilliseconds: v.number(),
    releaseId: v.id("episodeReleases"),
    sceneIndex: v.number(),
    updatedAt: v.number(),
  })
    .index("by_listener_and_episode", ["listenerSubject", "episodeId"])
    .index("by_listener_and_updated", ["listenerSubject", "updatedAt"]),

  runSessions: defineTable({
    activeMilliseconds: v.number(),
    completed: v.boolean(),
    distanceMeters: v.optional(v.number()),
    endedAt: v.number(),
    episodeId: v.id("episodes"),
    idempotencyKey: v.string(),
    listenerSubject: v.string(),
    movementSamples: v.object({
      running: v.number(),
      stationary: v.number(),
      walking: v.number(),
    }),
    planHash: v.string(),
    releaseId: v.id("episodeReleases"),
    startedAt: v.number(),
    steps: v.optional(v.number()),
  })
    .index("by_listener_and_idempotency", ["listenerSubject", "idempotencyKey"])
    .index("by_listener_and_started", ["listenerSubject", "startedAt"]),

  productionChats: defineTable(productionChatFields).index("by_episode", [
    "episodeId",
  ]),

  chatMessages: defineTable(chatMessageFields)
    .index("by_chat_and_sequence", ["chatId", "sequence"])
    .index("by_chat_and_message", ["chatId", "messageId"]),

  agentRuns: defineTable({
    baseRevisionId: v.optional(v.id("episodeRevisions")),
    chatId: v.id("productionChats"),
    completedAt: v.optional(v.number()),
    episodeId: v.id("episodes"),
    model: v.string(),
    outputTokens: v.optional(v.number()),
    promptTokens: v.optional(v.number()),
    runId: v.string(),
    startedAt: v.number(),
    status: v.union(
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("cancelled"),
    ),
  })
    .index("by_chat_and_started", ["chatId", "startedAt"])
    .index("by_run_id", ["runId"]),

  toolInvocations: defineTable(toolInvocationFields)
    .index("by_idempotency_key", ["idempotencyKey"])
    .index("by_agent_run", ["agentRunId"])
    .index("by_episode_and_started", ["episodeId", "startedAt"]),

  changeSets: defineTable(changeSetFields)
    .index("by_episode_and_created", ["episodeId", "createdAt"])
    .index("by_proposal_hash", ["proposalHash"]),

  generationJobs: defineTable(generationJobFields)
    .index("by_idempotency_key", ["idempotencyKey"])
    .index("by_credit_date", ["dailyCreditDate"]),

  auditEvents: defineTable({
    actorSubject: v.string(),
    createdAt: v.number(),
    episodeId: v.optional(v.id("episodes")),
    eventType: v.string(),
    immutablePayloadJson: v.string(),
    targetId: v.optional(v.string()),
  })
    .index("by_episode_and_created", ["episodeId", "createdAt"])
    .index("by_actor_and_created", ["actorSubject", "createdAt"]),
});
