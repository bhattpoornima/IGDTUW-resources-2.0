import { supabase } from '../../../../../../lib/supabase'
import SubjectsClient from './SubjectsClient'

type PageProps = {
  params: Promise<{ branchId: string; semesterId: string }>
}

export default async function SubjectsPage({ params }: PageProps) {
  const { branchId, semesterId } = await params
  const branchIdNum = Number(branchId)
  const semesterIdNum = Number(semesterId)

  const [{ data: branch }, { data: semester }, { data: subjects }] = await Promise.all([
    supabase.from('branch').select('*').eq('id', branchIdNum).single(),
    supabase.from('semesters').select('*').eq('id', semesterIdNum).single(),
    supabase.from('subjects').select('*').eq('semester_id', semesterIdNum),
  ])

  const subjectIds = (subjects ?? []).map((s: { id: number }) => s.id)

  const { data: materials } =
    subjectIds.length === 0
      ? { data: [] as unknown[] }
      : await supabase.from('materials').select('*').in('subject_id', subjectIds)

  return (
    <SubjectsClient
      branch={branch}
      semester={semester}
      subjects={subjects || []}
      materials={(materials as any[]) || []}
    />
  )
}

