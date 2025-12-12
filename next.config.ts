import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // instrumentation.ts is available by default in Next.js 16+
  output: "standalone", // Enable standalone output for Docker
};

export default nextConfig;
