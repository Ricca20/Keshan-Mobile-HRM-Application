import { prisma, INTERACTIVE_TX } from '@/lib/prisma'
import { AUTO_CLOSED_REASON, isIpAllowed } from '@/lib/clock'
import { getSettings } from '@/lib/settings'
import { sendNotificationEmail, escapeHtml, emailButton } from '@/lib/mail'
import { getBaseUrl } from '@/lib/url'
import { colomboDateStr, dbDate } from '@/lib/time'
import type { Prisma } from '@/generated/prisma/client'

type Tx = Prisma.TransactionClient
type Result = { status: number; body: Record<string, unknown> }

type OverdueLunch = {
  userId: string
  name: string
  startedAt: Date
  dueAt: Date
  points: number
  penaltyPoints: number
}

const MINUTE = 60 * 1000
// Ending lunch this soon after starting it is almost always a double tap
const MIN_LUNCH_MS = MINUTE

function colomboClock(date: Date) {
  return date.toLocaleTimeString('en-US', { timeZone: 'Asia/Colombo', hour: '2-digit', minute: '2-digit' })
}

/** Today's (Colombo) lunch break for the employee, if any. */
export function todaysLunch(userId: string, client: Tx | typeof prisma = prisma) {
  return client.lunchBreak.findUnique({
    where: { userId_date: { userId, date: dbDate(colomboDateStr()) } },
  })
}

/** Lunch that has been started and not ended yet today. */
async function activeLunch(userId: string, client: Tx | typeof prisma = prisma) {
  const lunch = await todaysLunch(userId, client)
  return lunch && !lunch.endedAt ? lunch : null
}

/**
 * Marks the lunch overdue and adds the penalty points, exactly once per lunch
 * (claimed with a conditional update). Returns the employee's new point total,
 * or null if it was already penalized.
 */
async function claimPenalty(tx: Tx, lunchId: string, userId: string, points: number) {
  const claimed = await tx.lunchBreak.updateMany({
    where: { id: lunchId, isOverdue: false },
    data: { isOverdue: true },
  })
  if (claimed.count === 0) return null

  const user = await tx.user.update({
    where: { id: userId },
    data: { penaltyPoints: { increment: points } },
    select: { penaltyPoints: true },
  })
  return user.penaltyPoints
}

async function shopAllows(tx: Tx, shopId: string, ip: string) {
  const shop = await tx.shop.findUnique({ where: { id: shopId }, select: { allowedIp: true } })
  return !!shop && isIpAllowed(shop.allowedIp, ip)
}

/** "Lunch In": starts the employee's single lunch break for today. */
export async function startLunch(userId: string, shopId: string, ip: string): Promise<Result> {
  const settings = await getSettings()

  return prisma.$transaction(async (tx) => {
    // Same lock as clock in/out, so lunch and clock actions for one employee never interleave
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`clock:${userId}`}))`

    const last = await tx.clockLog.findFirst({
      where: { userId, OR: [{ isValid: true }, { flagReason: AUTO_CLOSED_REASON }] },
      orderBy: { timestamp: 'desc' },
    })
    if (last?.type !== 'IN') {
      return { status: 400, body: { error: 'You must be clocked in to start your lunch break.' } }
    }

    const existing = await todaysLunch(userId, tx)
    if (existing) {
      return {
        status: 400,
        body: { error: existing.endedAt ? 'You have already taken your lunch break today.' : 'You are already on your lunch break.' },
      }
    }

    if (!(await shopAllows(tx, shopId, ip))) {
      return { status: 403, body: { error: 'You must be connected to the shop WiFi to start your lunch break.' } }
    }

    const now = new Date()
    const lunch = await tx.lunchBreak.create({
      data: {
        userId,
        date: dbDate(colomboDateStr(now)),
        startedAt: now,
        dueAt: new Date(now.getTime() + settings.LUNCH_DURATION_MINS * MINUTE),
        startIp: ip,
      },
    })
    return { status: 200, body: { success: true, lunch } }
  }, INTERACTIVE_TX)
}

/** "Lunch Out": ends today's lunch break. Must be back on the shop network. */
export async function endLunch(userId: string, shopId: string, ip: string): Promise<Result> {
  const settings = await getSettings()

  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`clock:${userId}`}))`

    const lunch = await activeLunch(userId, tx)
    if (!lunch) return { error: { status: 400, body: { error: 'You are not on a lunch break.' } } }
    if (Date.now() - lunch.startedAt.getTime() < MIN_LUNCH_MS) {
      return { error: { status: 400, body: { error: 'Your lunch started less than a minute ago, so this was ignored. You are still on lunch.' } } }
    }

    if (!(await shopAllows(tx, shopId, ip))) {
      return { error: { status: 403, body: { error: 'You must be back on the shop WiFi to end your lunch break.' } } }
    }

    const now = new Date()
    const late = now > lunch.dueAt
    const penaltyPoints = late ? await claimPenalty(tx, lunch.id, userId, settings.LUNCH_PENALTY_POINTS) : null

    const ended = await tx.lunchBreak.update({
      where: { id: lunch.id },
      data: { endedAt: now, endIp: ip },
    })
    return { ended, late, penaltyPoints }
  }, INTERACTIVE_TX)

  if ('error' in result) return result.error as Result
  const { ended, late, penaltyPoints } = result

  if (late) {
    const endedAt = ended.endedAt ?? new Date()
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } })
    const name = user?.name ?? 'An employee'
    if (penaltyPoints !== null) {
      // Came back late before the sweep caught it: this is the first alert for this lunch
      await notifyOverdue([{
        userId, name, startedAt: ended.startedAt, dueAt: ended.dueAt,
        points: settings.LUNCH_PENALTY_POINTS, penaltyPoints,
      }])
    } else {
      // Already alerted while they were out; tell the admins when they actually came back
      await notifyAdmins(
        'Returned Late From Lunch',
        `${name} ended their lunch break at ${colomboClock(endedAt)}, ` +
        `${Math.ceil((endedAt.getTime() - ended.dueAt.getTime()) / MINUTE)} min after it was due.`
      )
    }
  }

  return { status: 200, body: { success: true, lunch: ended, late } }
}

/**
 * Penalizes every lunch break that passed its due time without "Lunch Out" and alerts
 * the admins. Safe to call often and concurrently; each lunch is penalized once.
 */
export async function expireLunches(userId?: string): Promise<number> {
  const overdue = await prisma.lunchBreak.findMany({
    where: { endedAt: null, isOverdue: false, dueAt: { lt: new Date() }, ...(userId ? { userId } : {}) },
    include: { user: { select: { name: true } } },
  })
  if (overdue.length === 0) return 0

  const { LUNCH_PENALTY_POINTS: points } = await getSettings()
  const penalized: OverdueLunch[] = []
  for (const lunch of overdue) {
    const penaltyPoints = await prisma.$transaction(tx => claimPenalty(tx, lunch.id, lunch.userId, points))
    if (penaltyPoints !== null) {
      penalized.push({
        userId: lunch.userId, name: lunch.user.name, startedAt: lunch.startedAt, dueAt: lunch.dueAt,
        points, penaltyPoints,
      })
    }
  }

  await notifyOverdue(penalized)
  return penalized.length
}

async function notifyAdmins(title: string, message: string) {
  const admins = await prisma.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true } })
  if (admins.length === 0) return
  await prisma.notification.createMany({
    data: admins.map(admin => ({ userId: admin.id, title, message, type: 'LUNCH_OVERDUE' })),
  })
}

async function notifyOverdue(items: OverdueLunch[]) {
  if (items.length === 0) return

  const describe = (l: OverdueLunch) =>
    `${l.name} did not end their lunch break by ${colomboClock(l.dueAt)} (started ${colomboClock(l.startedAt)}). ` +
    (l.points > 0 ? `${l.points} penalty point(s) added (now ${l.penaltyPoints} pts).` : 'No penalty points are configured.')

  const admins = await prisma.user.findMany({ where: { role: 'ADMIN', isActive: true } })

  await prisma.notification.createMany({
    data: [
      ...admins.flatMap(admin => items.map(l => ({
        userId: admin.id,
        title: 'Lunch Break Overdue',
        message: describe(l),
        type: 'LUNCH_OVERDUE',
      }))),
      ...items.map(l => ({
        userId: l.userId,
        title: 'Lunch Break Overdue',
        message: `Your lunch break ended at ${colomboClock(l.dueAt)} without Lunch Out.` +
          (l.points > 0 ? ` ${l.points} penalty point(s) have been added.` : ''),
        type: 'LUNCH_OVERDUE',
      })),
    ],
  })

  for (const admin of admins) {
    await sendNotificationEmail({
      to: admin.email,
      subject: 'Lunch break overdue',
      html: items.map(l => `<p>${escapeHtml(describe(l))}</p>`).join('') +
        emailButton(`${getBaseUrl()}/admin/attendance`, 'View attendance'),
    })
  }
}
