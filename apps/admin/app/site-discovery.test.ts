import { describe, expect, it } from "vitest";
import { GET as getLlmsIndex } from "./llms.txt/route";
import robots from "./robots";
import { PUBLIC_ROUTES } from "./site-discovery";
import sitemap from "./sitemap";

describe("public recovery endpoints", () => {
  it("publishes the public home page in the sitemap", () => {
    expect(sitemap()).toEqual([
      {
        url: PUBLIC_ROUTES.home.url,
        changeFrequency: "monthly",
        priority: 1,
      },
    ]);
  });

  it("keeps private APIs out of crawlers and advertises the sitemap", () => {
    expect(robots()).toEqual({
      rules: {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/"],
      },
      sitemap: PUBLIC_ROUTES.sitemap.url,
    });
  });

  it("serves a plain-text agent index with valid recovery links", async () => {
    const response = getLlmsIndex();
    const body = await response.text();

    expect(response.headers.get("content-type")).toBe(
      "text/plain; charset=utf-8",
    );
    expect(body).toContain(PUBLIC_ROUTES.home.url);
    expect(body).toContain(PUBLIC_ROUTES.sitemap.url);
    expect(body).toContain(PUBLIC_ROUTES.robots.url);
  });
});
