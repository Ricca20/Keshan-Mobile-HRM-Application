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

    // Get penalty settings
    const penaltyAmountSetting = await prisma.systemSetting.findUnique({ where: { key: 'PENALTY_AMOUNT' } })
    const penaltyThresholdSetting = await prisma.systemSetting.findUnique({ where: { key: 'PENALTY_THRESHOLD' } })
    
    const penaltyAmount = penaltyAmountSetting ? Number(penaltyAmountSetting.value) : 1000
    const penaltyThreshold = penaltyThresholdSetting ? Number(penaltyThresholdSetting.value) : 10

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
      
      if (existingFinal) continue

      // 1. Base Salary
      const baseSalary = user.salary || 0

      // 2. Count distinct working days clocked in
      const workingDays = new Set(
        user.clockLogs.map(log => 
          new Date(log.timestamp).toLocaleDateString('en-US', { timeZone: 'Asia/Colombo' })
        )
      ).size

      // 3. Unpaid Leaves — separate query to avoid nested filter issues
      const unpaidLeaves = await prisma.leaveRequest.findMany({
        where: {
          userId: user.id,
          status: 'APPROVED',
          startDate: { lte: endDate },
          endDate: { gte: startDate },
        },
        include: { leaveType: true }
      })

      let unpaidDays = 0
      for (const leave of unpaidLeaves) {
        if (!leave.leaveType.isPaid) {
          unpaidDays += leave.totalDays
        }
      }

      const unpaidDeduction = (baseSalary / 30) * unpaidDays

      // 4. Penalty Deduction (bulk threshold system)
      // e.g., threshold=10, amount=1000: 15 points → 1 bulk → Rs 1000, 25 points → 2 bulks → Rs 2000
      const penaltyBulks = Math.floor(user.penaltyPoints / penaltyThreshold)
      const penaltyDeduction = penaltyBulks * penaltyAmount

      // 5. Total Deductions
      const totalDeductions = unpaidDeduction + penaltyDeduction
      
      let deductionNote = ''
      if (unpaidDays > 0) deductionNote += `Unpaid Leave (${unpaidDays} days). `
      if (penaltyBulks > 0) deductionNote += `Penalty (${user.penaltyPoints} pts × ${penaltyThreshold}/bulk = ${penaltyBulks} × Rs.${penaltyAmount}).`

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
          deductionNote: deductionNote.trim() || null,
          netPay,
          status: 'DRAFT'
        }
      })
      generatedCount++
    }

    return NextResponse.json({ 
      success: true, 
      message: `Successfully generated ${generatedCount} paysheet(s).` 
    })
  } catch (error: any) {
    console.error('Generate Paysheets Error:', error?.message || error)
    return NextResponse.json({ error: error?.message || 'Failed to generate paysheets' }, { status: 500 })
  }
}
