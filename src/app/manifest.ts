import type { MetadataRoute } from "next";
import { withBasePath } from "@/lib/config/site";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hello! My Paso!",
    short_name: "My Paso",
    description: "Local-first life logging PWA for footsteps, places, and XP.",
    start_url: withBasePath("/"),
    display: "standalone",
    background_color: "#0c0a09",
    theme_color: "#fbbf24",
    icons: [
      {
        src: withBasePath("/favicon.ico"),
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
