/** @type {import('next').NextConfig} */
const nextConfig = {
  // The MapLibre worker, copied under its version (scripts/copy-maplibre.mjs)
  async headers() {
    return [
      {
        source: "/maplibre/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "bs.tplsa.ch",
      },
    ],
  },
};

export default nextConfig;
