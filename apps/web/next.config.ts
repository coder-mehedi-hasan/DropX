import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /**
   * `@dropx/ui` ships raw TSX, so Next has to compile it rather than treat it
   * as a prebuilt dependency.
   */
  transpilePackages: ["@dropx/ui"],
  typedRoutes: false,
}

export default nextConfig

import("@opennextjs/cloudflare").then((module) => module.initOpenNextCloudflareForDev())
