import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Curated guides are read from disk at request time; make sure they ship with the functions.
  outputFileTracingIncludes: { "/**": ["./data/guides/**"] },
};

export default nextConfig;
