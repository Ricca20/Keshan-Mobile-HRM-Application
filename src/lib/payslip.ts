/**
 * How a paysheet's net pay is made up, line by line. Pure and browser-safe, so the
 * admin and employee pages show exactly the same explanation.
 */

export type PaysheetAmounts = {
  baseSalary: number
  paidDays: number
  unpaidDays: number
  otHoursTotal: number
  otPay: number
  lateMinutesTotal: number
  lateDaysTotal: number
  lateDeduction: number
  halfDaysTotal: number
  halfDayDeduction: number
  penaltyPointsCharged: number
  penaltyDeduction: number
  deductions: number
  deductionNote: string | null
  bonuses: number
  bonusNote: string | null
  netPay: number
}

export type PayslipLine = {
  key: string
  label: string
  detail?: string
  amount: number
  sign: 1 | -1
}

/** Every month is paid as 30 days, whatever its length. */
export const DAYS_PER_MONTH = 30

export function round2(n: number) {
  return Math.round(n * 100) / 100
}

/** Net pay never goes below zero. */
export function calculateNetPay(baseSalary: number, otPay: number, deductions: number, bonuses: number) {
  return Math.max(0, round2(baseSalary + otPay + bonuses - deductions))
}

export function dailyRate(baseSalary: number) {
  return baseSalary / DAYS_PER_MONTH
}

/** Deductions worked out from attendance and penalty points (everything except manual extras). */
export function automaticDeductions(ps: Pick<PaysheetAmounts, 'baseSalary' | 'unpaidDays' | 'halfDayDeduction' | 'lateDeduction' | 'penaltyDeduction'>) {
  return round2(ps.unpaidDays * dailyRate(ps.baseSalary) + ps.halfDayDeduction + ps.lateDeduction + ps.penaltyDeduction)
}

/** The part of `deductions` an admin added by hand (negative if they reduced it). */
export function extraDeduction(ps: PaysheetAmounts) {
  const extra = round2(ps.deductions - automaticDeductions(ps))
  return Math.abs(extra) < 1 ? 0 : extra // ignore rounding pennies
}

const rs = (n: number) => `Rs ${n.toLocaleString('en-LK', { maximumFractionDigits: 2 })}`

export function payslipLines(ps: PaysheetAmounts): PayslipLine[] {
  const daily = dailyRate(ps.baseSalary)
  const lines: PayslipLine[] = [
    {
      key: 'base',
      label: 'Monthly salary',
      detail: `Daily rate ${rs(round2(daily))} (salary ÷ ${DAYS_PER_MONTH})`,
      amount: ps.baseSalary,
      sign: 1,
    },
  ]

  if (ps.otPay > 0) {
    lines.push({ key: 'ot', label: 'Overtime', detail: `${ps.otHoursTotal} hour(s) after shift end`, amount: ps.otPay, sign: 1 })
  }
  if (ps.unpaidDays > 0) {
    lines.push({
      key: 'unpaid',
      label: 'Absent / unpaid leave',
      detail: `${ps.unpaidDays} day(s) × ${rs(round2(daily))}`,
      amount: round2(ps.unpaidDays * daily),
      sign: -1,
    })
  }
  if (ps.halfDayDeduction > 0) {
    lines.push({
      key: 'half',
      label: 'Half days',
      detail: `${ps.halfDaysTotal} day(s) × half a day's pay (${rs(round2(daily / 2))})`,
      amount: ps.halfDayDeduction,
      sign: -1,
    })
  }
  if (ps.lateDeduction > 0) {
    lines.push({
      key: 'late',
      label: 'Late arrivals',
      detail: ps.lateDaysTotal > 0
        ? `${ps.lateDaysTotal} late day(s) × ${rs(round2(ps.lateDeduction / ps.lateDaysTotal))} (${ps.lateMinutesTotal} min in total)`
        : `${ps.lateMinutesTotal} min late in total`,
      amount: ps.lateDeduction,
      sign: -1,
    })
  }
  if (ps.penaltyDeduction > 0) {
    lines.push({
      key: 'penalty',
      label: 'Penalty points',
      detail: `${ps.penaltyPointsCharged} points (missed work checks / late from lunch)`,
      amount: ps.penaltyDeduction,
      sign: -1,
    })
  }

  const extra = extraDeduction(ps)
  if (extra !== 0) {
    lines.push({
      key: 'extra',
      label: extra > 0 ? 'Extra deduction' : 'Deduction reduced',
      detail: ps.deductionNote || undefined,
      amount: Math.abs(extra),
      sign: extra > 0 ? -1 : 1,
    })
  }
  if (ps.bonuses > 0) {
    lines.push({ key: 'bonus', label: 'Bonus / allowance', detail: ps.bonusNote || undefined, amount: ps.bonuses, sign: 1 })
  }

  return lines
}
