const isLocal = (url: string) => /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?/i.test(url)

/**
 * Public base URL used in emailed links. Never derived from request headers.
 *
 * Order: APP_URL, AUTH_URL, NEXT_PUBLIC_APP_URL, NEXTAUTH_URL, then the URL Vercel
 * gives the deployment. On Vercel a localhost value is skipped, so a copied local
 * .env can never put "http://localhost:3000" links into real emails.
 */
export function getBaseUrl(): string {
  const onVercel = !!process.env.VERCEL
  const vercelHost =
    process.env.VERCEL_ENV === 'production'
      ? process.env.VERCEL_PROJECT_PRODUCTION_URL
      : process.env.VERCEL_BRANCH_URL || process.env.VERCEL_URL

  const candidates = [
    process.env.APP_URL,
    process.env.AUTH_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXTAUTH_URL,
    vercelHost && `https://${vercelHost}`,
  ]

  const url = candidates.find(u => u && !(onVercel && isLocal(u))) || 'http://localhost:3000'
  return url.trim().replace(/\/+$/, '')
}
