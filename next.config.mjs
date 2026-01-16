/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // ⚠️ Temporarily ignore TypeScript errors during build for production deployment
    ignoreBuildErrors: true,
  },
  eslint: {
    // ⚠️ Temporarily ignore ESLint errors during build for production deployment
    ignoreDuringBuilds: true,
  },
  experimental: {
    // Enable instrumentation hook for server initialization (cron jobs)
    // This allows instrumentation.ts to run on server startup
    instrumentationHook: true,
  },
};

export default nextConfig;
