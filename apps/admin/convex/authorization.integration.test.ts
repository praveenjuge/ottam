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
});
