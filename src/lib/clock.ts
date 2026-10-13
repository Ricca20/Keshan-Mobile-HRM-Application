import { BlockList, isIP } from 'net'
import { prisma, INTERACTIVE_TX } from '@/lib/prisma'
import { colomboDateStr, dbDate } from '@/lib/time'

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

const BYPASS_IP = 'BYPASS'

type IpRule = { address: string; prefix?: number; family: 'ipv4' | 'ipv6' }

/** Parses one allowed-IP entry: a single address or a CIDR range like 2402:d000:1234:5678::/64. */
function parseIpRule(entry: string): IpRule | null {
  const [address, prefixStr, extra] = entry.trim().split('/')
  if (extra !== undefined) return null
  const version = isIP(address)
  if (version === 0) return null
  const family = version === 6 ? 'ipv6' : 'ipv4'
  if (prefixStr === undefined) return { address, family }
  if (!/^\d{1,3}$/.test(prefixStr)) return null
  const prefix = Number(prefixStr)
  if (prefix < 8 || prefix > (version === 6 ? 128 : 32)) return null
  return { address, prefix, family }
}

function splitIpList(value: string): string[] {
  return value.split(',').map(ip => ip.trim()).filter(Boolean)
}

/**
 * Validates the admin-entered shop IP list: 'BYPASS', or comma-separated IPv4/IPv6
 * addresses and CIDR ranges (prefix /8 or narrower).
 */
export function isValidAllowedIpList(value: string): boolean {
  const trimmed = value.trim()
  if (trimmed === BYPASS_IP) return true
  const entries = splitIpList(trimmed)
  return entries.length > 0 && entries.every(e => parseIpRule(e) !== null)
}

/**
 * Whether the request IP matches the shop's list. Ranges matter for IPv6: phones get
 * a new temporary IPv6 address regularly, but it stays inside the shop's /64 network.
 */
export function isIpAllowed(allowedIp: string, requestIp: string): boolean {
  if (process.env.NODE_ENV === 'development') return true
  if (allowedIp.trim() === BYPASS_IP) return true

  const version = isIP(requestIp)
  if (version === 0) return false

  const list = new BlockList()
  for (const entry of splitIpList(allowedIp)) {
    const rule = parseIpRule(entry)
    if (!rule) continue
    if (rule.prefix === undefined) list.addAddress(rule.address, rule.family)
    else list.addSubnet(rule.address, rule.prefix, rule.family)
  }
  return list.check(requestIp, version === 6 ? 'ipv6' : 'ipv4')
}

/** The /64 network of an IPv6 address (the usual size of one home/shop network). */
export function ipv6Network64(ip: string): string | null {
  if (isIP(ip) !== 6) return null
  const [head, tail = ''] = ip.split('::')
  const headParts = head ? head.split(':') : []
  const tailParts = tail ? tail.split(':') : []
  if (tailParts.some(p => p.includes('.')) || headParts.some(p => p.includes('.'))) return null
  const groups = ip.includes('::')
    ? [...headParts, ...Array(8 - headParts.length - tailParts.length).fill('0'), ...tailParts]
    : headParts
  if (groups.length !== 8) return null
  return `${groups.slice(0, 4).map(g => parseInt(g, 16).toString(16)).join(':')}::/64`
}

const DENIED_ALERT_WINDOW_MS = 30 * 60 * 1000

type ClockResult = { status: number; body: Record<string, unknown> }

/**
 * Records a clock in/out for the signed-in employee. Serialized per user with a
 * transaction-scoped advisory lock so concurrent requests can't double clock in.
 */
export async function recordClock(
  userId: string,
  shopId: string,
  type: 'IN' | 'OUT',
  requestIp: string
): Promise<ClockResult> {
  const result = await prisma.$transaction(async (tx): Promise<ClockResult & { alertShop?: string }> => {
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
    if (type === 'OUT') {
      const onLunch = await tx.lunchBreak.findFirst({
        where: { userId, date: dbDate(colomboDateStr()), endedAt: null },
      })
      if (onLunch) {
        return { status: 400, body: { error: 'You are on your lunch break. Tap Lunch Out first, then clock out.' } }
      }
    }

    const shop = await tx.shop.findUnique({ where: { id: shopId } })
    if (!shop) {
      return { status: 404, body: { error: 'Your assigned shop was not found. Please contact your admin.' } }
    }

    if (!isIpAllowed(shop.allowedIp, requestIp)) {
      // Alert admins on the first denial at this shop in a while (often the shop's IP changed)
      const recentDenials = await tx.clockLog.count({
        where: { shopId, flagReason: 'IP_FAIL', timestamp: { gte: new Date(Date.now() - DENIED_ALERT_WINDOW_MS) } },
      })
      // Record the failed attempt (without revealing the shop's IP to the employee)
      await tx.clockLog.create({
        data: { userId, shopId, type, ipAddress: requestIp, isValid: false, flagReason: 'IP_FAIL' },
      })
      return {
        status: 403,
        body: {
          success: false,
          code: 'IP_FAIL',
          ip: requestIp,
          message: `You are not connected to the shop WiFi, so clock ${type === 'IN' ? 'in' : 'out'} was denied.`,
        },
        alertShop: recentDenials === 0 ? shop.name : undefined,
      }
    }

    const log = await tx.clockLog.create({
      data: { userId, shopId, type, ipAddress: requestIp, isValid: true },
    })
    return { status: 200, body: { success: true, log } }
  }, INTERACTIVE_TX)

  if (result.alertShop) {
    await alertDeniedClock(userId, result.alertShop, requestIp).catch(err =>
      console.error('Failed to alert admins about denied clock-in:', err)
    )
  }
  return { status: result.status, body: result.body }
}

async function alertDeniedClock(userId: string, shopName: string, ip: string) {
  const [user, admins] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
    prisma.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true } }),
  ])
  if (admins.length === 0) return
  await prisma.notification.createMany({
    data: admins.map(admin => ({
      userId: admin.id,
      title: 'Clock-in Denied',
      message: `${user?.name ?? 'An employee'} was denied at ${shopName} from network ${ip}. ` +
        'If they are on the shop WiFi, the shop\'s internet IP has changed: open Shops and tap Allow.',
      type: 'CLOCK_DENIED',
    })),
  })
}
