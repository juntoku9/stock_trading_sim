import path from 'node:path';

const nextConfig = {
  outputFileTracingRoot: path.resolve(process.cwd()),
  eslint: {
    // Lint runs as its own script/CI step (`npm run lint`); keeping it out of
    // `next build` keeps production builds fast and non-flaky.
    ignoreDuringBuilds: true,
  },
  experimental: {
    // In-process compilation: the separate build worker can crash (SIGBUS) in
    // memory-constrained/sandboxed environments with a small /dev/shm.
    webpackBuildWorker: false,
  },
};

export default nextConfig;
