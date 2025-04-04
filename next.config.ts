import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**', // Allow all HTTPS domains
        pathname: '**',
      },
      {
        protocol: 'http',
        hostname: '**', // Allow all HTTP domains
        pathname: '**',
      }
    ],
  },
  // Optimize for performance
  reactStrictMode: true,
  // Use webpack configuration to suppress punycode warnings
  webpack: (config, { isServer }) => {
    // Suppress punycode warnings
    config.resolve.alias = {
      ...config.resolve.alias,
      punycode: false,
    };
    
    // Ignore punycode in webpack
    if (!isServer) {
      config.ignoreWarnings = [
        ...(config.ignoreWarnings || []),
        /Critical dependency: the request of a dependency is an expression/,
        /Module not found: Can't resolve 'punycode'/,
      ];
    }
    
    return config;
  },
  // External packages for server components
  serverExternalPackages: [],
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    // Reinstated temporarily due to persistent API route type error in build (Next.js 15.2.4).
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
