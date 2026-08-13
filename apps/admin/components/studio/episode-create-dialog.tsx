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
        <Button size="xs" variant="ghost">
          Add
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create an episode</DialogTitle>
          <DialogDescription>
            Create the production workspace now. Develop its transcript later in
            the episode-scoped chat.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(event) => void handleSubmit(event)}
        >
          <label className="grid gap-1.5 text-sm font-medium">
            <span>Series</span>
            <select
              autoComplete="off"
              className="h-8 rounded-lg border border-input bg-input/30 px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              name="seriesId"
              required
            >
              {series?.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            <span>Episode title</span>
            <Input autoComplete="off" maxLength={120} name="title" required />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            <span>Story intent</span>
            <Textarea
              autoComplete="off"
              maxLength={2000}
              name="synopsis"
              required
            />
          </label>
          {error ? (
            <p aria-live="polite" className="text-sm text-destructive">
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
