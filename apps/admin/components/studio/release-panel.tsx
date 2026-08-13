"use client";

import { useAction } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";

interface Report {
  durationPlanCount: number;
  issues: string[];
  valid: boolean;
}

export function ReleasePanel({ episodeId }: { episodeId: Id<"episodes"> }) {
  const validate = useAction(api.publishingNode.validateEpisode);
  const publish = useAction(api.publishingNode.publishEpisode);
  const [report, setReport] = useState<Report>();
  const [message, setMessage] = useState<string>();
  const [publishConfirmation, setPublishConfirmation] = useState("");
  const [working, setWorking] = useState(false);

  async function runValidation() {
    setWorking(true);
    setMessage(undefined);
    try {
      setReport(await validate({ episodeId }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Validation failed.");
    } finally {
      setWorking(false);
    }
  }

  async function publishRelease() {
    if (publishConfirmation !== "PUBLISH") return;
    setWorking(true);
    setMessage(undefined);
    try {
      const result = await publish({
        confirmationText: "PUBLISH",
        episodeId,
        humanIntentNonce: crypto.randomUUID(),
      });
      setPublishConfirmation("");
      setMessage(`Release ${String(result.releaseNumber)} is published.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Publishing failed.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <section className="release-panel" aria-labelledby="release-heading">
      <h2 id="release-heading">Release</h2>
      <p>
        Validate assigned audio and all 46 deterministic duration plans before
        the human-only publish action becomes available.
      </p>
      {report ? (
        <div
          aria-live="polite"
          className="validation-result"
          data-valid={report.valid}
        >
          <strong>{report.valid ? "Ready" : "Not ready"}</strong>
          <span>{report.durationPlanCount}/46 plans</span>
          {report.issues.map((issue) => (
            <small key={issue}>{issue}</small>
          ))}
        </div>
      ) : null}
      <div className="release-actions">
        <Button
          disabled={working}
          onClick={() => void runValidation()}
          variant="outline"
        >
          Validate
        </Button>
        <label className="publish-confirmation">
          Type PUBLISH to confirm this immutable release
          <input
            autoCapitalize="characters"
            autoComplete="off"
            onChange={(event) => {
              setPublishConfirmation(event.target.value);
            }}
            spellCheck={false}
            value={publishConfirmation}
          />
        </label>
        <Button
          disabled={
            working || !report?.valid || publishConfirmation !== "PUBLISH"
          }
          onClick={() => void publishRelease()}
        >
          Publish immutable release
        </Button>
      </div>
      {message ? (
        <p aria-live="polite" className="release-message">
          {message}
        </p>
      ) : null}
    </section>
  );
}
