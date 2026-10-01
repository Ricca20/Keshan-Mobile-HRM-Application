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
        dailyAttendances: {
          where: {
            date: { gte: startDate, lte: endDate }
          }
        }
      }
    })

    // Delete existing DRAFT paysheets for this month to regenerate
    await prisma.paySheet.deleteMany({
      where: { month, year, status: 'DRAFT' }
    })

    let generatedCount = 0

    // Get system settings for calculations
    const otRateSetting = await prisma.systemSetting.findUnique({ where: { key: 'OT_RATE' } })
    const otRateMultiplier = otRateSetting ? parseFloat(otRateSetting.value) : 1.5

    for (const user of activeUsers) {
      // Check if a finalized sheet already exists
      const existingFinal = await prisma.paySheet.findFirst({
        where: { userId: user.id, month, year, status: 'FINALIZED' }
      })
      
      if (existingFinal) continue

      // 1. Base Salary
      const baseSalary = user.salary || 0
      const dailyRate = baseSalary / 30
      const hourlyRate = dailyRate / 8 // Assuming 8 hour workday

      // 2. Process Daily Attendances
      let fullDays = 0
      let halfDaysTotal = 0
      let absentDays = 0
      let otHoursTotal = 0
      let lateMinutesTotal = 0

      for (const record of user.dailyAttendances) {
        if (record.status === 'PRESENT') {
          fullDays += 1
        } else if (record.status === 'HALF_DAY') {
          halfDaysTotal += 1
        } else if (record.status === 'ABSENT') {
          absentDays += 1
        }
        otHoursTotal += record.otHours || 0
        lateMinutesTotal += record.lateMinutes || 0
      }

      // 3. Unpaid Leaves 
      const unpaidLeaves = await prisma.leaveRequest.findMany({
        where: {
          userId: user.id,
          status: 'APPROVED',
          startDate: { lte: endDate },
          endDate: { gte: startDate },
        },
        include: { leaveType: true }
      })

      let unpaidDays = absentDays // Start with raw absences
      for (const leave of unpaidLeaves) {
        if (!leave.leaveType.isPaid) {
          unpaidDays += leave.totalDays
        }
      }

      // Calculations
      const paidDays = fullDays + (halfDaysTotal * 0.5)
      const halfDayDeduction = halfDaysTotal * (dailyRate * 0.5)
      const unpaidDeduction = unpaidDays * dailyRate
      
      const otPay = otHoursTotal * hourlyRate * otRateMultiplier

      // 4. Penalty Deduction
      const penaltyBulks = Math.floor(user.penaltyPoints / penaltyThreshold)
      const penaltyDeduction = penaltyBulks * penaltyAmount

      // 5. Total Deductions
      const totalDeductions = unpaidDeduction + halfDayDeduction + penaltyDeduction
      
      let deductionNote = ''
      if (unpaidDays > 0) deductionNote += `Unpaid/Absent (${unpaidDays} days). `
      if (halfDaysTotal > 0) deductionNote += `Half Days (${halfDaysTotal}). `
      if (penaltyBulks > 0) deductionNote += `Penalty (${user.penaltyPoints} pts = ${penaltyBulks}x Rs.${penaltyAmount}).`

      // 6. Net Pay
      let netPay = baseSalary + otPay - totalDeductions
      if (netPay < 0) netPay = 0

      await prisma.paySheet.create({
        data: {
          userId: user.id,
          month,
          year,
          baseSalary,
          paidDays: Math.ceil(paidDays),
          unpaidDays,
          deductions: totalDeductions,
          deductionNote: deductionNote.trim() || null,
          otHoursTotal,
          otPay,
          lateMinutesTotal,
          halfDaysTotal,
          halfDayDeduction,
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
