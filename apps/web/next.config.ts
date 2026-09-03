import type { NextConfig } from 'next';

// Keep Next.js strict while allowing optimized rendering of provider-hosted product images.
const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    // Product photos are supplied by the Open Food Facts API at runtime.
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.openfoodfacts.org',
        pathname: '/images/products/**',
      },
    ],
  },
};

export default nextConfig;
