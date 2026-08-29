import { PUBLIC_ROUTES } from "../site-discovery";

const llmsIndex = `# Ottam

> Ottam is an adaptive audio-story running app. This site hosts the private Ottam Studio.

## Public pages

- [Home](${PUBLIC_ROUTES.home.url}): Sign-in entry point for the private production studio.

## Discovery

- [Sitemap](${PUBLIC_ROUTES.sitemap.url})
- [Robots](${PUBLIC_ROUTES.robots.url})
`;

export function GET() {
  return new Response(llmsIndex, {
    headers: {
      "Cache-Control": "public, max-age=3600",
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
