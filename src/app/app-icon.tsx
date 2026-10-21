// White glyph on a blue rounded square, shared by the app and shortcut icons
export function IconTile({
  size,
  radius,
  children,
}: {
  size: number;
  radius: number;
  children: React.ReactNode;
}) {
  const glyph = size * 0.58;
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: radius,
        background: "linear-gradient(135deg, #4f6bff 0%, #2f3fd6 100%)",
      }}>
      <svg
        width={glyph}
        height={glyph}
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round">
        {children}
      </svg>
    </div>
  );
}

// The LuGo mark, shared by icon and apple-icon: a countdown ring closing as
// the ride (the orange dot) reaches the stop in the middle
export function AppIcon({ size, radius }: { size: number; radius: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        borderRadius: radius,
        background: "linear-gradient(135deg, #4f6bff 0%, #2f3fd6 100%)",
      }}>
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
        {logoGlyph}
      </svg>
    </div>
  );
}

// The drawing of the mark on a 100×100 view box, also in the stops header.
// An element, not a component: Satori only renders plain SVG elements
export const logoGlyph = (
  <g>
    <circle cx="50" cy="50" r="27" stroke="white" strokeOpacity={0.22} strokeWidth={10} />
    <path d="M50 23 A27 27 0 1 1 23 50" stroke="white" strokeWidth={10} strokeLinecap="round" />
    <circle cx="23" cy="50" r="9" fill="#ff7a59" stroke="#2f3fd6" strokeWidth={3} />
    <circle cx="50" cy="50" r="7" fill="white" />
  </g>
);
