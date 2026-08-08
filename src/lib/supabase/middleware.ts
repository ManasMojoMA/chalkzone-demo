import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.
  //
  // Bounded so a slow or paused Supabase project cannot hang the request. Without
  // this the call blocks until Vercel kills the middleware and serves a 504, which
  // is a far worse outcome than treating the visitor as signed-out: a signed-out
  // visitor gets the login page, and one they are already authenticated the next
  // request (with Supabase awake) restores them.
  const AUTH_TIMEOUT_MS = 3500

  let user = null
  try {
    const result = await Promise.race([
      supabase.auth.getUser(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('supabase-auth-timeout')), AUTH_TIMEOUT_MS)
      ),
    ])
    user = result.data.user
  } catch (err) {
    // Log for observability, but never fail the request over it.
    console.warn('[middleware] auth check unavailable:', (err as Error).message)
  }

  // "Keep me logged in" OFF: login set a session-scoped marker (cz-eph) and a
  // persistent flag (cz-eph-flag). Flag present without the marker means the
  // browser was closed since that ephemeral login — end the session.
  const ephFlag = request.cookies.get('cz-eph-flag')?.value === '1'
  const ephLive = request.cookies.get('cz-eph')?.value === '1'
  if (user && ephFlag && !ephLive) {
    await supabase.auth.signOut()
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    const redirect = NextResponse.redirect(url)
    // carry over the cookie deletions signOut queued on supabaseResponse
    supabaseResponse.cookies.getAll().forEach((c) => redirect.cookies.set(c))
    redirect.cookies.set('cz-eph-flag', '', { maxAge: 0, path: '/' })
    return redirect
  }

  // Protect the dashboard route
  if (!user && request.nextUrl.pathname.startsWith('/dashboard')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Redirect to dashboard if logged in and trying to access login
  if (user && request.nextUrl.pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
