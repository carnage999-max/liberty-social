import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    typedRoutes: true,
  },
  eslint: {
    // Allow building even if eslint fails; Amplify/CI can run lint separately.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
