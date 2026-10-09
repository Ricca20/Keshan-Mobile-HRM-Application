import { timingSafeEqual } from 'crypto'

/** Validates Vercel's `Authorization: Bearer <CRON_SECRET>` header. Fails closed if the secret is unset. */
export function isAuthorizedCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret || secret.length < 16) {
    console.error('CRON_SECRET is missing or too short; refusing cron request.')
    return false
  }

  const received = Buffer.from(req.headers.get('authorization') ?? '')
  const expected = Buffer.from(`Bearer ${secret}`)
  return received.length === expected.length && timingSafeEqual(received, expected)
}
