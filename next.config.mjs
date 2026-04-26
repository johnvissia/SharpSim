/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'a.espncdn.com',
      },
    ],
  },
  experimental: {
    serverExternalPackages: ['genkit', 'express', 'firebase-admin'],
  },
};

export default nextConfig;
