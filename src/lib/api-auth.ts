import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

export type SessionUser = {
  id: string
  role: 'ADMIN' | 'EMPLOYEE'
  shopId: string | null
  name?: string | null
  email?: string | null
}

type GuardResult = { user: SessionUser; response?: never } | { user?: never; response: NextResponse }

/**
 * Authorizes an API request. Every route handler must call this itself; the proxy
 * is only a first line of defence.
 */
export async function requireUser(role?: SessionUser['role']): Promise<GuardResult> {
  const session = await auth()
  const user = session?.user as SessionUser | undefined

  if (!user?.id || !user.role) {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  if (role && user.role !== role) {
    return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { user }
}

/** Same check for Server Components: returns the user or null. */
export async function getSessionUser(role?: SessionUser['role']): Promise<SessionUser | null> {
  const session = await auth()
  const user = session?.user as SessionUser | undefined
  if (!user?.id || !user.role) return null
  if (role && user.role !== role) return null
  return user
}

/** Safely reads a JSON body; returns undefined for malformed input. */
export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json()
  } catch {
    return undefined
  }
}

export function prismaErrorCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code: unknown }).code)
    : undefined
}
