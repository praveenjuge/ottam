import type { GenerationRequest } from "@/lib/media/generation-contract";
import { estimatedCredits } from "@/lib/media/generation-contract";

export function AudioGenerationDiff({
  request,
  voiceName,
}: {
  request: GenerationRequest;
  voiceName: string;
}) {
  return (
    <section
      className="grid gap-3 rounded-lg border bg-card p-4"
      aria-label="Audio generation proposal"
    >
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-xs text-muted-foreground">Estimated ceiling</span>
        <strong>
          {estimatedCredits(request).toLocaleString("en-US")} credits
        </strong>
      </div>
      <dl className="grid grid-cols-2 gap-3">
        <div className="grid gap-1">
          <dt className="text-xs text-muted-foreground">Voice</dt>
          <dd>{voiceName}</dd>
        </div>
        <div className="grid gap-1">
          <dt className="text-xs text-muted-foreground">Candidates</dt>
          <dd>{request.candidateCount}</dd>
        </div>
        <div className="grid gap-1">
          <dt className="text-xs text-muted-foreground">Model</dt>
          <dd>{request.modelId}</dd>
        </div>
        <div className="grid gap-1">
          <dt className="text-xs text-muted-foreground">Format</dt>
          <dd>{request.outputFormat}</dd>
        </div>
      </dl>
      <article className="rounded-md bg-muted p-3">
        <span className="text-xs text-muted-foreground">Exact transcript</span>
        <p className="mt-2 whitespace-pre-wrap">{request.script}</p>
      </article>
      <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
        {JSON.stringify(request.voiceSettings, null, 2)}
      </pre>
    </section>
  );
}
