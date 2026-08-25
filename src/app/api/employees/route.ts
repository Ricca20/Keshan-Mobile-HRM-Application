import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import crypto from 'crypto'
import { sendNotificationEmail } from '@/lib/mail'

const employeeSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  shopId: z.string().min(1, 'Shop assignment is required'),
  salary: z.number().min(0, 'Salary must be positive'),
})

export async function GET() {
  const session = await auth()
  if (!session || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const employees = await prisma.user.findMany({
      where: { role: 'EMPLOYEE' },
      include: { shop: true },
      orderBy: { name: 'asc' },
    })
    
    // Omit passwords from response
    const safeEmployees = employees.map(({ password, ...rest }) => rest)
    return NextResponse.json(safeEmployees)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const validatedData = employeeSchema.parse(body)

    // Check if email exists
    const existing = await prisma.user.findUnique({
      where: { email: validatedData.email }
    })
    if (existing) {
      return NextResponse.json({ error: 'Email already exists' }, { status: 400 })
    }

    // Generate a secure random placeholder password
    const randomPassword = crypto.randomBytes(16).toString('hex') + 'A1'
    const hashedPassword = await bcrypt.hash(randomPassword, 12)

    const employee = await prisma.user.create({
      data: {
        name: validatedData.name,
        email: validatedData.email,
        password: hashedPassword,
        shopId: validatedData.shopId,
        salary: validatedData.salary,
        role: 'EMPLOYEE',
      },
      include: { shop: true }
    })

    // Generate setup token
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    await prisma.passwordResetToken.create({
      data: {
        email: validatedData.email,
        token,
        expiresAt
      }
    })

    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const setupUrl = `${baseUrl}/setup-password?token=${token}`

    await sendNotificationEmail({
      to: validatedData.email,
      subject: 'Welcome to PhoneShop HRM - Setup Your Account',
      html: `
        <div style="font-family: sans-serif; max-w: 600px; margin: 0 auto;">
          <h2>Welcome, ${validatedData.name}!</h2>
          <p>An account has been created for you on the PhoneShop HRM system.</p>
          <p>Please click the button below to set up your password and access your account.</p>
          <div style="margin: 30px 0;">
            <a href="${setupUrl}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Set Up Password</a>
          </div>
          <p style="color: #64748b; font-size: 14px;">This link will expire in 7 days.</p>
        </div>
      `
    })

    const { password, ...safeEmployee } = employee
    return NextResponse.json(safeEmployee)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to create employee' }, { status: 500 })
  }
}
