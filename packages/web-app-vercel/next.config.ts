import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const nextConfig: NextConfig = {
  // Node.js APIを使用するため、serverExternalPackagesに追加
  serverExternalPackages: [
    "@mozilla/readability",
    "linkedom",
    "@google-cloud/text-to-speech",
  ],

  // API Routesの明示的な設定
  experimental: {
    // turbopackでのAPI Routes処理を改善
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },

  // Next 16以降は Turbopack がデフォルトのため、空の設定を明示
  turbopack: {},

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },
};

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV !== "production",
});

export default withSerwist(nextConfig);
