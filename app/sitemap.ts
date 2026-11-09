import type { MetadataRoute } from "next";
import { GUIDES } from "@/lib/guides";
import { MODULES } from "@/lib/modules";

const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://phonecare.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = ["", "/diagnostics", "/results", "/assistant", "/guides", "/methodology"];
  return [
    ...staticRoutes.map((route) => ({
      url: `${base}${route}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: route === "" ? 1 : 0.8,
    })),
    ...MODULES.map((mod) => ({
      url: `${base}${mod.href}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...GUIDES.map((guide) => ({
      url: `${base}/guides/${guide.slug}`,
      lastModified: new Date(guide.updated),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
