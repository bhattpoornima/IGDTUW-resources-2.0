import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

/**
 * Protects all `/admin` routes.
 * Unauthenticated users are redirected to `/admin/login`.
 */
export async function middleware(req: NextRequest) {
  const res = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            res.cookies.set(name, value, options)
          }
        },
      },
    }
  )

  // IMPORTANT: `getUser()` validates the JWT with Supabase and is safe for auth checks.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isLoginRoute = req.nextUrl.pathname.startsWith('/admin/login')
  if (!user && !isLoginRoute) {
    const redirectUrl = req.nextUrl.clone()
    redirectUrl.pathname = '/admin/login'
    redirectUrl.searchParams.set('next', req.nextUrl.pathname)
    return NextResponse.redirect(redirectUrl)
  }

  if (user && isLoginRoute) {
    const redirectUrl = req.nextUrl.clone()
    redirectUrl.pathname = '/admin'
    return NextResponse.redirect(redirectUrl)
  }

  return res
}

export const config = {
  matcher: ['/admin/:path*'],
}

