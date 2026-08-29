import type { MetadataRoute } from "next";
import { PUBLIC_ROUTES } from "./site-discovery";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: PUBLIC_ROUTES.home.url,
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
