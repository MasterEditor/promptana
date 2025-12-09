import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,

  // Image optimization - use unoptimized for Cloudflare Polish
  images: {
    remotePatterns: [],
    unoptimized: true,
  },
};

export default nextConfig;
