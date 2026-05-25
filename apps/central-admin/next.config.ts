import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true
  },
  poweredByHeader: false,
  reactStrictMode: true,
  transpilePackages: ["@commerce-os/auth-core", "@commerce-os/tenant-core", "@commerce-os/ui-system"]
};

export default nextConfig;
