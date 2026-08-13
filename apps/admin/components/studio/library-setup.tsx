"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { nanoid } from "nanoid";
import { useState, type SyntheticEvent } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

function slugify(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function LibrarySetup() {
  const series = useQuery(api.series.listAdmin);
  const createSeries = useMutation(api.series.createDraft);
  const createEpisode = useAction(api.studioActions.createDraftEpisode);
  const [error, setError] = useState<string>();
  const [working, setWorking] = useState(false);

  function formText(data: FormData, name: string): string {
    const value = data.get(name);
    return typeof value === "string" ? value.trim() : "";
  }

  async function handleSeries(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const title = formText(data, "title");
    setWorking(true);
    setError(undefined);
    try {
      await createSeries({
        description: formText(data, "description"),
        genre: formText(data, "genre"),
        slug: slugify(title),
        title,
      });
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not create series.",
      );
    } finally {
      setWorking(false);
    }
  }

  async function handleEpisode(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const title = formText(data, "title");
    setWorking(true);
    setError(undefined);
    try {
      await createEpisode({
        idempotencyKey: `episode_${nanoid(18)}`,
        sequence: 1,
        seriesId: formText(data, "seriesId") as Id<"series">,
        slug: slugify(title),
        synopsis: formText(data, "synopsis"),
        title,
      });
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not create episode.",
      );
    } finally {
      setWorking(false);
    }
  }

  if (series === undefined)
    return (
      <p className="grid min-h-svh place-items-center text-sm text-muted-foreground">
        Loading studio…
      </p>
    );
  const hasSeries = series.length > 0;

  return (
    <main
      className="mx-auto grid min-h-svh w-full max-w-xl content-center gap-4 p-8"
      id="main-content"
    >
      <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
        Ottam production
      </p>
      <h1 className="text-3xl font-semibold tracking-tight">
        {hasSeries ? "Create the first episode" : "Create the first series"}
      </h1>
      <p className="text-sm leading-6 text-muted-foreground">
        Library structure is deterministic in Convex. Transcript development
        begins in the episode chat after this one-time setup.
      </p>
      {hasSeries ? (
        <form
          className="mt-2 grid gap-4"
          onSubmit={(event) => {
            void handleEpisode(event);
          }}
        >
          <label className="grid gap-1.5 text-sm font-medium">
            <span>Series</span>
            <select
              autoComplete="off"
              className="h-8 rounded-lg border border-input bg-input/30 px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              name="seriesId"
              required
            >
              {series.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            <span>Episode title</span>
            <Input
              autoComplete="off"
              name="title"
              required
              maxLength={120}
              placeholder="For example, Someone Is Listening…"
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            <span>Story intent</span>
            <Textarea
              autoComplete="off"
              name="synopsis"
              required
              maxLength={2000}
              placeholder="For example, the listener intercepts a transmission that should not exist…"
            />
          </label>
          <Button disabled={working} type="submit">
            {working ? "Creating…" : "Create episode"}
          </Button>
        </form>
      ) : (
        <form
          className="mt-2 grid gap-4"
          onSubmit={(event) => {
            void handleSeries(event);
          }}
        >
          <label className="grid gap-1.5 text-sm font-medium">
            <span>Series title</span>
            <Input
              autoComplete="off"
              name="title"
              required
              maxLength={120}
              placeholder="For example, The Signal…"
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            <span>Genre</span>
            <Input
              autoComplete="off"
              name="genre"
              required
              maxLength={80}
              placeholder="For example, sci-fi thriller…"
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            <span>Series premise</span>
            <Textarea
              autoComplete="off"
              name="description"
              required
              maxLength={2000}
              placeholder="For example, a transmission follows you through a city that has gone quiet…"
            />
          </label>
          <Button disabled={working} type="submit">
            {working ? "Creating…" : "Create series"}
          </Button>
        </form>
      )}
      {error ? (
        <p aria-live="polite" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </main>
  );
}
