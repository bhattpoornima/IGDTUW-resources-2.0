import { redirect } from 'next/navigation'
import AdminClient from './AdminClient'
import { createSupabaseServerClient } from '../../lib/supabase/server'

export default async function AdminPage() {
  const supabase = await createSupabaseServerClient()

  // Server-side auth check (middleware also protects, but keep this for clarity).
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/admin/login')

  return <AdminClient />
}

