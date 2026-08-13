import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const contentStatus = v.union(
  v.literal("draft"),
  v.literal("review"),
  v.literal("published"),
  v.literal("archived"),
);

const movementState = v.union(
  v.literal("walking"),
  v.literal("running"),
  v.literal("stationary"),
);

export default defineSchema({
  listenerProfiles: defineTable({
    clerkSubject: v.string(),
    createdAt: v.number(),
    email: v.optional(v.string()),
    guestMergeIdempotencyKey: v.optional(v.string()),
    preferredGenres: v.array(v.string()),
    updatedAt: v.number(),
  }).index("by_clerk_subject", ["clerkSubject"]),

  series: defineTable({
    artworkAssetId: v.optional(v.id("audioAssets")),
    createdAt: v.number(),
    description: v.string(),
    genre: v.string(),
    slug: v.string(),
    status: contentStatus,
    title: v.string(),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_status", ["status"]),

  episodes: defineTable({
    createdAt: v.number(),
    currentRevisionId: v.optional(v.id("episodeRevisions")),
    publishedReleaseId: v.optional(v.id("episodeReleases")),
    sequence: v.number(),
    seriesId: v.id("series"),
    slug: v.string(),
    status: contentStatus,
    synopsis: v.string(),
    title: v.string(),
    updatedAt: v.number(),
  })
    .index("by_series_and_sequence", ["seriesId", "sequence"])
    .index("by_series_and_slug", ["seriesId", "slug"])
    .index("by_status", ["status"]),

  scenes: defineTable({
    durationSeconds: v.number(),
    earliestSecond: v.optional(v.number()),
    episodeId: v.id("episodes"),
    kind: v.union(
      v.literal("core"),
      v.literal("optional"),
      v.literal("reactive"),
    ),
    latestSecond: v.optional(v.number()),
    optionalPriority: v.optional(v.number()),
    script: v.string(),
    sortOrder: v.number(),
    stableKey: v.string(),
    title: v.string(),
    updatedAt: v.number(),
  })
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

  voices: defineTable({
    displayName: v.string(),
    elevenLabsVoiceId: v.string(),
    licenseReference: v.string(),
    provenance: v.string(),
    status: v.union(v.literal("approved"), v.literal("retired")),
    updatedAt: v.number(),
  }).index("by_provider_id", ["elevenLabsVoiceId"]),

  audioAssets: defineTable({
    bucket: v.union(v.literal("editorial"), v.literal("releases")),
    bytes: v.number(),
    checksumSha256: v.string(),
    createdAt: v.number(),
    durationSeconds: v.number(),
    episodeId: v.id("episodes"),
    immutableKey: v.string(),
    mimeType: v.string(),
    provenanceJson: v.string(),
    sceneId: v.optional(v.id("scenes")),
    status: v.union(
      v.literal("candidate"),
      v.literal("approved"),
      v.literal("released"),
      v.literal("rejected"),
    ),
    variant: v.optional(movementState),
  })
    .index("by_immutable_key", ["immutableKey"])
    .index("by_episode_and_status", ["episodeId", "status"])
    .index("by_scene", ["sceneId"]),

  episodeRevisions: defineTable({
    createdAt: v.number(),
    createdBy: v.string(),
    episodeId: v.id("episodes"),
    parentRevisionId: v.optional(v.id("episodeRevisions")),
    revisionNumber: v.number(),
    snapshotHash: v.string(),
    snapshotJson: v.string(),
    sourceChangeSetId: v.optional(v.id("changeSets")),
  })
    .index("by_episode_and_number", ["episodeId", "revisionNumber"])
    .index("by_snapshot_hash", ["snapshotHash"]),

  episodeReleases: defineTable({
    assetKeys: v.array(v.string()),
    createdAt: v.number(),
    episodeId: v.id("episodes"),
    idempotencyKey: v.string(),
    manifestChecksumSha256: v.optional(v.string()),
    manifestKey: v.optional(v.string()),
    publishedAt: v.optional(v.number()),
    publishedBy: v.optional(v.string()),
    releaseNumber: v.number(),
    revisionId: v.id("episodeRevisions"),
    status: v.union(
      v.literal("staging"),
      v.literal("published"),
      v.literal("failed"),
    ),
    validationReportJson: v.optional(v.string()),
  })
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

  productionChats: defineTable({
    createdAt: v.number(),
    episodeId: v.id("episodes"),
    updatedAt: v.number(),
  }).index("by_episode", ["episodeId"]),

  chatMessages: defineTable({
    chatId: v.id("productionChats"),
    contentJson: v.string(),
    createdAt: v.number(),
    messageId: v.string(),
    role: v.union(v.literal("user"), v.literal("assistant"), v.literal("tool")),
    sequence: v.number(),
  })
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

  toolInvocations: defineTable({
    agentRunId: v.id("agentRuns"),
    approvalRequired: v.boolean(),
    baseRevisionId: v.id("episodeRevisions"),
    approvedAt: v.optional(v.number()),
    approvedBy: v.optional(v.string()),
    completedAt: v.optional(v.number()),
    episodeId: v.id("episodes"),
    idempotencyKey: v.string(),
    inputJson: v.string(),
    outputJson: v.optional(v.string()),
    startedAt: v.number(),
    status: v.union(
      v.literal("proposed"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    toolName: v.string(),
  })
    .index("by_idempotency_key", ["idempotencyKey"])
    .index("by_episode_and_started", ["episodeId", "startedAt"]),

  changeSets: defineTable({
    appliedRevisionId: v.optional(v.id("episodeRevisions")),
    baseRevisionId: v.id("episodeRevisions"),
    changeJson: v.string(),
    createdAt: v.number(),
    episodeId: v.id("episodes"),
    proposalHash: v.string(),
    proposedBy: v.string(),
    reviewedAt: v.optional(v.number()),
    reviewedBy: v.optional(v.string()),
    status: v.union(
      v.literal("proposed"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("applied"),
      v.literal("stale"),
    ),
  })
    .index("by_episode_and_created", ["episodeId", "createdAt"])
    .index("by_proposal_hash", ["proposalHash"]),

  generationJobs: defineTable({
    candidateAssetIds: v.array(v.id("audioAssets")),
    completedAt: v.optional(v.number()),
    createdAt: v.number(),
    dailyCreditDate: v.string(),
    episodeId: v.id("episodes"),
    estimatedCredits: v.number(),
    idempotencyKey: v.string(),
    maxCandidates: v.number(),
    providerRequestId: v.optional(v.string()),
    requestJson: v.string(),
    status: v.union(
      v.literal("approved"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("ambiguous"),
      v.literal("failed"),
    ),
    toolInvocationId: v.id("toolInvocations"),
  })
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
