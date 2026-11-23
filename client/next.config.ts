import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  // Disables development indicator
  devIndicators: false,

  // Enable gzip/brotli compression
  compress: true,

  // Disable x-powered-by header
  poweredByHeader: false,

  // Tree-shake large packages automatically
  experimental: {
    optimizePackageImports: ["lucide-react", "react-icons", "dayjs", "@radix-ui/react-icons"],
  },

  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
      {
        protocol: "http",
        hostname: "**",
      },
    ],
  },
};

export default nextConfig;
