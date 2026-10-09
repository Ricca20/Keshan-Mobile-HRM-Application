import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import crypto from 'crypto'
import { requireUser, readJson, prismaErrorCode } from '@/lib/api-auth'
import { emailSchema, validate } from '@/lib/validation'
import { sendNotificationEmail, escapeHtml } from '@/lib/mail'
import { issuePasswordToken, SETUP_TOKEN_TTL_MS } from '@/lib/tokens'
import { createBalancesForEmployee } from '@/lib/leave'
import { getBaseUrl } from '@/lib/url'

const employeeSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  email: emailSchema,
  shopId: z.string().min(1, 'Shop assignment is required').max(100),
  salary: z.number().min(0, 'Salary must be positive').max(10_000_000),
})

export async function GET() {
  const guard = await requireUser('ADMIN')
  if (guard.response) return guard.response

  try {
    const employees = await prisma.user.findMany({
      where: { role: 'EMPLOYEE' },
      omit: { password: true, failedLoginAttempts: true, lockedUntil: true, passwordChangedAt: true },
      include: { shop: true },
      orderBy: { name: 'asc' },
    })
    return NextResponse.json(employees)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const guard = await requireUser('ADMIN')
  if (guard.response) return guard.response

  const validation = validate(employeeSchema, await readJson(req))
  if (!validation.success) return validation.response
  const data = validation.data

  try {
    const existing = await prisma.user.findFirst({
      where: { email: { equals: data.email, mode: 'insensitive' } }
    })
    if (existing) {
      return NextResponse.json({ error: 'Email already exists' }, { status: 400 })
    }

    const shop = await prisma.shop.findUnique({ where: { id: data.shopId }, select: { id: true } })
    if (!shop) {
      return NextResponse.json({ error: 'Selected shop does not exist' }, { status: 400 })
    }

    // Unusable random password until the employee completes setup via the emailed link
    const hashedPassword = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12)

    const employee = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
        shopId: data.shopId,
        salary: data.salary,
        role: 'EMPLOYEE',
      },
      omit: { password: true },
      include: { shop: true }
    })

    await createBalancesForEmployee(employee.id)

    const token = await issuePasswordToken(employee.email, SETUP_TOKEN_TTL_MS)
    const setupUrl = `${getBaseUrl()}/setup-password?token=${token}`

    await sendNotificationEmail({
      to: employee.email,
      subject: 'Welcome to PhoneShop HRM - Setup Your Account',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Welcome, ${escapeHtml(employee.name)}!</h2>
          <p>An account has been created for you on the PhoneShop HRM system.</p>
          <p>Please click the button below to set up your password and access your account.</p>
          <div style="margin: 30px 0;">
            <a href="${setupUrl}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Set Up Password</a>
          </div>
          <p style="color: #64748b; font-size: 14px;">This link will expire in 7 days.</p>
        </div>
      `
    })

    return NextResponse.json(employee)
  } catch (error) {
    if (prismaErrorCode(error) === 'P2002') {
      return NextResponse.json({ error: 'Email already exists' }, { status: 400 })
    }
    console.error('Create employee error:', error)
    return NextResponse.json({ error: 'Failed to create employee' }, { status: 500 })
  }
}
