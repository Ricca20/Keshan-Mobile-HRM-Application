import { isIP } from 'net'
import { prisma } from '@/lib/prisma'

export const AUTO_CLOSED_REASON = 'AUTO_CLOSED_END_OF_DAY'

/**
 * Last log that affects whether a shift is open: valid logs plus the cron's
 * end-of-day auto close (which is flagged invalid so it never counts as worked time).
 */
export function lastShiftLog(userId: string) {
  return prisma.clockLog.findFirst({
    where: { userId, OR: [{ isValid: true }, { flagReason: AUTO_CLOSED_REASON }] },
    orderBy: { timestamp: 'desc' },
  })
}

export const BYPASS_IP = 'BYPASS'

/** Validates the admin-entered shop IP list: 'BYPASS' or comma-separated IPv4/IPv6 addresses. */
export function isValidAllowedIpList(value: string): boolean {
  const trimmed = value.trim()
  if (trimmed === BYPASS_IP) return true
  const ips = trimmed.split(',').map(ip => ip.trim())
  return ips.length > 0 && ips.every(ip => isIP(ip) !== 0)
}

export function isIpAllowed(allowedIp: string, requestIp: string): boolean {
  if (process.env.NODE_ENV === 'development') return true
  if (allowedIp.trim() === BYPASS_IP) return true
  return allowedIp.split(',').map(ip => ip.trim()).includes(requestIp)
}

/**
 * Records a clock in/out for the signed-in employee. Serialized per user with a
 * transaction-scoped advisory lock so concurrent requests can't double clock in.
 */
export async function recordClock(
  userId: string,
  shopId: string,
  type: 'IN' | 'OUT',
  requestIp: string
): Promise<{ status: number; body: Record<string, unknown> }> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`clock:${userId}`}))`

    const last = await tx.clockLog.findFirst({
      where: { userId, OR: [{ isValid: true }, { flagReason: AUTO_CLOSED_REASON }] },
      orderBy: { timestamp: 'desc' },
    })
    const isOpen = last?.type === 'IN'

    if (type === 'IN' && isOpen) {
      return { status: 400, body: { error: 'Already clocked in. Please clock out first.' } }
    }
    if (type === 'OUT' && !isOpen) {
      return { status: 400, body: { error: 'Not clocked in.' } }
    }

    const shop = await tx.shop.findUnique({ where: { id: shopId } })
    if (!shop) {
      return { status: 404, body: { error: 'Your assigned shop was not found. Please contact your admin.' } }
    }

    if (!isIpAllowed(shop.allowedIp, requestIp)) {
      // Record the failed attempt (without revealing the shop's IP to the employee)
      await tx.clockLog.create({
        data: { userId, shopId, type, ipAddress: requestIp, isValid: false, flagReason: 'IP_FAIL' },
      })
      return {
        status: 403,
        body: {
          success: false,
          message: `You are not connected to the shop WiFi. Clock ${type === 'IN' ? 'in' : 'out'} denied.`,
        },
      }
    }

    const log = await tx.clockLog.create({
      data: { userId, shopId, type, ipAddress: requestIp, isValid: true },
    })
    return { status: 200, body: { success: true, log } }
  })
}
