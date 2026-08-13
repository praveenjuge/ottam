/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const adminIdentity = {
  email: "admin@ottam.test",
  issuer: "https://clerk.ottam.test",
  subject: "user_admin",
  tokenIdentifier: "https://clerk.ottam.test|user_admin",
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Convex authorization", () => {
  test("allows the configured admin and preserves deterministic creation", async () => {
    vi.stubEnv("OTTAM_ADMIN_EMAIL", adminIdentity.email);
    vi.stubEnv("OTTAM_ADMIN_CLERK_USER_ID", adminIdentity.subject);
    const t = convexTest(schema, modules).withIdentity(adminIdentity);
    const args = {
      description: "A movement-first mystery.",
      genre: "Mystery",
      slug: "the-signal",
      title: "The Signal",
    };

    const first = await t.mutation(api.series.createDraft, args);
    const replay = await t.mutation(api.series.createDraft, args);
    expect(replay).toBe(first);
    await expect(t.query(api.series.listAdmin)).resolves.toMatchObject([
      { id: first, slug: "the-signal", status: "draft" },
    ]);
  });

  test("refuses another authenticated user", async () => {
    vi.stubEnv("OTTAM_ADMIN_EMAIL", adminIdentity.email);
    vi.stubEnv("OTTAM_ADMIN_CLERK_USER_ID", adminIdentity.subject);
    const other = convexTest(schema, modules).withIdentity({
      email: "listener@ottam.test",
      issuer: adminIdentity.issuer,
      subject: "user_listener",
      tokenIdentifier: `${adminIdentity.issuer}|user_listener`,
    });

    await expect(
      other.mutation(api.series.createDraft, {
        description: "Unauthorized content.",
        genre: "Mystery",
        slug: "forbidden-series",
        title: "Forbidden",
      }),
    ).rejects.toThrow("Administrator access is required");
  });

  test("allocates episode sequences transactionally", async () => {
    vi.stubEnv("OTTAM_ADMIN_EMAIL", adminIdentity.email);
    vi.stubEnv("OTTAM_ADMIN_CLERK_USER_ID", adminIdentity.subject);
    const t = convexTest(schema, modules).withIdentity(adminIdentity);
    const seriesId = await t.mutation(api.series.createDraft, {
      description: "A transmission follows the listener through the city.",
      genre: "Sci-fi thriller",
      slug: "the-signal",
      title: "The Signal",
    });

    await t.action(api.studioActions.createDraftEpisode, {
      idempotencyKey: "episode_first_1234",
      seriesId,
      slug: "the-first-transmission",
      synopsis: "A receiver wakes up when the listener begins moving.",
      title: "The First Transmission",
    });
    await t.action(api.studioActions.createDraftEpisode, {
      idempotencyKey: "episode_second_123",
      seriesId,
      slug: "someone-is-listening",
      synopsis: "The voice on the channel begins answering back.",
      title: "Someone Is Listening",
    });

    await expect(t.query(api.studio.listEpisodes)).resolves.toMatchObject([
      { sequence: 1, title: "The First Transmission" },
      { sequence: 2, title: "Someone Is Listening" },
    ]);
  });

  test("refuses an unauthenticated caller", async () => {
    vi.stubEnv("OTTAM_ADMIN_EMAIL", adminIdentity.email);
    vi.stubEnv("OTTAM_ADMIN_CLERK_USER_ID", adminIdentity.subject);
    const t = convexTest(schema, modules);

    await expect(t.query(api.series.listAdmin)).rejects.toThrow(
      "Sign in is required",
    );
  });

  test("requires approval before applying content and makes replay idempotent", async () => {
    vi.stubEnv("OTTAM_ADMIN_EMAIL", adminIdentity.email);
    vi.stubEnv("OTTAM_ADMIN_CLERK_USER_ID", adminIdentity.subject);
    const t = convexTest(schema, modules).withIdentity(adminIdentity);
    const seriesId = await t.mutation(api.series.createDraft, {
      description: "A transmission follows the listener through the city.",
      genre: "Sci-fi thriller",
      slug: "the-signal",
      title: "The Signal",
    });
    const created = await t.action(api.studioActions.createDraftEpisode, {
      idempotencyKey: "approval_episode_123",
      seriesId,
      slug: "the-first-transmission",
      synopsis: "A receiver wakes up when the listener begins moving.",
      title: "The First Transmission",
    });
    const scene = {
      durationSeconds: 45,
      kind: "core" as const,
      script: "The receiver clicks on as you begin moving.",
      sortOrder: 0,
      stableKey: "opening",
      title: "Opening",
    };
    const proposal = await t.action(api.studioActions.proposeChangeSet, {
      baseRevisionId: created.revisionId,
      episodeId: created.episodeId,
      proposalJson: JSON.stringify({
        operations: [{ after: scene, before: null, entity: "scene" }],
        summary: "Add the opening scene.",
      }),
    });
    const applyArgs = {
      changeSetId: proposal.changeSetId,
      expectedEpisodeId: created.episodeId,
      expectedProposalHash: proposal.proposalHash,
    };

    await expect(
      t.action(api.studioActions.applyChangeSet, applyArgs),
    ).rejects.toThrow("cannot be applied");
    expect((await t.query(api.studio.workspace, {
      episodeId: created.episodeId,
    })).scenes).toHaveLength(0);

    await t.action(api.studioActions.approveChangeSet, applyArgs);
    const revisionId = await t.action(
      api.studioActions.applyChangeSet,
      applyArgs,
    );
    await expect(
      t.action(api.studioActions.applyChangeSet, applyArgs),
    ).resolves.toBe(revisionId);
    expect((await t.query(api.studio.workspace, {
      episodeId: created.episodeId,
    })).scenes).toMatchObject([scene]);
  });

  test("cannot start an audio job before its exact approval", async () => {
    vi.stubEnv("ELEVENLABS_DAILY_CREDIT_CEILING", "10000");
    vi.stubEnv("OTTAM_ADMIN_EMAIL", adminIdentity.email);
    vi.stubEnv("OTTAM_ADMIN_CLERK_USER_ID", adminIdentity.subject);
    const t = convexTest(schema, modules).withIdentity(adminIdentity);
    const seriesId = await t.mutation(api.series.createDraft, {
      description: "A transmission follows the listener through the city.",
      genre: "Sci-fi thriller",
      slug: "the-signal",
      title: "The Signal",
    });
    const created = await t.action(api.studioActions.createDraftEpisode, {
      idempotencyKey: "audio_episode_12345",
      seriesId,
      slug: "the-first-transmission",
      synopsis: "A receiver wakes up when the listener begins moving.",
      title: "The First Transmission",
    });
    const script = "The receiver clicks on as you begin moving.";
    const proposal = await t.action(api.studioActions.proposeChangeSet, {
      baseRevisionId: created.revisionId,
      episodeId: created.episodeId,
      proposalJson: JSON.stringify({
        operations: [
          {
            after: {
              durationSeconds: 45,
              kind: "core",
              script,
              sortOrder: 0,
              stableKey: "opening",
              title: "Opening",
            },
            before: null,
            entity: "scene",
          },
        ],
        summary: "Add the opening scene.",
      }),
    });
    const applyArgs = {
      changeSetId: proposal.changeSetId,
      expectedEpisodeId: created.episodeId,
      expectedProposalHash: proposal.proposalHash,
    };
    await t.action(api.studioActions.approveChangeSet, applyArgs);
    const revisionId = await t.action(
      api.studioActions.applyChangeSet,
      applyArgs,
    );
    const workspace = await t.query(api.studio.workspace, {
      episodeId: created.episodeId,
    });
    const sceneId = workspace.scenes[0]?._id;
    if (!sceneId) throw new Error("Test scene was not created.");
    const voiceId = await t.mutation(api.voices.registerLicensedLibraryVoice, {
      displayName: "Test library voice",
      elevenLabsVoiceId: "library_voice_123",
      licenseReference: "test-license",
      provenance: "Automated fake-provider fixture",
    });
    const agentRunId = await t.action(api.studioActions.beginAgentRun, {
      baseRevisionId: revisionId,
      chatId: created.chatId,
      model: "test/deepseek-v4-flash",
      runId: "run_audio_approval_123",
    });
    const request = await t.action(api.mediaActions.proposeAudioGeneration, {
      agentRunId,
      episodeId: created.episodeId,
      requestJson: JSON.stringify({
        candidateCount: 1,
        modelId: "eleven_multilingual_v2",
        outputFormat: "mp3_44100_128",
        sceneId,
        script,
        voiceId,
        voiceSettings: {
          similarityBoost: 0.75,
          speed: 1,
          stability: 0.5,
          style: 0.2,
          useSpeakerBoost: true,
        },
      }),
    });

    await expect(
      t.action(api.mediaNode.generateAudioCandidates, {
        episodeId: created.episodeId,
        requestHash: request.requestHash,
        toolInvocationId: request.toolInvocationId,
      }),
    ).rejects.toThrow("matching audio approval is required");
    await expect(
      t.run(async (ctx) => ({
        assets: await ctx.db.query("audioAssets").take(1),
        jobs: await ctx.db.query("generationJobs").take(1),
      })),
    ).resolves.toEqual({ assets: [], jobs: [] });
  });
});
