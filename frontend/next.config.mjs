const nextConfig = {
  reactStrictMode: false,
  // Disable turbo for better Wi-Fi compatibility
  experimental: {
    // turbo: {
    //   resolveExtensions: [
    //     ".mdx",
    //     ".tsx",
    //     ".ts",
    //     ".jsx",
    //     ".js",
    //     ".mjs",
    //     ".json",
    //   ],
    // },
  },
  // Add output configuration for better static asset handling
  output: "standalone",
  // Configure asset prefix for Wi-Fi access
  assetPrefix: process.env.NODE_ENV === "production" ? "" : "",
  // Add trailing slash for better routing
  trailingSlash: false,
  // API routes are handled by Next.js API routes instead of rewrites
  // This provides better error handling and SSL certificate management
  // Add caching headers for better reliability
  async headers() {
    return [
      {
        source: "/_next/static/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
          {
            key: "Access-Control-Allow-Origin",
            value: "*",
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, OPTIONS",
          },
        ],
      },
      {
        source: "/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate",
          },
          {
            key: "Access-Control-Allow-Origin",
            value: "*",
          },
          // VR/Quest 2 specific headers
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: https:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https: blob:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: blob: https:; connect-src 'self' https: wss:; frame-src 'self' https:; worker-src 'self' blob: data:; child-src 'self' blob: data:; object-src 'none'; base-uri 'self';",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
    ];
  },
  // Add compression for better performance
  compress: true,
  // Optimize for offline usage
  generateEtags: true,
  webpack: (config, { dev, isServer }) => {
    config.experiments = { asyncWebAssembly: true, layers: true };

    // Add better error handling for chunk loading
    config.optimization = {
      ...config.optimization,
      splitChunks: {
        chunks: "all",
        maxInitialRequests: 30,
        maxAsyncRequests: 30,
        cacheGroups: {
          default: {
            minChunks: 2,
            priority: -20,
            reuseExistingChunk: true,
          },
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: "vendors",
            priority: -10,
            chunks: "all",
          },
        },
      },
    };

    // // Add better error handling for chunk loading failures
    // if (!isServer) {
    //   config.resolve.fallback = {
    //     ...config.resolve.fallback,
    //     fs: false,
    //     net: false,
    //     tls: false,
    //   };
    // }

    // // Add retry logic for chunk loading
    // config.module.rules.push({
    //   test: /\.(js|jsx|ts|tsx)$/,
    //   use: {
    //     loader: "babel-loader",
    //     options: {
    //       presets: ["next/babel"],
    //       plugins: [
    //         // Add retry logic for dynamic imports
    //         ["@babel/plugin-syntax-dynamic-import", { loose: true }],
    //       ],
    //     },
    //   },
    // });

    return config;
  },
};

export default nextConfig;
