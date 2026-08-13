"use client";

import { ArrowRight, AudioLines, LibraryBig } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EpisodeCreateDialog } from "./episode-create-dialog";
import { SeriesCreateDialog } from "./series-create-dialog";

interface SeriesRow {
  description: string;
  genre: string;
  id: Id<"series">;
  slug: string;
  status: string;
  title: string;
}

interface EpisodeRow {
  episodeId: Id<"episodes">;
  sequence: number;
  seriesId: Id<"series">;
  seriesTitle: string;
  status: string;
  title: string;
}

export function SeriesLibrary({
  episodes,
  onOpenEpisode,
  series,
}: {
  episodes: EpisodeRow[];
  onOpenEpisode: (episodeId: Id<"episodes">) => void;
  series: SeriesRow[];
}) {
  return (
    <main className="min-h-svh bg-muted/20 p-5 sm:p-8" id="main-content">
      <header className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-4 border-b pb-6">
        <div className="grid max-w-2xl gap-2">
          <Badge className="w-fit" variant="outline">
            {series.length} series
          </Badge>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Production library
          </h1>
          <p className="text-sm leading-6 text-muted-foreground">
            Choose a series, enter an episode workspace, and develop the story
            through its approval-gated production chat.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {series.length > 0 ? (
            <EpisodeCreateDialog onCreated={onOpenEpisode} />
          ) : null}
          <SeriesCreateDialog />
        </div>
      </header>

      {series.length === 0 ? (
        <section className="mx-auto grid min-h-[60svh] max-w-lg place-items-center text-center">
          <div className="grid gap-3">
            <LibraryBig className="mx-auto size-8 text-muted-foreground" />
            <h2 className="text-xl font-semibold">Create the first series</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              Series and episode structure stays deterministic in Convex. Chat
              begins only after an episode workspace exists.
            </p>
          </div>
        </section>
      ) : (
        <section
          aria-label="Series"
          className="mx-auto grid max-w-6xl gap-4 pt-6 md:grid-cols-2 xl:grid-cols-3"
        >
          {series.map((item) => {
            const itemEpisodes = episodes.filter(
              (episode) => episode.seriesId === item.id,
            );
            return (
              <Card className="min-h-72" key={item.id}>
                <CardHeader>
                  <CardTitle className="text-lg">{item.title}</CardTitle>
                  <CardDescription>{item.genre}</CardDescription>
                  <CardAction>
                    <Badge variant="secondary">{item.status}</Badge>
                  </CardAction>
                </CardHeader>
                <CardContent className="grid content-start gap-1">
                  <p className="mb-3 line-clamp-3 text-sm leading-6 text-muted-foreground">
                    {item.description}
                  </p>
                  {itemEpisodes.map((episode) => (
                    <Button
                      className="h-auto justify-start gap-3 py-2.5"
                      key={episode.episodeId}
                      onClick={() => {
                        onOpenEpisode(episode.episodeId);
                      }}
                      variant="ghost"
                    >
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {String(episode.sequence).padStart(2, "0")}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-left">
                        {episode.title}
                      </span>
                      <ArrowRight className="text-muted-foreground" />
                    </Button>
                  ))}
                  {itemEpisodes.length === 0 ? (
                    <p className="py-3 text-sm text-muted-foreground">
                      No episodes yet.
                    </p>
                  ) : null}
                </CardContent>
                <CardFooter className="mt-auto justify-between text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <AudioLines className="size-3.5" />
                    {itemEpisodes.length} episodes
                  </span>
                  <span>Chat is canonical</span>
                </CardFooter>
              </Card>
            );
          })}
        </section>
      )}
    </main>
  );
}
