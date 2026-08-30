import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // "standalone" is needed for the self-hosted Dockerfile but conflicts with Vercel's own
  // build/output tracing, so only apply it outside Vercel (which sets VERCEL=1 during builds).
  output: process.env.VERCEL ? undefined : "standalone",
};

export default nextConfig;
