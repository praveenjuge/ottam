import {
  durationMinutesSchema,
  type DurationMinutes,
} from "@ottam/story-contract";

export function assertSupportedDuration(value: number): DurationMinutes {
  return durationMinutesSchema.parse(value);
}
