import { withSentryConfig } from '@sentry/nextjs'

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_FF_CONSTRUCTION_DOCS_V1:
      process.env.NEXT_PUBLIC_FF_CONSTRUCTION_DOCS_V1 || process.env.FEATURE_CONSTRUCTION_DOCS || 'false',
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'ui-avatars.com' },
    ],
  },
};

export default withSentryConfig(nextConfig, {
  silent: true,
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
  },
});
