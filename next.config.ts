import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  async redirects() {
    return [
      { source: '/', destination: '/combined', permanent: false },
    ]
  },
};

export default nextConfig;