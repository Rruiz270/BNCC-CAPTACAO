import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['better-sqlite3'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'apm-fundeb-sp.vercel.app' },
    ],
  },
};

export default nextConfig;
