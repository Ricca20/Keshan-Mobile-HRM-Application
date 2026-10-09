import ExcelJS from 'exceljs'

type ExportablePaysheet = {
  user: {
    name: string
    shop: {
      name: string
    } | null
  }
  month: number
  year: number
  baseSalary: number
  paidDays: number
  unpaidDays: number
  deductions: number
  bonuses: number
  otPay: number
  netPay: number
  status: string
}

/** Prevents spreadsheet formula injection from user-controlled text. */
function safeText(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
}

export async function generatePaysheetExcel(paysheets: ExportablePaysheet[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Paysheet')

  ws.columns = [
    { header: 'Employee', key: 'employee', width: 25 },
    { header: 'Shop', key: 'shop', width: 25 },
    { header: 'Month', key: 'month', width: 10 },
    { header: 'Base Salary', key: 'baseSalary', width: 15, style: { numFmt: '#,##0.00' } },
    { header: 'Paid Days', key: 'paidDays', width: 10 },
    { header: 'Unpaid Days', key: 'unpaidDays', width: 12 },
    { header: 'OT Pay', key: 'otPay', width: 15, style: { numFmt: '#,##0.00' } },
    { header: 'Deductions', key: 'deductions', width: 15, style: { numFmt: '#,##0.00' } },
    { header: 'Bonuses', key: 'bonuses', width: 15, style: { numFmt: '#,##0.00' } },
    { header: 'Net Pay', key: 'netPay', width: 15, style: { numFmt: '#,##0.00' } },
    { header: 'Status', key: 'status', width: 16 },
  ]
  ws.getRow(1).font = { bold: true }

  for (const p of paysheets) {
    ws.addRow({
      employee: safeText(p.user.name),
      shop: safeText(p.user.shop?.name || 'Unassigned'),
      month: `${p.month}/${p.year}`,
      baseSalary: p.baseSalary,
      paidDays: p.paidDays,
      unpaidDays: p.unpaidDays,
      otPay: p.otPay,
      deductions: p.deductions,
      bonuses: p.bonuses,
      netPay: p.netPay,
      status: p.status,
    })
  }

  return Buffer.from(await wb.xlsx.writeBuffer())
}
