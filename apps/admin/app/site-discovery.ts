export const SITE_URL = "https://ottam.praveenjuge.com";
export const SITE_HOST = new URL(SITE_URL).host;

function publicRoute<const Path extends string>(path: Path) {
  return { path, url: new URL(path, SITE_URL).href } as const;
}

export const PUBLIC_ROUTES = {
  home: publicRoute("/"),
  llms: publicRoute("/llms.txt"),
  robots: publicRoute("/robots.txt"),
  sitemap: publicRoute("/sitemap.xml"),
} as const;
