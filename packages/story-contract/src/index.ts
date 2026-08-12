import { z } from "zod";

export const durationMinutesSchema = z.number().int().min(15).max(60);
export type DurationMinutes = z.infer<typeof durationMinutesSchema>;

export const movementStateSchema = z.enum(["walking", "running", "stationary"]);
export type MovementState = z.infer<typeof movementStateSchema>;

export const sceneKindSchema = z.enum(["core", "optional", "reactive"]);
export type SceneKind = z.infer<typeof sceneKindSchema>;

export const sceneDurationSecondsSchema = z.number().int().min(20).max(90);

export const storyDensitySchema = z.number().min(0.3).max(0.4);

export const storyContractVersion = 1 as const;
