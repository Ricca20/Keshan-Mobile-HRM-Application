import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const session = await auth()
  if (!session || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { month, year } = await req.json()
    if (!month || !year) {
      return NextResponse.json({ error: 'Month and year are required' }, { status: 400 })
    }

    // Get penalty setting
    const penaltySetting = await prisma.systemSetting.findUnique({ where: { key: 'PENALTY_AMOUNT' } })
    const penaltyPerPoint = penaltySetting ? Number(penaltySetting.value) : 500

    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0, 23, 59, 59, 999)

    const activeUsers = await prisma.user.findMany({
      where: { role: 'EMPLOYEE', isActive: true },
      include: {
        clockLogs: {
          where: {
            timestamp: { gte: startDate, lte: endDate },
            type: 'IN',
            isValid: true
          }
        },
        leaveRequests: {
          where: {
            status: 'APPROVED',
            startDate: { gte: startDate, lte: endDate },
            leaveType: { isPaid: false }
          },
          include: { leaveType: true }
        }
      }
    })

    // Delete existing DRAFT paysheets for this month to regenerate
    await prisma.paySheet.deleteMany({
      where: { month, year, status: 'DRAFT' }
    })

    let generatedCount = 0

    for (const user of activeUsers) {
      // Check if a finalized sheet already exists
      const existingFinal = await prisma.paySheet.findFirst({
        where: { userId: user.id, month, year, status: 'FINALIZED' }
      })
      
      if (existingFinal) continue // Skip if already finalized

      // 1. Base Salary
      const baseSalary = user.salary || 0

      // 2. Count distinct working days clocked in
      const workingDays = new Set(user.clockLogs.map(log => new Date(log.timestamp).toLocaleDateString())).size

      // 3. Unpaid Leaves
      let unpaidDays = 0
      user.leaveRequests.forEach(req => {
        unpaidDays += req.totalDays
      })

      const unpaidDeduction = (baseSalary / 30) * unpaidDays

      // 4. Penalty Deduction
      const penaltyDeduction = user.penaltyPoints * penaltyPerPoint

      // 5. Total Deductions
      const totalDeductions = unpaidDeduction + penaltyDeduction
      
      let deductionNote = ''
      if (unpaidDays > 0) deductionNote += `Unpaid Leave (${unpaidDays} days). `
      if (user.penaltyPoints > 0) deductionNote += `Penalty Points (${user.penaltyPoints}).`

      // 6. Net Pay
      let netPay = baseSalary - totalDeductions
      if (netPay < 0) netPay = 0

      await prisma.paySheet.create({
        data: {
          userId: user.id,
          month,
          year,
          baseSalary,
          paidDays: workingDays,
          unpaidDays,
          deductions: totalDeductions,
          deductionNote: deductionNote.trim(),
          netPay,
          status: 'DRAFT'
        }
      })
      generatedCount++
    }

    return NextResponse.json({ 
      success: true, 
      message: `Successfully generated ${generatedCount} paysheets.` 
    })
  } catch (error) {
    console.error('Generate Paysheets Error:', error)
    return NextResponse.json({ error: 'Failed to generate paysheets' }, { status: 500 })
  }
}
