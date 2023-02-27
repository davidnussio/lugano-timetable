export const shimmer = (
  w: number,
  h: number,
  color: { from: string; via: string; to: string } = {
    from: "#333",
    via: "#222",
    to: "#333",
  }
) => `
<svg width="${w}" height="${h}" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <linearGradient id="g">
      <stop stop-color="${color.from}" offset="20%" />
      <stop stop-color="${color.via}" offset="50%" />
      <stop stop-color="${color.to}" offset="70%" />
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="#333" />
  <rect id="r" width="${w}" height="${h}" fill="url(#g)" />
  <animate xlink:href="#r" attributeName="x" from="-${w}" to="${w}" dur="1s" repeatCount="indefinite"  />
</svg>`;
