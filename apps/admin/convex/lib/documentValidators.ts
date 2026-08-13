import { v } from "convex/values";

export const contentStatus = v.union(
  v.literal("draft"),
  v.literal("review"),
  v.literal("published"),
  v.literal("archived"),
);

export const movementState = v.union(
  v.literal("walking"),
  v.literal("running"),
  v.literal("stationary"),
);

export const seriesFields = {
  artworkAssetId: v.optional(v.id("audioAssets")),
  createdAt: v.number(),
  description: v.string(),
  genre: v.string(),
  slug: v.string(),
  status: contentStatus,
  title: v.string(),
  updatedAt: v.number(),
};
export const seriesDocument = v.object({
  _creationTime: v.number(),
  _id: v.id("series"),
  ...seriesFields,
});

export const episodeFields = {
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
};
export const episodeDocument = v.object({
  _creationTime: v.number(),
  _id: v.id("episodes"),
  ...episodeFields,
});

export const sceneKind = v.union(
  v.literal("core"),
  v.literal("optional"),
  v.literal("reactive"),
);
export const sceneFields = {
  durationSeconds: v.number(),
  earliestSecond: v.optional(v.number()),
  episodeId: v.id("episodes"),
  kind: sceneKind,
  latestSecond: v.optional(v.number()),
  optionalPriority: v.optional(v.number()),
  script: v.string(),
  sortOrder: v.number(),
  stableKey: v.string(),
  title: v.string(),
  updatedAt: v.number(),
};
export const sceneDocument = v.object({
  _creationTime: v.number(),
  _id: v.id("scenes"),
  ...sceneFields,
});

export const voiceFields = {
  displayName: v.string(),
  elevenLabsVoiceId: v.string(),
  licenseReference: v.string(),
  provenance: v.string(),
  status: v.union(v.literal("approved"), v.literal("retired")),
  updatedAt: v.number(),
};
export const voiceDocument = v.object({
  _creationTime: v.number(),
  _id: v.id("voices"),
  ...voiceFields,
});

export const audioAssetFields = {
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
};
export const audioAssetDocument = v.object({
  _creationTime: v.number(),
  _id: v.id("audioAssets"),
  ...audioAssetFields,
});

export const episodeRevisionFields = {
  createdAt: v.number(),
  createdBy: v.string(),
  episodeId: v.id("episodes"),
  parentRevisionId: v.optional(v.id("episodeRevisions")),
  revisionNumber: v.number(),
  snapshotHash: v.string(),
  snapshotJson: v.string(),
  sourceChangeSetId: v.optional(v.id("changeSets")),
};
export const episodeRevisionDocument = v.object({
  _creationTime: v.number(),
  _id: v.id("episodeRevisions"),
  ...episodeRevisionFields,
});

export const episodeReleaseFields = {
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
};
export const episodeReleaseDocument = v.object({
  _creationTime: v.number(),
  _id: v.id("episodeReleases"),
  ...episodeReleaseFields,
});

export const productionChatFields = {
  createdAt: v.number(),
  episodeId: v.id("episodes"),
  updatedAt: v.number(),
};
export const productionChatDocument = v.object({
  _creationTime: v.number(),
  _id: v.id("productionChats"),
  ...productionChatFields,
});

export const chatMessageFields = {
  chatId: v.id("productionChats"),
  contentJson: v.string(),
  createdAt: v.number(),
  messageId: v.string(),
  role: v.union(v.literal("user"), v.literal("assistant"), v.literal("tool")),
  sequence: v.number(),
};
export const chatMessageDocument = v.object({
  _creationTime: v.number(),
  _id: v.id("chatMessages"),
  ...chatMessageFields,
});

export const toolInvocationStatus = v.union(
  v.literal("proposed"),
  v.literal("approved"),
  v.literal("rejected"),
  v.literal("running"),
  v.literal("completed"),
  v.literal("failed"),
);
export const toolInvocationFields = {
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
  status: toolInvocationStatus,
  toolName: v.string(),
};
export const toolInvocationDocument = v.object({
  _creationTime: v.number(),
  _id: v.id("toolInvocations"),
  ...toolInvocationFields,
});

export const changeSetFields = {
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
};
export const changeSetDocument = v.object({
  _creationTime: v.number(),
  _id: v.id("changeSets"),
  ...changeSetFields,
});

export const generationJobStatus = v.union(
  v.literal("approved"),
  v.literal("running"),
  v.literal("completed"),
  v.literal("ambiguous"),
  v.literal("failed"),
);
export const generationJobFields = {
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
  status: generationJobStatus,
  toolInvocationId: v.id("toolInvocations"),
};
export const generationJobDocument = v.object({
  _creationTime: v.number(),
  _id: v.id("generationJobs"),
  ...generationJobFields,
});
