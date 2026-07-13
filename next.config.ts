import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The authenticated "/" route reads public/demo.html at runtime. Vercel's
  // serverless functions don't include public/ by default, so force-include it
  // in that function's file trace. (The demo's assets — time-invoicing.js,
  // sellhi-voice-clips.js, /music/*, favicons — are served statically from public/.)
  outputFileTracingIncludes: {
    "/": ["./public/demo.html"],
  },
};

export default nextConfig;
