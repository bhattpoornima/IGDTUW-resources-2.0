import { supabase } from '../lib/supabase'
import HomeClient from './components/HomeClient'

export default async function Home() {
  // Fetch independent home data in parallel to minimize TTFB.
  const [{ data: branches }, { data: semesters }, { data: announcements }] = await Promise.all([
    supabase.from('branch').select('*'),
    supabase.from('semesters').select('*'),
    supabase.from('announcement').select('*').order('created_at', { ascending: false }).limit(5),
  ])

  return (
    <HomeClient 
      branches={branches || []} 
      semesters={semesters || []}
      announcements={announcements || []} 
    />
  )
}