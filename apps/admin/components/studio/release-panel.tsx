"use client";

import { useAction } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
    <section className="grid gap-3" aria-labelledby="release-heading">
      <h2 className="text-sm font-medium" id="release-heading">
        Release
      </h2>
      <p className="text-xs leading-5 text-muted-foreground">
        Validate assigned audio and all 46 deterministic duration plans before
        the human-only publish action becomes available.
      </p>
      {report ? (
        <Alert
          aria-live="polite"
          variant={report.valid ? "default" : "destructive"}
        >
          <AlertTitle>{report.valid ? "Ready" : "Not ready"}</AlertTitle>
          <AlertDescription className="grid gap-1">
            <span>{report.durationPlanCount}/46 plans</span>
            {report.issues.map((issue) => (
              <small key={issue}>{issue}</small>
            ))}
          </AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-2">
        <Button
          disabled={working}
          onClick={() => void runValidation()}
          variant="outline"
        >
          Validate
        </Button>
        <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
          <span>Type PUBLISH to confirm this immutable release</span>
          <Input
            autoCapitalize="characters"
            autoComplete="off"
            name="publish-confirmation"
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
        <p aria-live="polite" className="text-xs text-muted-foreground">
          {message}
        </p>
      ) : null}
    </section>
  );
}
