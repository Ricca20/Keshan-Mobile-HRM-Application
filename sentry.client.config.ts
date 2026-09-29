import * as Sentry from '@sentry/nextjs'

/**
 * Sentry — Client-side error monitoring
 * Set NEXT_PUBLIC_SENTRY_DSN in your Vercel env variables to enable.
 * Get your DSN from: https://sentry.io → Projects → Your Project → Settings → Client Keys
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1, // 10% of transactions — adjust as needed
  debug: false,
  enabled: process.env.NODE_ENV === 'production',
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
  replaysSessionSampleRate: 0.05,
  replaysOnErrorSampleRate: 1.0,
})
