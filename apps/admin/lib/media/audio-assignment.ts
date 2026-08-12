import { z } from "zod";

export const assignmentVariantSchema = z.enum([
  "default",
  "walking",
  "running",
]);

export const assignmentRequestSchema = z
  .object({
    assetId: z.string().min(1).max(128),
    sceneId: z.string().min(1).max(128),
    variant: assignmentVariantSchema,
  })
  .strict();

export const audioAssignmentSchema = assignmentRequestSchema.extend({
  baseRevisionId: z.string().min(1).max(128),
  beforeAssetId: z.string().min(1).max(128).nullable(),
  episodeId: z.string().min(1).max(128),
});

export type AudioAssignment = z.infer<typeof audioAssignmentSchema>;
