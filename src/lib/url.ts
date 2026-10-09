/** Public base URL used in emailed links. Never derived from request headers. */
export function getBaseUrl(): string {
  const url =
    process.env.AUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    'http://localhost:3000'
  return url.replace(/\/+$/, '')
}
