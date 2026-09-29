import type { NextConfig } from "next";

const baseConfig: NextConfig = {
  // Ensure server always runs in Sri Lanka time
  env: {
    TZ: 'Asia/Colombo',
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self' data:; connect-src 'self' https://*.sentry.io;"
          }
        ]
      }
    ]
  }
};

// Wrap with Sentry only when the package is available
let nextConfig: NextConfig = baseConfig
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { withSentryConfig } = require('@sentry/nextjs')
  nextConfig = withSentryConfig(baseConfig, {
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    authToken: process.env.SENTRY_AUTH_TOKEN,
    silent: true,
    disableLogger: true,
    tunnelRoute: '/monitoring',
    hideSourceMaps: true,
  })
} catch {
  // @sentry/nextjs not installed yet — run without it
}

export default nextConfig;
