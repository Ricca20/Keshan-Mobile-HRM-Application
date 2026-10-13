import { payslipLines, type PaysheetAmounts } from '@/lib/payslip'
import { formatCurrency } from '@/lib/utils'

/**
 * Line-by-line explanation of a paysheet: salary, additions, deductions and the net pay
 * they add up to. `netPay` can be passed to preview unsaved admin adjustments.
 */
export function PayslipBreakdown({ paysheet, netPay }: { paysheet: PaysheetAmounts; netPay?: number }) {
  const lines = payslipLines(paysheet)
  const total = netPay ?? paysheet.netPay

  return (
    <div>
      <ul className="divide-y divide-slate-100">
        {lines.map(line => (
          <li key={line.key} className="flex items-start justify-between gap-4 py-3">
            <div className="min-w-0">
              <p className={`text-sm font-medium ${line.key === 'base' ? 'text-slate-900' : line.sign > 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                {line.label}
              </p>
              {line.detail && <p className="text-xs text-slate-500 mt-0.5 break-words">{line.detail}</p>}
            </div>
            <span className={`text-sm font-semibold tabular-nums whitespace-nowrap ${line.key === 'base' ? 'text-slate-900' : line.sign > 0 ? 'text-emerald-700' : 'text-red-700'}`}>
              {line.key === 'base' ? '' : line.sign > 0 ? '+ ' : '− '}
              {formatCurrency(line.amount)}
            </span>
          </li>
        ))}
      </ul>

      {lines.length === 1 && (
        <p className="text-xs text-slate-500 pb-3">No overtime, absences, late arrivals or penalties this month.</p>
      )}

      <div className="mt-2 flex items-center justify-between gap-4 rounded-xl bg-blue-50 border border-blue-100 px-4 py-3">
        <span className="font-bold text-blue-900">Net pay</span>
        <span className="font-black text-xl text-blue-700 tabular-nums">{formatCurrency(total)}</span>
      </div>
    </div>
  )
}
