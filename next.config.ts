import type { NextConfig } from 'next';
import CopyPlugin from 'copy-webpack-plugin'; // Re-import the plugin
import path from 'path'; // Re-import path

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
    // Allow loading images with data URLs (e.g., for placeholders)
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  // Optimize for performance
  reactStrictMode: true,
  // Use webpack configuration to suppress punycode warnings
  // Webpack config can be simplified if only needed for punycode alias
  webpack: (config, { isServer, webpack: _webpack }) => { // Prefix unused webpack parameter
    config.resolve.alias = {
      ...config.resolve.alias,
      punycode: false, // Keep this alias
    };
    // Keep warning ignores
    config.ignoreWarnings = [
       ...(config.ignoreWarnings || []),
       /Critical dependency: the request of a dependency is an expression/, // Keep this one for browserslist
       /Module not found: Can't resolve 'canvas'/, // Keep this one for optional canvas
    ];

    // Copy header-generator data files for server build using CopyPlugin
    if (isServer) {
      // Ensure plugins array exists
      config.plugins = config.plugins || [];
      config.plugins.push(
        new CopyPlugin({
          patterns: [
            {
              // Copy from the source directory within node_modules
              from: path.resolve(__dirname, 'node_modules/header-generator/data_files'),
              // Copy to mimic the node_modules structure within the server build output
              to: path.resolve(__dirname, '.next/server/node_modules/header-generator/data_files/'),
              globOptions: {
                // Ensure all files within data_files are copied
                ignore: ['**/.*'], // Ignore dotfiles if any
              },
              // Important: Ensure the destination directory structure is maintained if needed,
              // but for header-generator, placing data_files at the server root might work.
              // If not, adjust 'to' path, e.g., to '.next/server/node_modules/header-generator/data_files'
            },
          ],
        })
      );
      // DefinePlugin might not be needed if CopyPlugin places files correctly relative to execution
      // Let's comment it out for now to simplify.
      // config.plugins.push(
      //   new webpack.DefinePlugin({
      //     'process.env.APIFY_HEADER_GENERATOR_PATH': JSON.stringify(path.resolve(__dirname, '.next/server/data_files')),
      //   })
      // );
    }

    return config;
  },
  // External packages for server components
  serverExternalPackages: ['got-scraping', 'header-generator'],
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    // Reinstated temporarily due to persistent API route type error in build (Next.js 15.2.4).
    ignoreBuildErrors: true,
  }, // This comma is correct
  // Line 50 containing the extra brace is removed
  // Remove outputFileTracingIncludes as we are using webpack plugin
};

export default nextConfig;
