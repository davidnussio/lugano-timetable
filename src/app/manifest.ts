import type { MetadataRoute } from "next";

// Installing the app on the home screen is required for notifications on iOS
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Lugano Bus",
    short_name: "Lugano Bus",
    description: "Partenze in tempo reale dei bus TPL di Lugano",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f7f9",
    theme_color: "#f6f7f9",
    icons: [{ src: "/icon", sizes: "512x512", type: "image/png" }],
  };
}
