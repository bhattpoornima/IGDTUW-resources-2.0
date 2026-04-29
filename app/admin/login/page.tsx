'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

export default function AdminLoginPage() {
  const router = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const onLogin = async () => {
    setLoading(true)
    setError('')
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (error) throw error 
      console.log('login success, redirecting...')
      // Note: keep redirect logic simple to avoid build-time suspense issues.
      router.replace('/admin')
    } catch (e: any) {
      setError(e?.message || 'Login failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-white text-gray-900 flex items-center justify-center p-6">
      <div className="w-full max-w-md border border-slate-200 bg-slate-50 rounded-xl shadow-sm p-6">
        <h1 className="text-xl font-extrabold">Admin Login</h1>
        <p className="text-sm text-gray-600 mt-1">Sign in to access the admin portal.</p>

        <div className="mt-6 flex flex-col gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="admin@igdtuw.ac.in"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          {!!error && <div className="text-sm text-red-600">{error}</div>}

          <button
            type="button"
            onClick={onLogin}
            disabled={loading || !email.trim() || !password}
            className="mt-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white rounded-md px-4 py-2 text-sm font-semibold"
          >
            {loading ? 'Signing in...' : 'Login'}
          </button>
        </div>
      </div>
    </main>
  )
}

