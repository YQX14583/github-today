import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GitHub Today",
    short_name: "GitHub Today",
    description: "每日 GitHub Trending 中文阅读",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f6f8fa",
    theme_color: "#24292f",
    lang: "zh-CN",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable"
      }
    ]
  };
}
