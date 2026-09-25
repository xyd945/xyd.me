import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  ...(process.env.NODE_ENV === "development"
    ? { rewrites: async () => [{ source: "/api/:path*", destination: "http://127.0.0.1:8787/api/:path*" }] }
    : { output: "export" as const }),
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
