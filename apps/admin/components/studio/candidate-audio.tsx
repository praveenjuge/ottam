"use client";

import { useAction } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  AudioPlayer,
  AudioPlayerControlBar,
  AudioPlayerDurationDisplay,
  AudioPlayerElement,
  AudioPlayerPlayButton,
  AudioPlayerTimeDisplay,
  AudioPlayerTimeRange,
} from "@/components/ai-elements/audio-player";

export function CandidateAudio({
  assetId,
  episodeId,
}: {
  assetId: Id<"audioAssets">;
  episodeId: Id<"episodes">;
}) {
  const getUrl = useAction(api.mediaNode.candidateReadUrl);
  const [url, setUrl] = useState<string>();

  useEffect(() => {
    let active = true;
    void getUrl({ assetId, episodeId }).then((result) => {
      if (active) setUrl(result.url);
    });
    return () => {
      active = false;
    };
  }, [assetId, episodeId, getUrl]);

  if (!url)
    return <p className="candidate-loading">Preparing private preview…</p>;
  return (
    <AudioPlayer>
      <AudioPlayerElement src={url} />
      <AudioPlayerControlBar>
        <AudioPlayerPlayButton />
        <AudioPlayerTimeDisplay />
        <AudioPlayerTimeRange />
        <AudioPlayerDurationDisplay />
      </AudioPlayerControlBar>
    </AudioPlayer>
  );
}
