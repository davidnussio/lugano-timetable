/** @type {import('next').NextConfig} */
const nextConfig = {
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
