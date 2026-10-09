import { PrismaClient } from '../src/generated/prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'

const connectionString = process.env.DATABASE_URL
const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

/**
 * DEVELOPMENT ONLY. Wipes every table and inserts demo data.
 *
 * Required environment:
 *   SEED_CONFIRM=wipe-all-data      explicit confirmation (the seed deletes everything)
 *   SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD
 * Optional:
 *   SEED_EMPLOYEE_PASSWORD          defaults to a random password printed at the end
 */
function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} must be set to run the seed`)
  return value
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed: NODE_ENV is production')
  }
  if (process.env.SEED_CONFIRM !== 'wipe-all-data') {
    throw new Error('Refusing to seed: this deletes ALL data. Set SEED_CONFIRM=wipe-all-data to proceed.')
  }
  const adminEmail = requireEnv('SEED_ADMIN_EMAIL').toLowerCase()
  const adminPlainPassword = requireEnv('SEED_ADMIN_PASSWORD')
  const employeePlainPassword =
    process.env.SEED_EMPLOYEE_PASSWORD || `Emp-${randomBytes(9).toString('base64url')}1`

  console.log('🌱 Starting comprehensive database seed...')

  // 1. Wipe existing data to prevent unique constraint errors
  console.log('🧹 Wiping existing data...')
  await prisma.paySheet.deleteMany()
  await prisma.leaveRequest.deleteMany()
  await prisma.leaveBalance.deleteMany()
  await prisma.clockLog.deleteMany()
  await prisma.passwordResetToken.deleteMany()
  await prisma.dailyAttendance.deleteMany()
  await prisma.workVerification.deleteMany()
  await prisma.notification.deleteMany()
  await prisma.user.deleteMany()
  await prisma.leaveType.deleteMany()
  await prisma.shop.deleteMany()

  // 2. Create 5 Shops
  console.log('🏬 Creating 5 Shops...')
  const shopsData = [
    { name: 'Liberty Plaza Branch', address: 'Liberty Plaza, Colombo 03', allowedIp: '192.168.1.1' },
    { name: 'Majestic City Branch', address: 'Majestic City, Colombo 04', allowedIp: '192.168.1.2' },
    { name: 'One Galle Face', address: 'OGF Mall, Colombo 01', allowedIp: '192.168.1.3' },
    { name: 'Kandy City Centre', address: 'KCC, Kandy', allowedIp: '192.168.1.4' },
    { name: 'Galle Fort Branch', address: 'Pedlar St, Galle', allowedIp: '192.168.1.5' },
  ]
  const shops = await Promise.all(shopsData.map(s => prisma.shop.create({ data: s })))

  // 3. Create 5 Leave Types
  console.log('🌴 Creating 5 Leave Types...')
  const leaveTypesData = [
    { name: 'Annual Leave', daysAllowed: 14, isPaid: true },
    { name: 'Sick Leave', daysAllowed: 7, isPaid: true },
    { name: 'Casual Leave', daysAllowed: 3, isPaid: true },
    { name: 'Maternity Leave', daysAllowed: 84, isPaid: true },
    { name: 'No-Pay Leave', daysAllowed: 30, isPaid: false },
  ]
  const leaveTypes = await Promise.all(leaveTypesData.map(lt => prisma.leaveType.create({ data: lt })))

  // 4. Create 5 Users (1 Admin, 4 Employees)
  console.log('👥 Creating 5 Users...')
  const adminPassword = await bcrypt.hash(adminPlainPassword, 12)
  const empPassword = await bcrypt.hash(employeePlainPassword, 12)

  const admin = await prisma.user.create({
    data: {
      name: 'Shop Owner', email: adminEmail, password: adminPassword,
      role: 'ADMIN', salary: 0, shopId: shops[0].id,
    }
  })

  const employeesData = [
    { name: 'John Doe', email: 'john@phoneshop.lk', salary: 65000, shopId: shops[0].id },
    { name: 'Jane Smith', email: 'jane@phoneshop.lk', salary: 55000, shopId: shops[1].id },
    { name: 'Kamal Perera', email: 'kamal@phoneshop.lk', salary: 70000, shopId: shops[2].id },
    { name: 'Nimali Silva', email: 'nimali@phoneshop.lk', salary: 45000, shopId: shops[3].id },
  ]

  const employees = await Promise.all(employeesData.map(emp => prisma.user.create({
    data: { ...emp, password: empPassword, role: 'EMPLOYEE' }
  })))
  const allUsers = [admin, ...employees]

  // 5. Create Leave Balances (5 balances for each of the 5 users = 25 rows)
  console.log('📊 Creating Leave Balances...')
  const currentYear = new Date().getFullYear()
  for (const user of allUsers) {
    for (const lt of leaveTypes) {
      await prisma.leaveBalance.create({
        data: {
          userId: user.id, leaveTypeId: lt.id, year: currentYear,
          totalDays: lt.daysAllowed, usedDays: Math.floor(Math.random() * 3), // Random used days
        }
      })
    }
  }

  // Generate date helpers
  const today = new Date()
  const days = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() - i - 1) // Past 5 days
    return d
  })

  // 6. Create ClockLogs (logs for 4 employees)
  console.log('📅 Creating Clock Logs...')
  for (const emp of employees) {
    for (const date of days) {

      // Create Clock IN
      const timeIn = new Date(date)
      timeIn.setHours(8, 55, 0, 0) // 8:55 AM
      await prisma.clockLog.create({
        data: {
          userId: emp.id, shopId: emp.shopId!, type: 'IN',
          timestamp: timeIn, ipAddress: '192.168.1.1', isValid: true,
        }
      })

      // Create Clock OUT
      const timeOut = new Date(date)
      timeOut.setHours(18, 5, 0, 0) // 6:05 PM
      await prisma.clockLog.create({
        data: {
          userId: emp.id, shopId: emp.shopId!, type: 'OUT',
          timestamp: timeOut, ipAddress: '192.168.1.1', isValid: true,
        }
      })
    }
  }

  // 8. Create Leave Requests (5 requests total)
  console.log('🏖️ Creating Leave Requests...')
  const futureDate = new Date(today)
  futureDate.setDate(futureDate.getDate() + 10)

  const leaveRequestsData = [
    { userId: employees[0].id, leaveTypeId: leaveTypes[0].id, startDate: futureDate, endDate: futureDate, totalDays: 1, reason: 'Family event', status: 'PENDING' },
    { userId: employees[1].id, leaveTypeId: leaveTypes[1].id, startDate: futureDate, endDate: futureDate, totalDays: 1, reason: 'Fever', status: 'APPROVED' },
    { userId: employees[2].id, leaveTypeId: leaveTypes[2].id, startDate: futureDate, endDate: futureDate, totalDays: 1, reason: 'Personal errand', status: 'REJECTED' },
    { userId: employees[3].id, leaveTypeId: leaveTypes[0].id, startDate: futureDate, endDate: futureDate, totalDays: 1, reason: 'Vacation', status: 'PENDING' },
    { userId: employees[0].id, leaveTypeId: leaveTypes[1].id, startDate: today, endDate: today, totalDays: 1, reason: 'Doctor appointment', status: 'APPROVED' },
  ] as any[]

  for (const lr of leaveRequestsData) {
    await prisma.leaveRequest.create({ data: lr })
  }

  // 9. Create PaySheets (1 for each of the 4 employees + 1 for last month = 5 total)
  console.log('💰 Creating PaySheets...')
  const currentMonth = today.getMonth() + 1
  for (const emp of employees) {
    await prisma.paySheet.create({
      data: {
        userId: emp.id, month: currentMonth, year: currentYear,
        baseSalary: emp.salary, paidDays: 20, unpaidDays: 0,
        deductions: 0, bonuses: 5000, netPay: emp.salary + 5000,
        status: 'FINALIZED'
      }
    })
  }
  // Extra paysheet for Employee 1 for last month
  const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1
  const lastMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear
  await prisma.paySheet.create({
    data: {
      userId: employees[0].id, month: lastMonth, year: lastMonthYear,
      baseSalary: employees[0].salary, paidDays: 22, unpaidDays: 1,
      deductions: 2000, bonuses: 0, netPay: employees[0].salary - 2000,
      status: 'FINALIZED'
    }
  })

  // 10. Create Notifications (5 rows)
  console.log('🔔 Creating Notifications...')
  const notificationsData = [
    { userId: employees[0].id, title: 'Leave Approved', message: 'Your leave request for Family event was approved.', type: 'LEAVE_APPROVED', isRead: false },
    { userId: employees[1].id, title: 'Leave Rejected', message: 'Your leave request was rejected due to staff shortage.', type: 'LEAVE_REJECTED', isRead: true },
    { userId: admin.id, title: 'New Leave Request', message: 'Kamal Perera requested 1 day of leave.', type: 'LEAVE_REQUEST', isRead: false },
    { userId: employees[2].id, title: 'Paysheet Generated', message: 'Your paysheet for this month is ready to view.', type: 'PAYROLL', isRead: false },
    { userId: employees[3].id, title: 'System Maintenance', message: 'The HR system will be down for 2 hours tonight.', type: 'SYSTEM', isRead: true },
  ]
  for (const n of notificationsData) {
    await prisma.notification.create({ data: n })
  }

  // 11. Create Work Verifications (5 rows)
  console.log('✅ Creating Work Verifications...')
  const verificationsData = [
    { userId: employees[0].id, status: 'VERIFIED', sentAt: new Date(Date.now() - 3600000), expiresAt: new Date(Date.now() - 3420000), verifiedAt: new Date(Date.now() - 3500000) },
    { userId: employees[1].id, status: 'MISSED', sentAt: new Date(Date.now() - 7200000), expiresAt: new Date(Date.now() - 7020000), verifiedAt: null },
    { userId: employees[2].id, status: 'VERIFIED', sentAt: new Date(Date.now() - 10800000), expiresAt: new Date(Date.now() - 10620000), verifiedAt: new Date(Date.now() - 10700000) },
    { userId: employees[3].id, status: 'PENALIZED', sentAt: new Date(Date.now() - 86400000), expiresAt: new Date(Date.now() - 86220000), verifiedAt: null },
    { userId: employees[0].id, status: 'PENDING', sentAt: new Date(), expiresAt: new Date(Date.now() + 180000), verifiedAt: null },
  ] as any[]
  for (const v of verificationsData) {
    await prisma.workVerification.create({ data: v })
  }

  console.log('\n🎉 Comprehensive Seed Complete!')
  console.log('\n📋 Login credentials:')
  console.log(`   Admin: ${adminEmail} / (SEED_ADMIN_PASSWORD)`)
  console.log(`   Employees (john@, jane@, kamal@, nimali@phoneshop.lk): ${employeePlainPassword}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
