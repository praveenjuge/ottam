import { z } from "zod";

const safeText = z.string().trim().min(1).max(20_000);

export const episodeEditableSchema = z
  .object({
    synopsis: safeText.max(2_000),
    title: safeText.max(120),
  })
  .strict();

export const sceneEditableSchema = z
  .object({
    durationSeconds: z.number().int().min(20).max(90),
    earliestSecond: z.number().int().nonnegative().optional(),
    kind: z.enum(["core", "optional", "reactive"]),
    latestSecond: z.number().int().positive().optional(),
    optionalPriority: z.number().int().positive().optional(),
    script: safeText,
    sortOrder: z.number().int().nonnegative(),
    stableKey: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    title: safeText.max(120),
  })
  .strict()
  .superRefine((scene, context) => {
    if (scene.kind === "optional" && scene.optionalPriority === undefined) {
      context.addIssue({
        code: "custom",
        message: "Optional scenes require an optional priority.",
        path: ["optionalPriority"],
      });
    }
    if (scene.kind !== "optional" && scene.optionalPriority !== undefined) {
      context.addIssue({
        code: "custom",
        message: "Only optional scenes may define an optional priority.",
        path: ["optionalPriority"],
      });
    }
    if (
      scene.earliestSecond !== undefined &&
      scene.latestSecond !== undefined &&
      scene.earliestSecond > scene.latestSecond
    ) {
      context.addIssue({
        code: "custom",
        message: "The earliest second cannot follow the latest second.",
        path: ["earliestSecond"],
      });
    }
  });

const episodeOperationSchema = z
  .object({
    after: episodeEditableSchema,
    before: episodeEditableSchema,
    entity: z.literal("episode"),
  })
  .strict();

const sceneOperationSchema = z
  .object({
    after: sceneEditableSchema,
    before: sceneEditableSchema.nullable(),
    entity: z.literal("scene"),
  })
  .strict();

export const changeSetProposalSchema = z
  .object({
    operations: z
      .array(
        z.discriminatedUnion("entity", [
          episodeOperationSchema,
          sceneOperationSchema,
        ]),
      )
      .min(1)
      .max(50),
    summary: z.string().trim().min(1).max(500),
  })
  .strict()
  .superRefine((proposal, context) => {
    const sceneKeys = new Set<string>();
    let episodeOperations = 0;
    for (const [index, operation] of proposal.operations.entries()) {
      if (operation.entity === "episode") {
        episodeOperations += 1;
      } else if (sceneKeys.has(operation.after.stableKey)) {
        context.addIssue({
          code: "custom",
          message: "A scene can only be changed once per proposal.",
          path: ["operations", index, "after", "stableKey"],
        });
      } else {
        sceneKeys.add(operation.after.stableKey);
      }
    }
    if (episodeOperations > 1) {
      context.addIssue({
        code: "custom",
        message: "A proposal can contain at most one episode metadata change.",
        path: ["operations"],
      });
    }
  });

export type ChangeSetProposal = z.infer<typeof changeSetProposalSchema>;

export const readOnlyTools = new Set([
  "previewDurationPlan",
  "readEpisode",
  "validateEpisode",
]);

export const approvalTools = new Set([
  "applyChangeSet",
  "approveAudioAssignment",
  "generateAudioCandidates",
  "restoreRevision",
]);

export type ToolDecision =
  | { type: "allow" }
  | { type: "deny"; reason: string }
  | { type: "user-approval" };

export function decideStudioTool(toolName: string): ToolDecision {
  if (
    readOnlyTools.has(toolName) ||
    toolName === "proposeChangeSet" ||
    toolName === "proposeAudioGeneration"
  ) {
    return { type: "allow" };
  }
  if (approvalTools.has(toolName)) {
    return { type: "user-approval" };
  }
  return {
    type: "deny",
    reason: "This capability is outside the Ottam production agent allowlist.",
  };
}

export function parseChangeSetProposal(value: unknown): ChangeSetProposal {
  return changeSetProposalSchema.parse(value);
}

export function parseStoredProposal(value: string): ChangeSetProposal {
  if (value.length > 1_000_000) {
    throw new Error("Stored proposal exceeds the maximum supported size.");
  }
  return parseChangeSetProposal(JSON.parse(value) as unknown);
}

export function stableJson(value: unknown): string {
  if (value === undefined) {
    throw new Error("Unsupported undefined value in canonical JSON.");
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value).sort(([left], [right]) =>
      left.localeCompare(right),
    );
    return `{${entries
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
