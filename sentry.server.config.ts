import * as Sentry from '@sentry/nextjs'

/**
 * Sentry — Server-side error monitoring (API routes, SSR, etc.)
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  debug: false,
  enabled: process.env.NODE_ENV === 'production',
})
