/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['archiver'],
  },
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'cmojiang.vercel.app' }],
        destination: 'https://www.cmojiang.com/:path*',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
