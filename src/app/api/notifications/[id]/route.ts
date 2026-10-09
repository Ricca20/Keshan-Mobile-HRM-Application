import { requireUser } from '@/lib/api-auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireUser()
  if (guard.response) return guard.response
  const userId = guard.user.id

  try {
    const { id } = await params

    const notification = await prisma.notification.update({
      where: { 
        id,
        userId, // ensure user owns it
      },
      data: { isRead: true },
    })

    return NextResponse.json(notification)
  } catch (error) {
    console.error('Error marking notification as read:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
