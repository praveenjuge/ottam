const defaultStudioModel = "deepseek/deepseek-v4-flash-0731";
const deepSeekFlashPattern = /^deepseek\/deepseek-v4-flash(?:-[a-z0-9.]+)?$/;

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
      "OTTAM_STUDIO_MODEL must be a DeepSeek V4 Flash AI Gateway model.",
    );
  }
  return configured;
}

export { defaultStudioModel };
