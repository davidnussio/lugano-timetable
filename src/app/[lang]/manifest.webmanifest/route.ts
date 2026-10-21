import type { MetadataRoute } from "next";
import { isLocale, locales } from "~/i18n/config";
import { messages } from "~/i18n/messages";

const shortcutIcon = (name: string) => [
  { src: `/shortcut-icon/${name}`, sizes: "96x96", type: "image/png" },
];

// One per language, at /manifest.webmanifest through the proxy: an installed
// app keeps the language it was installed in
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

// Installing the app on the home screen is required for notifications on iOS
export async function GET(_request: Request, { params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) return new Response("Not found", { status: 404 });
  const m = messages[lang].manifest;
  const manifest: MetadataRoute.Manifest = {
    name: "Lugano Bus",
    short_name: "Lugano Bus",
    description: messages[lang].meta.description,
    lang,
    start_url: "/",
    display: "standalone",
    background_color: "#f6f7f9",
    theme_color: "#f6f7f9",
    icons: [{ src: "/icon", sizes: "512x512", type: "image/png" }],
    // Long press on the app icon (Android, desktop Chrome)
    shortcuts: [
      {
        name: m.nearMe.name,
        short_name: m.nearMe.shortName,
        description: m.nearMe.description,
        url: "/?vicino=1",
        icons: shortcutIcon("vicino"),
      },
      {
        name: m.journey.name,
        short_name: m.journey.shortName,
        description: m.journey.description,
        url: "/tragitto",
        icons: shortcutIcon("tragitto"),
      },
      {
        name: m.timer.name,
        short_name: m.timer.shortName,
        description: m.timer.description,
        url: "/timer",
        icons: shortcutIcon("timer"),
      },
    ],
  };
  return Response.json(manifest, {
    headers: { "Content-Type": "application/manifest+json" },
  });
}
