import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  /*
   * Only the routes whose behaviour actually depends on who you are.
   *
   * This previously matched every path, so the landing page ran an auth check
   * against Supabase before rendering. On the free tier Supabase pauses after about
   * a week idle, and that call then hangs until Vercel kills the middleware —
   * producing a 504 MIDDLEWARE_INVOCATION_TIMEOUT on the *homepage* of an app that
   * was otherwise perfectly healthy.
   *
   * Narrowing it means the public landing page renders no matter what state the
   * database is in.
   */
  matcher: ['/dashboard/:path*', '/login', '/reset-password'],
}
