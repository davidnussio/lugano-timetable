import type { MetadataRoute } from "next";

const shortcutIcon = (name: string) => [
  { src: `/shortcut-icon/${name}`, sizes: "96x96", type: "image/png" },
];

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
    // Long press on the app icon (Android, desktop Chrome)
    shortcuts: [
      {
        name: "Fermate vicino a me",
        short_name: "Vicino a me",
        description: "Le fermate più vicine alla tua posizione",
        url: "/?vicino=1",
        icons: shortcutIcon("vicino"),
      },
      {
        name: "Tragitto",
        short_name: "Tragitto",
        description: "Cerca un collegamento tra due fermate",
        url: "/tragitto",
        icons: shortcutIcon("tragitto"),
      },
      {
        name: "Timer",
        short_name: "Timer",
        description: "Quando uscire per prendere il bus",
        url: "/timer",
        icons: shortcutIcon("timer"),
      },
    ],
  };
}
