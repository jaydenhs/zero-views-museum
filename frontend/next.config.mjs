const nextConfig = {
  reactStrictMode: false,
  experimental: {
    turbo: {
      resolveExtensions: [
        ".mdx",
        ".tsx",
        ".ts",
        ".jsx",
        ".js",
        ".mjs",
        ".json",
      ],
    },
  },
  webpack: (config) => {
    config.experiments = { asyncWebAssembly: true, layers: true };
    return config;
  },
};

export default nextConfig;
