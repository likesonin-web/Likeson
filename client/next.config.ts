import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disables the Next.js development indicator in the bottom right corner
  devIndicators: false,
  
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**', // Wildcard for all HTTPS domains
      },
      {
        protocol: 'http',
        hostname: '**', // Wildcard for all HTTP domains
      },
    ],
  },
};

export default nextConfig;