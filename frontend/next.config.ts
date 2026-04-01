import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['cesium'],
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_CESIUM_BASE_URL: process.env.NEXT_PUBLIC_CESIUM_BASE_URL,
  },
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
    }; // Cesium runs fully in browser
    return config;
  },
};

export default nextConfig;
