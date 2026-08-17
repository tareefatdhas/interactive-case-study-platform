import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep local development output separate from production builds. Running
  // `next build` while the classroom preview is open must not invalidate the
  // files used by the development server.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  devIndicators: false,
  turbopack: {
    root: process.cwd()
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" }
    ]
  },
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.classfully.com' }],
        destination: 'https://classfully.com/:path*',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
