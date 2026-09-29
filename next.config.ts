import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  async rewrites() {
    return [
      { source: '/money', destination: '/money/index.html' },
    ]
  },
  async redirects() {
    return [
      { source: '/', destination: '/combined', permanent: false },
    ]
  },
};

export default nextConfig;