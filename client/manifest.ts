import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Likeson Healthcare | Premium Medical Services & Family Care",
    short_name: "Likeson",
    description:
      "A comprehensive, tech-enabled healthcare solution delivering essential medical transport, doctor consultations, premium home care, pharmacy deliveries, and lab diagnostics.",
    start_url: "/",
    display: "standalone",
    background_color: "oklch(100% 0 0)",
    theme_color: "oklch(54% 0.19 242)",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "16x16 24x24 32x32",
        type: "image/x-icon",
      },
    ],
  };
}
