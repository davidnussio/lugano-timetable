/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
  images: {
    domains: ["bs.tplsa.ch"],
  },
};

module.exports = nextConfig;
