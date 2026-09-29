import { z } from 'zod'
import { NextResponse } from 'next/server'

/**
 * Shared Zod schemas for API validation.
 * Any API route that accepts a body should validate it using these schemas
 * before processing, to prevent malicious payloads from reaching the database.
 */

export const paysheetUpdateSchema = z.object({
  bonuses: z.number().min(0, 'Bonuses cannot be negative').max(1_000_000),
  deductions: z.number().min(0, 'Deductions cannot be negative').max(1_000_000),
  bonusNote: z.string().max(500).optional().nullable(),
  deductionNote: z.string().max(500).optional().nullable(),
})

export const markPaidSchema = z.object({
  paymentReference: z.string().max(200).optional(),
})

export const disputeSchema = z.object({
  reason: z.string().min(5, 'Please provide a reason with at least 5 characters').max(1000),
})

export const generatePaysheetSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2100),
})

export const settingUpdateSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.string().min(1).max(1000),
})

export const leaveRequestSchema = z.object({
  leaveTypeId: z.string().min(1),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  reason: z.string().min(5).max(1000),
})

/**
 * Helper: validate a parsed request body against a Zod schema.
 * Returns the parsed data or a 400 NextResponse with error messages.
 */
export function validate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; response: NextResponse } {
  const result = schema.safeParse(data)
  if (!result.success) {
    const errors = result.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`)
    return {
      success: false,
      response: NextResponse.json({ error: 'Validation failed', details: errors }, { status: 400 }),
    }
  }
  return { success: true, data: result.data }
}
