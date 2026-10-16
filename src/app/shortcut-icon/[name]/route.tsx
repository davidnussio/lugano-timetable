import { ImageResponse } from "next/og";
import { IconTile } from "../../app-icon";

// Icons of the shortcuts in the web manifest (long press on the app icon).
// 96px is the size Android and Chrome ask for; the glyphs match the ones the
// app shows next to the same pages.
const SIZE = 96;

// Satori only renders plain SVG elements: a group, not a fragment
const glyphs = {
  // LocateFixed, as on the "Vicino a me" button
  vicino: (
    <g>
      <path d="M2 12h3" />
      <path d="M19 12h3" />
      <path d="M12 2v3" />
      <path d="M12 19v3" />
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="3" />
    </g>
  ),
  // Route, as in the stops header
  tragitto: (
    <g>
      <circle cx="6" cy="19" r="3" />
      <path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" />
      <circle cx="18" cy="5" r="3" />
    </g>
  ),
  timer: (
    <g>
      <path d="M10 2h4" />
      <path d="M12 14l3-3" />
      <circle cx="12" cy="14" r="8" />
    </g>
  ),
};

type Name = keyof typeof glyphs;

// Rendered once at build time: the icons never change
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams(): Array<{ name: Name }> {
  return Object.keys(glyphs).map((name) => ({ name: name as Name }));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const glyph = glyphs[name as Name];
  if (!glyph) return new Response("Not found", { status: 404 });
  return new ImageResponse(
    <IconTile size={SIZE} radius={21}>
      {glyph}
    </IconTile>,
    { width: SIZE, height: SIZE }
  );
}
