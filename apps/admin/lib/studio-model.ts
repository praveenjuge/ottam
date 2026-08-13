const defaultStudioModel = "deepseek-v4-flash";
const deepSeekFlashPattern = /^deepseek-v4-flash(?:-[a-z0-9.]+)?$/;

export function getStudioModelId(environment?: {
  OTTAM_STUDIO_MODEL?: string;
}): string {
  const candidate = (
    environment?.OTTAM_STUDIO_MODEL ?? process.env.OTTAM_STUDIO_MODEL
  )?.trim();
  const configured =
    candidate && candidate.length > 0 ? candidate : defaultStudioModel;
  if (!deepSeekFlashPattern.test(configured)) {
    throw new Error(
      "OTTAM_STUDIO_MODEL must be an OpenCode Go DeepSeek V4 Flash model.",
    );
  }
  return configured;
}

export function getStudioModelLabel(environment?: {
  OTTAM_STUDIO_MODEL?: string;
}): string {
  return `opencode-go/${getStudioModelId(environment)}`;
}

export { defaultStudioModel };
