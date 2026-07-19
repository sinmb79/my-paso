import type { MetadataRoute } from "next";
import { withBasePath } from "@/lib/config/site";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hello! My Paso!",
    short_name: "My Paso",
    description: "Local-first journal for places, visits, reviews, and XP.",
    start_url: withBasePath("/"),
    display: "standalone",
    background_color: "#0c0a09",
    theme_color: "#fbbf24",
    categories: ["lifestyle", "travel"],
    icons: [
      {
        src: withBasePath("/icon-192.svg"),
        sizes: "192x192",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: withBasePath("/icon-512.svg"),
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
