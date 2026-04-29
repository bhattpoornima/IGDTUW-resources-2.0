import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Server-side Supabase client (App Router).
 * Used for auth checks in server components + route protection.
 */
export async function createSupabaseServerClient() {
  // Next.js 16 cookies() is async.
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          // Next.js server components can set cookies via the cookies() store.
          // This is required so refreshed sessions are persisted.
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options)
            }
          } catch {
            // If called from a server component where setting cookies is not allowed,
            // Supabase may still function for reads. Keep silent for stability.
          }
        },
      },
    }
  )
}

