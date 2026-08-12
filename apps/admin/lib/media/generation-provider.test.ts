import { describe, expect, it, vi } from "vitest";
import {
  ElevenLabsAudioGenerationProvider,
  FakeAudioGenerationProvider,
} from "./generation-provider";
import {
  estimatedCredits,
  generationRequestSchema,
} from "./generation-contract";

const request = generationRequestSchema.parse({
  candidateCount: 2,
  modelId: "eleven_multilingual_v2",
  outputFormat: "mp3_44100_128",
  sceneId: "scene_12345678",
  script: "You hear the signal move closer.",
  voiceId: "voice_12345678",
  voiceSettings: {
    similarityBoost: 0.75,
    speed: 1,
    stability: 0.5,
    style: 0.2,
    useSpeakerBoost: true,
  },
});

describe("audio generation providers", () => {
  it("uses a deterministic fake without any production request", async () => {
    const provider = new FakeAudioGenerationProvider();
    const candidate = await provider.generate(request, 1);
    expect(provider.calls).toHaveLength(1);
    expect(candidate.providerRequestId).toBe("fake-request-1");
    expect(estimatedCredits(request)).toBe(request.script.length * 2);
  });

  it("makes one request and rejects ambiguous cost metadata without retrying", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        headers: { "content-type": "audio/mpeg", "request-id": "request-1" },
        status: 200,
      }),
    );
    const provider = new ElevenLabsAudioGenerationProvider("test-key", fetcher);
    await expect(provider.generate(request, 0)).rejects.toThrow(/ambiguous/);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("never retries a provider error", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("quota", { status: 429 }));
    const provider = new ElevenLabsAudioGenerationProvider("test-key", fetcher);
    await expect(provider.generate(request, 0)).rejects.toThrow(/429/);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
