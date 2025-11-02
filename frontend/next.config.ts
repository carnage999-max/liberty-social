import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.s3.amazonaws.com",
        pathname: "/uploads/**",
      },
    ],
    unoptimized: isDev || process.env.NEXT_IMAGE_UNOPTIMIZED === "true",
    minimumCacheTTL: 60,
  },
};

export default nextConfig;
