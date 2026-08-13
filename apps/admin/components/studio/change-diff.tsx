import type { ChangeSetProposal } from "@/convex/lib/studioPolicy";

function valueRows(value: Record<string, unknown>) {
  return Object.entries(value).map(([key, fieldValue]) => (
    <div className="grid gap-1" key={key}>
      <dt className="text-xs text-muted-foreground">{key}</dt>
      <dd className="m-0 [overflow-wrap:anywhere] whitespace-pre-wrap">
        {typeof fieldValue === "string"
          ? fieldValue
          : JSON.stringify(fieldValue)}
      </dd>
    </div>
  ));
}

export function ChangeDiff({ proposal }: { proposal: ChangeSetProposal }) {
  return (
    <section className="grid gap-3" aria-label="Proposed changes">
      <strong>{proposal.summary}</strong>
      {proposal.operations.map((operation, index) => (
        <article
          className="grid gap-3 border-t pt-3"
          key={`${operation.entity}-${String(index)}`}
        >
          <p className="text-xs font-medium text-muted-foreground uppercase">
            {operation.entity === "episode"
              ? "Episode metadata"
              : operation.after.stableKey}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <dl className="grid gap-2 rounded-md bg-muted p-3">
              <span className="text-xs font-medium text-muted-foreground uppercase">
                Before
              </span>
              {operation.before ? (
                valueRows(operation.before)
              ) : (
                <p>New scene</p>
              )}
            </dl>
            <dl className="grid gap-2 rounded-md bg-muted p-3">
              <span className="text-xs font-medium text-muted-foreground uppercase">
                After
              </span>
              {valueRows(operation.after)}
            </dl>
          </div>
        </article>
      ))}
    </section>
  );
}
