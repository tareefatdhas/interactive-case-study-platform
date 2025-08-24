import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // Temporarily ignore type errors during build
    ignoreBuildErrors: process.env.NODE_ENV === 'production',
  },
  eslint: {
    // Allow production builds to complete even if there are ESLint errors
    ignoreDuringBuilds: process.env.NODE_ENV === 'production',
  },
  turbopack: {
    root: "/Users/tareefjafferi/Documents/repo/interactive-case-study/case-study-platform"
  }
};

export default nextConfig;
