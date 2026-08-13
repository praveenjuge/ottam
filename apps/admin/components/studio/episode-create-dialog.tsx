"use client";

import { useAction, useQuery } from "convex/react";
import { nanoid } from "nanoid";
import { useState, type SyntheticEvent } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

function slugify(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function formText(data: FormData, name: string): string {
  const value = data.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export function EpisodeCreateDialog({
  onCreated,
}: {
  onCreated: (episodeId: Id<"episodes">) => void;
}) {
  const series = useQuery(api.series.listAdmin);
  const createEpisode = useAction(api.studioActions.createDraftEpisode);
  const [error, setError] = useState<string>();
  const [open, setOpen] = useState(false);
  const [working, setWorking] = useState(false);
  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const seriesId = formText(data, "seriesId") as Id<"series">;
    const title = formText(data, "title");
    setWorking(true);
    setError(undefined);
    try {
      const result = await createEpisode({
        idempotencyKey: `episode_${nanoid(18)}`,
        seriesId,
        slug: slugify(title),
        synopsis: formText(data, "synopsis"),
        title,
      });
      setOpen(false);
      onCreated(result.episodeId);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not create episode.",
      );
    } finally {
      setWorking(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="episode-create-trigger" variant="outline">
          New episode
        </Button>
      </DialogTrigger>
      <DialogContent className="episode-create-dialog">
        <DialogHeader>
          <DialogTitle>Create an episode</DialogTitle>
          <DialogDescription>
            Create the production workspace now. Develop its transcript later in
            the episode-scoped chat.
          </DialogDescription>
        </DialogHeader>
        <form
          className="setup-form"
          onSubmit={(event) => void handleSubmit(event)}
        >
          <label>
            Series
            <select autoComplete="off" name="seriesId" required>
              {series?.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Episode title
            <Input autoComplete="off" maxLength={120} name="title" required />
          </label>
          <label>
            Story intent
            <Textarea
              autoComplete="off"
              maxLength={2000}
              name="synopsis"
              required
            />
          </label>
          {error ? (
            <p aria-live="polite" className="form-error">
              {error}
            </p>
          ) : null}
          <Button disabled={working || !series?.length} type="submit">
            {working ? "Creating…" : "Create episode"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
