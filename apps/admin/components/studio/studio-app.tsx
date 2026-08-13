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
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
} from "@/components/ui/sidebar";
import { EpisodeCreateDialog } from "./episode-create-dialog";
import { EpisodeChat } from "./episode-chat";
import { LibrarySetup } from "./library-setup";

export function StudioApp() {
  return (
    <>
      <AuthLoading>
        <main
          className="grid min-h-svh place-items-center text-sm text-muted-foreground"
          id="main-content"
        >
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
    <main
      className="grid min-h-svh place-items-center text-sm text-muted-foreground"
      id="main-content"
    >
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
    return (
      <p className="grid min-h-svh place-items-center text-sm text-muted-foreground">
        Loading studio…
      </p>
    );
  if (episodes.length === 0) return <LibrarySetup />;

  return (
    <SidebarProvider>
      <Sidebar collapsible="offcanvas">
        <SidebarHeader className="border-b border-sidebar-border p-3">
          <div className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              O
            </span>
            <strong className="flex-1 text-sm">Ottam Studio</strong>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <div className="mb-2 flex items-center justify-between gap-2 px-2">
              <SidebarGroupLabel className="h-auto p-0">
                Episodes
              </SidebarGroupLabel>
              <EpisodeCreateDialog onCreated={setSelectedId} />
            </div>
            <SidebarGroupContent>
              <SidebarMenu aria-label="Episodes">
                {episodes.map((episode) => (
                  <SidebarMenuItem key={episode.episodeId}>
                    <SidebarMenuButton
                      className="h-auto items-start py-2"
                      isActive={selectedId === episode.episodeId}
                      onClick={() => {
                        setSelectedId(episode.episodeId);
                      }}
                    >
                      <span className="w-5 shrink-0 pt-0.5 text-xs tabular-nums text-muted-foreground">
                        {String(episode.sequence).padStart(2, "0")}
                      </span>
                      <span className="grid min-w-0 gap-0.5">
                        <strong className="truncate font-medium">
                          {episode.title}
                        </strong>
                        <small className="truncate text-muted-foreground">
                          {episode.seriesTitle}
                        </small>
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <UserButton />
            One administrator
          </div>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset id="main-content">
        {selectedId ? (
          <EpisodeChat episodeId={selectedId} key={selectedId} />
        ) : null}
      </SidebarInset>
    </SidebarProvider>
  );
}
