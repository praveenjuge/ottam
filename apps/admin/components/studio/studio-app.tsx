"use client";

import { UserButton } from "@clerk/nextjs";
import {
  Authenticated,
  AuthLoading,
  Unauthenticated,
  useQuery,
} from "convex/react";
import { useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { EpisodeChat } from "./episode-chat";
import { LibrarySetup } from "./library-setup";

export function StudioApp() {
  return (
    <>
      <AuthLoading>
        <main className="loading-state" id="main-content">
          Loading studio…
        </main>
      </AuthLoading>
      <Unauthenticated>
        <SigningOut />
      </Unauthenticated>
      <Authenticated>
        <AuthenticatedStudio />
      </Authenticated>
    </>
  );
}

function SigningOut() {
  useEffect(() => {
    window.location.replace("/");
  }, []);
  return (
    <main className="loading-state" id="main-content">
      Signing out…
    </main>
  );
}

function AuthenticatedStudio() {
  const episodes = useQuery(api.studio.listEpisodes);
  const [selectedId, setSelectedId] = useState<Id<"episodes">>();

  useEffect(() => {
    if (!selectedId && episodes?.[0]) setSelectedId(episodes[0].episodeId);
  }, [episodes, selectedId]);

  if (episodes === undefined)
    return <p className="loading-state">Loading studio…</p>;
  if (episodes.length === 0) return <LibrarySetup />;

  return (
    <main className="studio-shell" id="main-content">
      <aside className="studio-sidebar">
        <header className="brand-row">
          <span className="brand-mark">O</span>
          <strong>Ottam Studio</strong>
          <UserButton />
        </header>
        <nav aria-label="Episodes" className="episode-nav">
          <p className="nav-label">Episodes</p>
          {episodes.map((episode) => (
            <button
              aria-current={
                selectedId === episode.episodeId ? "page" : undefined
              }
              className="episode-nav-item"
              key={episode.episodeId}
              onClick={() => {
                setSelectedId(episode.episodeId);
              }}
              type="button"
            >
              <span>{String(episode.sequence).padStart(2, "0")}</span>
              <span>
                <strong>{episode.title}</strong>
                <small>{episode.seriesTitle}</small>
              </span>
            </button>
          ))}
        </nav>
      </aside>
      {selectedId ? (
        <EpisodeChat episodeId={selectedId} key={selectedId} />
      ) : null}
    </main>
  );
}
