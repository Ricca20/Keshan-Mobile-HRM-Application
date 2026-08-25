import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function GET() {
  try {
    const count = await prisma.user.count()
    const owner = await prisma.user.findUnique({ where: { email: 'owner@phoneshop.lk' } })
    let passMatch = false
    if (owner) {
      passMatch = await bcrypt.compare('changeme123', owner.password)
    }
    return NextResponse.json({ success: true, count, ownerFound: !!owner, passMatch })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message, stack: error.stack })
  }
}
