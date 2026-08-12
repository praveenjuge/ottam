import type { GenerationRequest } from "./generation-contract";

export interface GeneratedCandidate {
  bytes: Uint8Array;
  characterCost: number;
  mimeType: "audio/mpeg";
  providerRequestId: string;
}

export interface AudioGenerationProvider {
  generate(
    request: GenerationRequest,
    candidateIndex: number,
  ): Promise<GeneratedCandidate>;
}

export class FakeAudioGenerationProvider implements AudioGenerationProvider {
  readonly calls: {
    candidateIndex: number;
    request: GenerationRequest;
  }[] = [];

  async generate(
    request: GenerationRequest,
    candidateIndex: number,
  ): Promise<GeneratedCandidate> {
    this.calls.push({ candidateIndex, request });
    return await Promise.resolve({
      bytes: new TextEncoder().encode(`fake-audio-${String(candidateIndex)}`),
      characterCost: request.script.length,
      mimeType: "audio/mpeg" as const,
      providerRequestId: `fake-request-${String(candidateIndex)}`,
    });
  }
}

export class ElevenLabsAudioGenerationProvider implements AudioGenerationProvider {
  constructor(
    private readonly apiKey: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {
    if (!apiKey) throw new Error("ELEVENLABS_API_KEY is required.");
  }

  async generate(
    request: GenerationRequest,
    candidateIndex: number,
  ): Promise<GeneratedCandidate> {
    void candidateIndex;
    const response = await this.fetcher(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(request.voiceId)}?output_format=${request.outputFormat}`,
      {
        body: JSON.stringify({
          model_id: request.modelId,
          text: request.script,
          voice_settings: {
            similarity_boost: request.voiceSettings.similarityBoost,
            speed: request.voiceSettings.speed,
            stability: request.voiceSettings.stability,
            style: request.voiceSettings.style,
            use_speaker_boost: request.voiceSettings.useSpeakerBoost,
          },
        }),
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": this.apiKey,
        },
        method: "POST",
      },
    );
    if (!response.ok) {
      throw new Error(
        `ElevenLabs generation failed with HTTP ${String(response.status)}.`,
      );
    }
    const requestId = response.headers.get("request-id");
    const characterCostHeader = response.headers.get("character-cost");
    const characterCost = Number(characterCostHeader);
    if (
      !requestId ||
      characterCostHeader === null ||
      !Number.isSafeInteger(characterCost) ||
      characterCost < 0
    ) {
      throw new Error("ElevenLabs returned ambiguous generation metadata.");
    }
    return {
      bytes: new Uint8Array(await response.arrayBuffer()),
      characterCost,
      mimeType: "audio/mpeg",
      providerRequestId: requestId,
    };
  }
}
