import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { requireUser, readJson, prismaErrorCode } from '@/lib/api-auth'
import { emailSchema, passwordSchema, validate } from '@/lib/validation'

const employeeUpdateSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100).optional(),
  email: emailSchema.optional(),
  password: passwordSchema.optional().or(z.literal('')),
  shopId: z.string().min(1, 'Shop assignment is required').max(100).optional(),
  salary: z.number().min(0, 'Salary must be positive').max(10_000_000).optional(),
  isActive: z.boolean().optional(),
})

/** This endpoint only manages EMPLOYEE accounts, never admins (including yourself). */
async function findEmployee(id: string) {
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true, email: true } })
  return user?.role === 'EMPLOYEE' ? user : null
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireUser('ADMIN')
  if (guard.response) return guard.response

  const validation = validate(employeeUpdateSchema, await readJson(req))
  if (!validation.success) return validation.response
  const { password, ...changes } = validation.data

  try {
    const { id } = await params
    const target = await findEmployee(id)
    if (!target) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    if (changes.email && changes.email !== target.email.toLowerCase()) {
      const taken = await prisma.user.findFirst({
        where: { email: { equals: changes.email, mode: 'insensitive' }, NOT: { id } }
      })
      if (taken) return NextResponse.json({ error: 'Email already exists' }, { status: 400 })
    }

    const employee = await prisma.user.update({
      where: { id },
      data: {
        ...changes,
        ...(password
          ? { password: await bcrypt.hash(password, 12), passwordChangedAt: new Date(), failedLoginAttempts: 0, lockedUntil: null }
          : {}),
      },
      omit: { password: true, failedLoginAttempts: true, lockedUntil: true, passwordChangedAt: true },
      include: { shop: true }
    })

    // Outstanding setup/reset links are tied to the old address
    if (changes.email && changes.email !== target.email) {
      await prisma.passwordResetToken.deleteMany({ where: { email: target.email } })
    }

    return NextResponse.json(employee)
  } catch (error) {
    const code = prismaErrorCode(error)
    if (code === 'P2002') return NextResponse.json({ error: 'Email already exists' }, { status: 400 })
    if (code === 'P2003') return NextResponse.json({ error: 'Selected shop does not exist' }, { status: 400 })
    return NextResponse.json({ error: 'Failed to update employee' }, { status: 500 })
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireUser('ADMIN')
  if (guard.response) return guard.response

  try {
    const { id } = await params
    const target = await findEmployee(id)
    if (!target) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    // Soft delete; active sessions are rejected on their next request
    await prisma.$transaction([
      prisma.user.update({ where: { id }, data: { isActive: false } }),
      prisma.passwordResetToken.deleteMany({ where: { email: target.email } }),
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to deactivate employee' }, { status: 500 })
  }
}
