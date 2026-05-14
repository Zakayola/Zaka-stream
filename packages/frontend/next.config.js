/**
 * next.config.js — Next.js 14 configuration for Zaka-Stream
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000"],
    },
  },
  // Allow the Freighter API (browser-only) to be imported server-side without crashing
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }

    // stellar-sdk optionally uses sodium-native (a native Node binary) for
    // signing. It falls back to tweetnacl/WASM in browsers. Mark it external
    // so webpack doesn't try to bundle it and emit "critical dependency" warnings.
    config.externals = [
      ...(Array.isArray(config.externals) ? config.externals : []),
      "sodium-native",
      "require-addon",
    ];

    return config;
  },
};

module.exports = nextConfig;
