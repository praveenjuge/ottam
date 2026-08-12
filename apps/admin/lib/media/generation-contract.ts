import { z } from "zod";

export const outputFormatSchema = z.literal("mp3_44100_128");

export const voiceSettingsSchema = z
  .object({
    similarityBoost: z.number().min(0).max(1),
    speed: z.number().min(0.7).max(1.2),
    stability: z.number().min(0).max(1),
    style: z.number().min(0).max(1),
    useSpeakerBoost: z.boolean(),
  })
  .strict();

export const generationRequestSchema = z
  .object({
    candidateCount: z.number().int().min(1).max(3),
    modelId: z.enum(["eleven_multilingual_v2", "eleven_v3"]),
    outputFormat: outputFormatSchema,
    sceneId: z.string().min(1).max(128),
    script: z.string().trim().min(1).max(5_000),
    voiceId: z.string().min(1).max(128),
    voiceSettings: voiceSettingsSchema,
  })
  .strict();

export type GenerationRequest = z.infer<typeof generationRequestSchema>;

export function estimatedCredits(request: GenerationRequest): number {
  return request.script.length * request.candidateCount;
}
