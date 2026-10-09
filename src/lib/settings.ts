import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { isTimeStr } from '@/lib/time'

/**
 * Every system setting the app reads. The admin settings page writes exactly these
 * keys, and attendance/payroll read them through `getSettings()`.
 */
export const DEFAULT_SETTINGS = {
  PENALTY_THRESHOLD: 10,
  PENALTY_AMOUNT: 1000,
  SHIFT_START_TIME: '09:00',
  SHIFT_END_TIME: '18:00',
  LATE_GRACE_PERIOD_MINS: 15,
  LATE_PENALTY_AMOUNT: 500,
  MAX_LATE_MINS_FOR_HALF_DAY: 60,
  MIN_HOURS_FOR_FULL_DAY: 4,
  OT_RATE_PER_HOUR: 1000,
  WEEKLY_OFF_DAYS: '0,6', // 0 = Sunday … 6 = Saturday; empty = no weekly off days
}

export type Settings = typeof DEFAULT_SETTINGS

const amount = z.coerce.number().finite().min(0).max(10_000_000)
const minutes = z.coerce.number().int().min(0).max(24 * 60)
const time = z.string().refine(isTimeStr, 'Must be HH:mm')

export const settingsSchema = z
  .object({
    PENALTY_THRESHOLD: z.coerce.number().int().min(1).max(1000),
    PENALTY_AMOUNT: amount,
    SHIFT_START_TIME: time,
    SHIFT_END_TIME: time,
    LATE_GRACE_PERIOD_MINS: minutes,
    LATE_PENALTY_AMOUNT: amount,
    MAX_LATE_MINS_FOR_HALF_DAY: minutes,
    MIN_HOURS_FOR_FULL_DAY: z.coerce.number().min(0).max(24),
    OT_RATE_PER_HOUR: amount,
    WEEKLY_OFF_DAYS: z.string().regex(/^([0-6](,[0-6])*)?$/, 'Comma-separated day numbers 0-6'),
  })
  .partial()
  .strict()

export async function getSettings(): Promise<Settings> {
  const rows = await prisma.systemSetting.findMany({
    where: { key: { in: Object.keys(DEFAULT_SETTINGS) } },
  })

  const settings: Settings = { ...DEFAULT_SETTINGS }
  for (const row of rows) {
    const parsed = settingsSchema.safeParse({ [row.key]: row.value })
    if (parsed.success) Object.assign(settings, parsed.data)
    else console.warn(`Ignoring invalid setting ${row.key}=${row.value}`)
  }
  return settings
}

export function weeklyOffDays(settings: Settings): number[] {
  return settings.WEEKLY_OFF_DAYS.split(',').filter(Boolean).map(Number)
}
