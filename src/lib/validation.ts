import { z } from 'zod'
import { NextResponse } from 'next/server'
import { isDateStr } from '@/lib/time'
import { isValidAllowedIpList } from '@/lib/clock'

/**
 * Shared Zod schemas for API validation.
 * Any API route that accepts a body should validate it using these schemas
 * before processing, to prevent malicious payloads from reaching the database.
 */

/** One password policy for every place a password is set. */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')

export const emailSchema = z.string().trim().toLowerCase().email('Invalid email address').max(254)

export const dateStrSchema = z.string().refine(isDateStr, 'Must be a date in YYYY-MM-DD format')

export const paysheetUpdateSchema = z.object({
  bonuses: z.number().min(0, 'Bonuses cannot be negative').max(1_000_000).optional(),
  deductions: z.number().min(0, 'Deductions cannot be negative').max(1_000_000).optional(),
  bonusNote: z.string().max(500).optional().nullable(),
  deductionNote: z.string().max(500).optional().nullable(),
})

export const markPaidSchema = z.object({
  paymentReference: z.string().trim().max(200).optional(),
})

export const disputeSchema = z.object({
  reason: z.string().trim().min(5, 'Please provide a reason with at least 5 characters').max(1000),
})

export const monthYearSchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2020).max(2100),
})

/**
 * Helper: validate a parsed request body against a Zod schema.
 * Returns the parsed data or a 400 NextResponse with error messages.
 */
export function validate<T>(
  schema: z.ZodType<T>,
  data: unknown
): { success: true; data: T } | { success: false; response: NextResponse } {
  const result = schema.safeParse(data)
  if (!result.success) {
    const errors = result.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`)
    return {
      success: false,
      response: NextResponse.json({ error: result.error.issues[0].message, details: errors }, { status: 400 }),
    }
  }
  return { success: true, data: result.data }
}

export const leaveTypeSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  daysAllowed: z.number().int('Days must be a whole number').min(0, 'Days must be at least 0').max(366),
  isPaid: z.boolean(),
})

export const leaveTypeUpdateSchema = leaveTypeSchema.extend({ isActive: z.boolean() })

export const shopSchema = z.object({
  name: z.string().trim().min(1, 'Shop name is required').max(100),
  address: z.string().trim().min(1, 'Address is required').max(300),
  allowedIp: z
    .string()
    .trim()
    .max(500)
    .refine(isValidAllowedIpList, 'Enter BYPASS or one or more valid IP addresses separated by commas'),
})
