/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Self-contained build output (.next/standalone → `node server.js`) — a small, fast deploy artifact
  // for AWS/EC2 that doesn't require shipping node_modules.
  output: "standalone",
  // Hide the floating Next.js dev indicator ("N" badge) shown in the corner during `next dev`.
  devIndicators: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "api.dicebear.com" },
      { protocol: "https", hostname: "cdn.jsdelivr.net" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
