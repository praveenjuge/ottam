import type { ChangeSetProposal } from "@/convex/lib/studioPolicy";

function valueRows(value: Record<string, unknown>) {
  return Object.entries(value).map(([key, fieldValue]) => (
    <div className="diff-field" key={key}>
      <dt>{key}</dt>
      <dd>
        {typeof fieldValue === "string"
          ? fieldValue
          : JSON.stringify(fieldValue)}
      </dd>
    </div>
  ));
}

export function ChangeDiff({ proposal }: { proposal: ChangeSetProposal }) {
  return (
    <section className="change-diff" aria-label="Proposed changes">
      <strong>{proposal.summary}</strong>
      {proposal.operations.map((operation, index) => (
        <article
          className="diff-operation"
          key={`${operation.entity}-${String(index)}`}
        >
          <p className="diff-entity">
            {operation.entity === "episode"
              ? "Episode metadata"
              : operation.after.stableKey}
          </p>
          <div className="diff-columns">
            <dl>
              <span>Before</span>
              {operation.before ? (
                valueRows(operation.before)
              ) : (
                <p>New scene</p>
              )}
            </dl>
            <dl>
              <span>After</span>
              {valueRows(operation.after)}
            </dl>
          </div>
        </article>
      ))}
    </section>
  );
}
