import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
        pathname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
        pathname: '**',
      }
    ],
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  reactStrictMode: true,
  webpack: (config, { isServer: _isServer }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      punycode: false,
    };
    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      /Critical dependency: the request of a dependency is an expression/,
      /Module not found: Can't resolve 'canvas'/,
    ];

    return config;
  },
  serverExternalPackages: ['got-scraping', 'header-generator'],
};

export default nextConfig;
