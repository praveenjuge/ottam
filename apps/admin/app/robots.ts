import type { MetadataRoute } from "next";
import { PUBLIC_ROUTES } from "./site-discovery";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/"],
    },
    sitemap: PUBLIC_ROUTES.sitemap.url,
  };
}
