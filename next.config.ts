import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hides the dev-mode "N" route indicator overlay - these pages are meant
  // to be embedded as-is, so nothing dev-tooling-related should show over
  // them even while running locally.
  devIndicators: false,
};

export default nextConfig;
