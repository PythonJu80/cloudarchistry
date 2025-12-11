/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  eslint: {
    // Disable ESLint during production builds (run separately in CI)
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Skip type checking during build (run separately in CI)
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'maps.googleapis.com',
      },
      {
        protocol: 'https',
        hostname: '*.tile.openstreetmap.org',
      },
    ],
  },
  // Transpile leaflet for SSR
  transpilePackages: ['react-leaflet', 'leaflet'],
};

export default nextConfig;
