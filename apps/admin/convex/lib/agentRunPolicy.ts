const agentRunWindowMilliseconds = 60_000;
const maximumAgentRunsPerWindow = 6;

export function canStartAgentRun(
  recentStartedAt: number[],
  now: number,
): boolean {
  const cutoff = now - agentRunWindowMilliseconds;
  return (
    recentStartedAt.filter((startedAt) => startedAt >= cutoff).length <
    maximumAgentRunsPerWindow
  );
}
