/** @type {import('next').NextConfig} */
const nextConfig = {
  output: process.env.NEXT_PUBLIC_APP_MODE === 'local' ? 'export' : undefined,
  // Generate upload/index.html instead of upload.html — required for StaticFiles(html=True)
  trailingSlash: true,
  // Proxy API requests to backend in development
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8000/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
