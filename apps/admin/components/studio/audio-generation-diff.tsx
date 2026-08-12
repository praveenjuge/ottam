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
    <section className="audio-proposal" aria-label="Audio generation proposal">
      <div className="audio-cost">
        <span>Estimated ceiling</span>
        <strong>
          {estimatedCredits(request).toLocaleString("en-US")} credits
        </strong>
      </div>
      <dl>
        <div>
          <dt>Voice</dt>
          <dd>{voiceName}</dd>
        </div>
        <div>
          <dt>Candidates</dt>
          <dd>{request.candidateCount}</dd>
        </div>
        <div>
          <dt>Model</dt>
          <dd>{request.modelId}</dd>
        </div>
        <div>
          <dt>Format</dt>
          <dd>{request.outputFormat}</dd>
        </div>
      </dl>
      <article>
        <span>Exact transcript</span>
        <p>{request.script}</p>
      </article>
      <pre>{JSON.stringify(request.voiceSettings, null, 2)}</pre>
    </section>
  );
}
