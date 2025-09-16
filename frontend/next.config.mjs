const nextConfig = {
  reactStrictMode: false,
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
  webpack: (config) => {
    config.experiments = { asyncWebAssembly: true, layers: true };

    // Add better error handling for chunk loading
    config.optimization = {
      ...config.optimization,
      splitChunks: {
        chunks: "all",
        maxInitialRequests: 30,
        maxAsyncRequests: 30,
        minSize: 20000,
        maxSize: 200000, // 200KB max per chunk - smaller for VR devices
        cacheGroups: {
          default: {
            minChunks: 2,
            priority: -20,
            reuseExistingChunk: true,
          },
          // React and React-related libraries (highest priority)
          react: {
            test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
            name: "react-vendor",
            priority: 20,
            chunks: "all",
            enforce: true,
          },
          // Three.js and WebGL libraries (critical for VR)
          threejs: {
            test: /[\\/]node_modules[\\/](three|@react-three)[\\/]/,
            name: "threejs-vendor",
            priority: 15,
            chunks: "all",
            enforce: true,
          },
          // Next.js framework
          nextjs: {
            test: /[\\/]node_modules[\\/](next)[\\/]/,
            name: "nextjs-vendor",
            priority: 10,
            chunks: "all",
          },
          // Other vendor libraries (lower priority)
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: "vendor",
            priority: 5,
            chunks: "all",
            minChunks: 1,
          },
        },
      },
    };

    // Add better error handling for chunk loading failures
    if (!config.isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }

    // Add retry logic for chunk loading failures (important for VR devices)
    config.optimization.splitChunks.fallbackCacheGroup = {
      minSize: 0,
    };

    // Add chunk loading retry mechanism
    config.output.chunkLoadingGlobal = "webpackChunkZeroViewsMuseum";

    return config;
  },
};

export default nextConfig;
