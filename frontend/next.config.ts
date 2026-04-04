import type { NextConfig } from 'next';

const backendInternalBase =
  (process.env.BACKEND_INTERNAL_URL || 'http://localhost:8000').replace(/\/$/, '');

const nextConfig: NextConfig = {
  transpilePackages: ['cesium'],
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '/api/v1',
    NEXT_PUBLIC_CESIUM_BASE_URL: process.env.NEXT_PUBLIC_CESIUM_BASE_URL,
  },
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${backendInternalBase}/api/v1/:path*`,
      },
    ];
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
