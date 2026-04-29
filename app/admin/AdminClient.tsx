'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

type Branch = { id: number; name: string }
type Semester = { id: number; number: number; branch_id: number }
type Subject = { id: number; name: string; semester_id: number }

type MaterialType = 'syllabus' | 'unit1' | 'unit2' | 'unit3' | 'unit4' | 'practical' | 'miscellaneous'
type ExamType = 'midterm' | 'endterm'

const TYPE_LABELS: Record<MaterialType, string> = {
  syllabus: 'Syllabus',
  unit1: 'Unit 1',
  unit2: 'Unit 2',
  unit3: 'Unit 3',
  unit4: 'Unit 4',
  practical: 'Practical',
  miscellaneous: 'Miscellaneous',
}

type AdminSection = 'materials' | 'pyqs' | 'contributions' | 'announcements' | 'requests' | 'feedback'

function formatDate(d: string | null | undefined) {
  if (!d) return '-'
  const dt = new Date(d)
  if (Number.isNaN(dt.getTime())) return d
  return dt.toLocaleString()
}

export default function AdminClient() {
  const router = useRouter()
  const [darkMode, setDarkMode] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [section, setSection] = useState<AdminSection>('materials')
  const [status, setStatus] = useState<string>('')

  const bg = darkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'
  const cardBg = darkMode ? 'bg-gray-800 border-gray-700' : 'bg-slate-100 border-slate-200'
  const inputBg = darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'

  const closeDrawer = () => setDrawerOpen(false)
  const navigate = (href: string) => {
    closeDrawer()
    router.push(href)
  }

  const logout = async () => {
    setStatus('')
    await supabase.auth.signOut()
    router.replace('/admin/login')
  }

  // Shared lookup data
  const [branches, setBranches] = useState<Branch[]>([])
  const [semesters, setSemesters] = useState<Semester[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const [{ data: b }, { data: sem }, { data: sub }] = await Promise.all([
          supabase.from('branch').select('*'),
          supabase.from('semesters').select('*'),
          supabase.from('subjects').select('*'),
        ])
        if (cancelled) return
        setBranches((b as any[]) || [])
        setSemesters((sem as any[]) || [])
        setSubjects((sub as any[]) || [])
      } catch {
        // Leave empty; sections handle their own errors.
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [])

  const semestersByBranch = useMemo(() => {
    const map = new Map<number, Semester[]>()
    for (const s of semesters) {
      const list = map.get(s.branch_id) ?? []
      list.push(s)
      map.set(s.branch_id, list)
    }
    for (const [k, list] of map) list.sort((a, b) => a.number - b.number), map.set(k, list)
    return map
  }, [semesters])

  const subjectsBySemester = useMemo(() => {
    const map = new Map<number, Subject[]>()
    for (const s of subjects) {
      const list = map.get(s.semester_id) ?? []
      list.push(s)
      map.set(s.semester_id, list)
    }
    for (const [k, list] of map) list.sort((a, b) => a.name.localeCompare(b.name)), map.set(k, list)
    return map
  }, [subjects])

  // ---------- Materials section ----------
  const [materials, setMaterials] = useState<any[]>([])
  const [materialsLoading, setMaterialsLoading] = useState(false)
  const [materialsMsg, setMaterialsMsg] = useState('')

  const [matBranchId, setMatBranchId] = useState<number | ''>('')
  const [matSemesterId, setMatSemesterId] = useState<number | ''>('')
  const [matSubjectId, setMatSubjectId] = useState<number | ''>('')
  const [matTitle, setMatTitle] = useState('')
  const [matType, setMatType] = useState<MaterialType | ''>('')
  const [matFile, setMatFile] = useState<File | null>(null)

  const loadMaterials = async () => {
    setMaterialsLoading(true)
    setMaterialsMsg('')
    try {
      // Schema note: materials.url is the file link.
      const { data, error } = await supabase
        .from('materials')
        .select('*, subjects(name, semester_id, semesters(number, branch_id, branch(name)))')
        .order('created_at', { ascending: false })
      if (error) throw error
      setMaterials((data as any[]) || [])
    } catch (e: any) {
      setMaterialsMsg(e?.message || 'Failed to load materials.')
    } finally {
      setMaterialsLoading(false)
    }
  }

  const uploadToBucket = async (bucket: string, path: string, file: File) => {
    const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file)
    if (uploadError) throw uploadError
    const { data } = supabase.storage.from(bucket).getPublicUrl(path)
    return data.publicUrl
  }

  const addMaterial = async () => {
    setMaterialsMsg('')
    if (!matBranchId || !matSemesterId || !matSubjectId || !matTitle.trim() || !matType || !matFile) {
      setMaterialsMsg('Please fill all fields for new material.')
      return
    }
    const ext = matFile.name.split('.').pop()?.toLowerCase()
    if (!ext || !['pdf', 'ppt', 'pptx'].includes(ext)) {
      setMaterialsMsg('Only .pdf, .ppt, .pptx files are allowed.')
      return
    }
    try {
      const path = `${Date.now()}-${matSubjectId}.${ext}`
      const publicUrl = await uploadToBucket('materials', path, matFile)
      const { error } = await supabase.from('materials').insert({
        title: matTitle.trim(),
        type: matType,
        url: publicUrl,
        subject_id: matSubjectId,
      })
      if (error) throw error
      setMatTitle('')
      setMatType('')
      setMatFile(null)
      setMaterialsMsg('Material uploaded.')
      await loadMaterials()
    } catch (e: any) {
      setMaterialsMsg(e?.message || 'Upload failed.')
    }
  }

  const updateMaterial = async (id: number, patch: { title?: string; type?: MaterialType }) => {
    setMaterialsMsg('')
    try {
      const { error } = await supabase.from('materials').update(patch).eq('id', id)
      if (error) throw error
      setMaterialsMsg('Material updated.')
      await loadMaterials()
    } catch (e: any) {
      setMaterialsMsg(e?.message || 'Update failed.')
    }
  }

  const deleteMaterial = async (id: number) => {
    setMaterialsMsg('')
    try {
      const { error } = await supabase.from('materials').delete().eq('id', id)
      if (error) throw error
      setMaterialsMsg('Material deleted.')
      await loadMaterials()
    } catch (e: any) {
      setMaterialsMsg(e?.message || 'Delete failed.')
    }
  }

  // ---------- PYQs section ----------
  const [pyqs, setPyqs] = useState<any[]>([])
  const [pyqsLoading, setPyqsLoading] = useState(false)
  const [pyqsMsg, setPyqsMsg] = useState('')

  const [pyqBranchId, setPyqBranchId] = useState<number | ''>('')
  const [pyqSemesterId, setPyqSemesterId] = useState<number | ''>('')
  const [pyqTitle, setPyqTitle] = useState('')
  const [pyqYear, setPyqYear] = useState<number | ''>('')
  const [pyqExamType, setPyqExamType] = useState<ExamType | ''>('')
  const [pyqFile, setPyqFile] = useState<File | null>(null)

  const loadPyqs = async () => {
    setPyqsLoading(true)
    setPyqsMsg('')
    try {
      // Schema note: pyqs.url is the file link (no subject_id).
      const { data, error } = await supabase
        .from('pyqs')
        .select('*, semesters(number, branch_id, branch(name))')
        .order('year', { ascending: false })
      if (error) throw error
      setPyqs((data as any[]) || [])
    } catch (e: any) {
      setPyqsMsg(e?.message || 'Failed to load PYQs.')
    } finally {
      setPyqsLoading(false)
    }
  }

  const addPyq = async () => {
    setPyqsMsg('')
    if (!pyqBranchId || !pyqSemesterId || !pyqTitle.trim() || !pyqYear || !pyqExamType || !pyqFile) {
      setPyqsMsg('Please fill all fields for new PYQ.')
      return
    }
    const ext = pyqFile.name.split('.').pop()?.toLowerCase()
    if (ext !== 'pdf') {
      setPyqsMsg('Only .pdf files are allowed for PYQs.')
      return
    }
    try {
      const path = `${Date.now()}-${pyqSemesterId}-${pyqExamType}-${pyqYear}.pdf`
      const publicUrl = await uploadToBucket('pyqs', path, pyqFile)
      const { error } = await supabase.from('pyqs').insert({
        title: pyqTitle.trim(),
        semester_id: pyqSemesterId,
        year: pyqYear,
        exam_type: pyqExamType,
        url: publicUrl,
      })
      if (error) throw error
      setPyqTitle('')
      setPyqYear('')
      setPyqExamType('')
      setPyqFile(null)
      setPyqsMsg('PYQ uploaded.')
      await loadPyqs()
    } catch (e: any) {
      setPyqsMsg(e?.message || 'Upload failed.')
    }
  }

  const updatePyq = async (id: number, patch: { title?: string; year?: number; exam_type?: ExamType }) => {
    setPyqsMsg('')
    try {
      const { error } = await supabase.from('pyqs').update(patch).eq('id', id)
      if (error) throw error
      setPyqsMsg('PYQ updated.')
      await loadPyqs()
    } catch (e: any) {
      setPyqsMsg(e?.message || 'Update failed.')
    }
  }

  const deletePyq = async (id: number) => {
    setPyqsMsg('')
    try {
      const { error } = await supabase.from('pyqs').delete().eq('id', id)
      if (error) throw error
      setPyqsMsg('PYQ deleted.')
      await loadPyqs()
    } catch (e: any) {
      setPyqsMsg(e?.message || 'Delete failed.')
    }
  }

  // ---------- Contributions section ----------
  const [contributions, setContributions] = useState<any[]>([])
  const [contribLoading, setContribLoading] = useState(false)
  const [contribMsg, setContribMsg] = useState('')

  const loadContributions = async () => {
    setContribLoading(true)
    setContribMsg('')
    try {
      // Schema note: contributions.url is the file link.
      const { data, error } = await supabase
        .from('contributions')
        .select('*, branch(name), semesters(number), subjects(name)')
        .order('created_at', { ascending: false })
      if (error) throw error
      setContributions((data as any[]) || [])
    } catch (e: any) {
      setContribMsg(e?.message || 'Failed to load contributions.')
    } finally {
      setContribLoading(false)
    }
  }

  const approveContribution = async (c: any) => {
    setContribMsg('')
    try {
      // Approve flow:
      // 1) Insert into materials
      // 2) Mark contribution approved
      const { error: insErr } = await supabase.from('materials').insert({
        title: c.title,
        type: c.type,
        url: c.url,
        subject_id: c.subject_id,
      })
      if (insErr) throw insErr

      const { error: updErr } = await supabase.from('contributions').update({ is_approved: true }).eq('id', c.id)
      if (updErr) throw updErr

      setContribMsg('Contribution approved.')
      await loadContributions()
    } catch (e: any) {
      setContribMsg(e?.message || 'Approve failed.')
    }
  }

  const rejectContribution = async (id: number) => {
    setContribMsg('')
    try {
      const { error } = await supabase.from('contributions').delete().eq('id', id)
      if (error) throw error
      setContribMsg('Contribution rejected (deleted).')
      await loadContributions()
    } catch (e: any) {
      setContribMsg(e?.message || 'Reject failed.')
    }
  }

  // ---------- Announcements section ----------
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [annLoading, setAnnLoading] = useState(false)
  const [annMsg, setAnnMsg] = useState('')
  const [annTitle, setAnnTitle] = useState('')
  const [annBody, setAnnBody] = useState('')

  const loadAnnouncements = async () => {
    setAnnLoading(true)
    setAnnMsg('')
    try {
      const { data, error } = await supabase.from('announcement').select('*').order('created_at', { ascending: false })
      if (error) throw error
      setAnnouncements((data as any[]) || [])
    } catch (e: any) {
      setAnnMsg(e?.message || 'Failed to load announcements.')
    } finally {
      setAnnLoading(false)
    }
  }

  const addAnnouncement = async () => {
    setAnnMsg('')
    if (!annTitle.trim() || !annBody.trim()) {
      setAnnMsg('Title and body are required.')
      return
    }
    try {
      const { error } = await supabase.from('announcement').insert({ title: annTitle.trim(), body: annBody.trim() })
      if (error) throw error
      setAnnTitle('')
      setAnnBody('')
      setAnnMsg('Announcement created.')
      await loadAnnouncements()
    } catch (e: any) {
      setAnnMsg(e?.message || 'Create failed.')
    }
  }

  const deleteAnnouncement = async (id: number) => {
    setAnnMsg('')
    try {
      const { error } = await supabase.from('announcement').delete().eq('id', id)
      if (error) throw error
      setAnnMsg('Announcement deleted.')
      await loadAnnouncements()
    } catch (e: any) {
      setAnnMsg(e?.message || 'Delete failed.')
    }
  }

  // ---------- Requests / Feedback sections ----------
  const [requests, setRequests] = useState<any[]>([])
  const [reqMsg, setReqMsg] = useState('')
  const [reqLoading, setReqLoading] = useState(false)

  const loadRequests = async () => {
    setReqLoading(true)
    setReqMsg('')
    try {
      const { data, error } = await supabase
        .from('requests')
        .select('*, branch(name), semesters(number)')
        .order('created_at', { ascending: false })
      if (error) throw error
      setRequests((data as any[]) || [])
    } catch (e: any) {
      setReqMsg(e?.message || 'Failed to load requests.')
    } finally {
      setReqLoading(false)
    }
  }

  const deleteRequest = async (id: number) => {
    setReqMsg('')
    try {
      const { error } = await supabase.from('requests').delete().eq('id', id)
      if (error) throw error
      setReqMsg('Request deleted.')
      await loadRequests()
    } catch (e: any) {
      setReqMsg(e?.message || 'Delete failed.')
    }
  }

  const [feedback, setFeedback] = useState<any[]>([])
  const [fbMsg, setFbMsg] = useState('')
  const [fbLoading, setFbLoading] = useState(false)

  const loadFeedback = async () => {
    setFbLoading(true)
    setFbMsg('')
    try {
      const { data, error } = await supabase.from('feedback').select('*').order('created_at', { ascending: false })
      if (error) throw error
      setFeedback((data as any[]) || [])
    } catch (e: any) {
      setFbMsg(e?.message || 'Failed to load feedback.')
    } finally {
      setFbLoading(false)
    }
  }

  const deleteFeedback = async (id: number) => {
    setFbMsg('')
    try {
      const { error } = await supabase.from('feedback').delete().eq('id', id)
      if (error) throw error
      setFbMsg('Feedback deleted.')
      await loadFeedback()
    } catch (e: any) {
      setFbMsg(e?.message || 'Delete failed.')
    }
  }

  // Load data when switching sections (keeps response time good).
  useEffect(() => {
    setStatus('')
    if (section === 'materials') loadMaterials()
    if (section === 'pyqs') loadPyqs()
    if (section === 'contributions') loadContributions()
    if (section === 'announcements') loadAnnouncements()
    if (section === 'requests') loadRequests()
    if (section === 'feedback') loadFeedback()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section])

  return (
    <main className={`min-h-screen ${bg} transition-colors duration-200`}>
      {/* Header */}
      <header className={`relative flex items-center justify-between px-8 py-7 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
        <button type="button" onClick={() => setDrawerOpen(true)} className="text-2xl leading-none select-none" aria-label="Open menu">
          ☰
        </button>

        <h1 className="absolute left-1/2 -translate-x-1/2 text-2xl font-extrabold tracking-tight text-center">
          IGDTUW RESOURCES
        </h1>

        <div className="flex items-center gap-4">
          <button type="button" onClick={() => setDarkMode((v) => !v)} className="flex items-center gap-2">
            <span className="text-sm font-medium">Dark Mode</span>
            <span
              aria-hidden="true"
              className={`relative inline-flex h-6 w-11 items-center rounded-full border transition-colors ${
                darkMode ? 'bg-purple-600 border-purple-600' : 'bg-gray-200 border-gray-300'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                  darkMode ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </span>
          </button>

          <button
            type="button"
            onClick={logout}
            className={`text-sm font-semibold px-3 py-2 rounded-md border ${
              darkMode ? 'border-gray-700 hover:bg-gray-800' : 'border-gray-200 hover:bg-gray-50'
            }`}
          >
            Logout
          </button>
        </div>
      </header>

      {/* Side drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={closeDrawer} />
          <aside
            className={`absolute left-0 top-0 h-full w-72 p-5 shadow-xl ${
              darkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'
            }`}
            role="dialog"
            aria-label="Navigation menu"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="font-bold text-lg">Menu</div>
              <button type="button" onClick={closeDrawer} className="text-xl" aria-label="Close menu">
                ✕
              </button>
            </div>

            <nav className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => navigate('/')}
                className={`text-left rounded-md px-3 py-2 border ${
                  darkMode ? 'border-gray-700 hover:bg-gray-800' : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                Home
              </button>
              <button
                type="button"
                onClick={() => navigate('/pyqs')}
                className={`text-left rounded-md px-3 py-2 border ${
                  darkMode ? 'border-gray-700 hover:bg-gray-800' : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                PYQs
              </button>
              <button
                type="button"
                onClick={() => navigate('/about')}
                className={`text-left rounded-md px-3 py-2 border ${
                  darkMode ? 'border-gray-700 hover:bg-gray-800' : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                About
              </button>
            </nav>
          </aside>
        </div>
      )}

      {/* Subtitle */}
      <div className={`px-8 py-4 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
        <div className="font-extrabold text-lg">Admin Portal</div>
        {!!status && <div className="text-sm text-purple-600 mt-1">{status}</div>}
      </div>

      {/* Layout */}
      <div className="px-8 pb-10 flex flex-col lg:flex-row gap-6">
        {/* Sidebar */}
        <aside className={`w-full lg:w-64 border rounded-lg p-3 ${cardBg}`}>
          {(
            [
              ['materials', 'Materials'],
              ['pyqs', 'PYQs'],
              ['contributions', 'Contributions'],
              ['announcements', 'Announcements'],
              ['requests', 'Requests'],
              ['feedback', 'Feedback'],
            ] as Array<[AdminSection, string]>
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSection(key)}
              className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                section === key ? 'bg-purple-600 text-white' : darkMode ? 'hover:bg-gray-700' : 'hover:bg-white'
              }`}
            >
              {label}
            </button>
          ))}
        </aside>

        {/* Main */}
        <section className="flex-1">
          {/* Materials */}
          {section === 'materials' && (
            <div className={`border rounded-lg p-5 ${cardBg}`}>
              <div className="font-bold mb-4">Materials</div>

              {/* Upload form */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Branch</label>
                  <select
                    className={`w-full border rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500 ${inputBg}`}
                    value={matBranchId}
                    onChange={(e) => {
                      const v = e.target.value ? Number(e.target.value) : ''
                      setMatBranchId(v)
                      setMatSemesterId('')
                      setMatSubjectId('')
                    }}
                  >
                    <option value="">Select branch</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Semester</label>
                  <select
                    className={`w-full border rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500 ${inputBg} ${
                      !matBranchId ? 'opacity-60 cursor-not-allowed' : ''
                    }`}
                    disabled={!matBranchId}
                    value={matSemesterId}
                    onChange={(e) => {
                      const v = e.target.value ? Number(e.target.value) : ''
                      setMatSemesterId(v)
                      setMatSubjectId('')
                    }}
                  >
                    <option value="">Select semester</option>
                    {(matBranchId ? semestersByBranch.get(Number(matBranchId)) : [])?.map((s) => (
                      <option key={s.id} value={s.id}>
                        Semester {s.number}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Subject</label>
                  <select
                    className={`w-full border rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500 ${inputBg} ${
                      !matSemesterId ? 'opacity-60 cursor-not-allowed' : ''
                    }`}
                    disabled={!matSemesterId}
                    value={matSubjectId}
                    onChange={(e) => setMatSubjectId(e.target.value ? Number(e.target.value) : '')}
                  >
                    <option value="">Select subject</option>
                    {(matSemesterId ? subjectsBySemester.get(Number(matSemesterId)) : [])?.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Type</label>
                  <select
                    className={`w-full border rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500 ${inputBg}`}
                    value={matType}
                    onChange={(e) => setMatType((e.target.value as MaterialType) || '')}
                  >
                    <option value="">Select type</option>
                    {(Object.keys(TYPE_LABELS) as MaterialType[]).map((t) => (
                      <option key={t} value={t}>
                        {TYPE_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1">Title</label>
                  <input
                    className={`w-full border rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500 ${inputBg}`}
                    value={matTitle}
                    onChange={(e) => setMatTitle(e.target.value)}
                    placeholder="e.g., Unit 1 Notes PDF"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1">File (.pdf/.ppt/.pptx)</label>
                  <input type="file" accept=".pdf,.ppt,.pptx" onChange={(e) => setMatFile(e.target.files?.[0] || null)} />
                </div>
              </div>

              <button
                type="button"
                onClick={addMaterial}
                className="mt-4 bg-purple-600 hover:bg-purple-700 text-white rounded-md px-4 py-2 text-sm font-semibold"
              >
                Upload Material
              </button>

              {!!materialsMsg && <div className="mt-3 text-sm text-purple-600">{materialsMsg}</div>}

              {/* Table */}
              <div className="mt-6 overflow-auto">
                {materialsLoading ? (
                  <div className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Loading...</div>
                ) : (
                  <table className="min-w-[900px] w-full text-sm">
                    <thead>
                      <tr className={darkMode ? 'text-gray-200' : 'text-gray-700'}>
                        <th className="text-left py-2 px-2">Title</th>
                        <th className="text-left py-2 px-2">Type</th>
                        <th className="text-left py-2 px-2">Subject</th>
                        <th className="text-left py-2 px-2">Semester</th>
                        <th className="text-left py-2 px-2">Branch</th>
                        <th className="text-left py-2 px-2">Created At</th>
                        <th className="text-left py-2 px-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {materials.map((m, idx) => {
                        const rowBg = idx % 2 === 0 ? (darkMode ? 'bg-gray-900/30' : 'bg-white/60') : 'transparent'
                        const subjectName = m.subjects?.name ?? '-'
                        const semNum = m.subjects?.semesters?.number ?? '-'
                        const branchName = m.subjects?.semesters?.branch?.name ?? '-'
                        return (
                          <tr key={m.id} className={rowBg}>
                            <td className="py-2 px-2">{m.title}</td>
                            <td className="py-2 px-2">{TYPE_LABELS[m.type as MaterialType] ?? m.type}</td>
                            <td className="py-2 px-2">{subjectName}</td>
                            <td className="py-2 px-2">{semNum}</td>
                            <td className="py-2 px-2">{branchName}</td>
                            <td className="py-2 px-2">{formatDate(m.created_at)}</td>
                            <td className="py-2 px-2 flex gap-2">
                              <button
                                type="button"
                                className="underline text-purple-600"
                                onClick={() => updateMaterial(m.id, { title: prompt('New title', m.title) || m.title, type: m.type })}
                              >
                                Edit title
                              </button>
                              <button type="button" className="underline text-purple-600" onClick={() => deleteMaterial(m.id)}>
                                Delete
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* PYQs */}
          {section === 'pyqs' && (
            <div className={`border rounded-lg p-5 ${cardBg}`}>
              <div className="font-bold mb-4">PYQs</div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Branch</label>
                  <select
                    className={`w-full border rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500 ${inputBg}`}
                    value={pyqBranchId}
                    onChange={(e) => {
                      const v = e.target.value ? Number(e.target.value) : ''
                      setPyqBranchId(v)
                      setPyqSemesterId('')
                    }}
                  >
                    <option value="">Select branch</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Semester</label>
                  <select
                    className={`w-full border rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500 ${inputBg} ${
                      !pyqBranchId ? 'opacity-60 cursor-not-allowed' : ''
                    }`}
                    disabled={!pyqBranchId}
                    value={pyqSemesterId}
                    onChange={(e) => setPyqSemesterId(e.target.value ? Number(e.target.value) : '')}
                  >
                    <option value="">Select semester</option>
                    {(pyqBranchId ? semestersByBranch.get(Number(pyqBranchId)) : [])?.map((s) => (
                      <option key={s.id} value={s.id}>
                        Semester {s.number}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1">Title</label>
                  <input
                    className={`w-full border rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500 ${inputBg}`}
                    value={pyqTitle}
                    onChange={(e) => setPyqTitle(e.target.value)}
                    placeholder="e.g., End Term 2024"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Year</label>
                  <input
                    className={`w-full border rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500 ${inputBg}`}
                    value={pyqYear}
                    onChange={(e) => setPyqYear(e.target.value ? Number(e.target.value) : '')}
                    placeholder="2025"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Exam Type</label>
                  <select
                    className={`w-full border rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500 ${inputBg}`}
                    value={pyqExamType}
                    onChange={(e) => setPyqExamType((e.target.value as ExamType) || '')}
                  >
                    <option value="">Select exam type</option>
                    <option value="midterm">Midterm</option>
                    <option value="endterm">End Term</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1">File (.pdf)</label>
                  <input type="file" accept=".pdf" onChange={(e) => setPyqFile(e.target.files?.[0] || null)} />
                </div>
              </div>

              <button
                type="button"
                onClick={addPyq}
                className="mt-4 bg-purple-600 hover:bg-purple-700 text-white rounded-md px-4 py-2 text-sm font-semibold"
              >
                Upload PYQ
              </button>

              {!!pyqsMsg && <div className="mt-3 text-sm text-purple-600">{pyqsMsg}</div>}

              <div className="mt-6 overflow-auto">
                {pyqsLoading ? (
                  <div className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Loading...</div>
                ) : (
                  <table className="min-w-[900px] w-full text-sm">
                    <thead>
                      <tr className={darkMode ? 'text-gray-200' : 'text-gray-700'}>
                        <th className="text-left py-2 px-2">Title</th>
                        <th className="text-left py-2 px-2">Year</th>
                        <th className="text-left py-2 px-2">Exam Type</th>
                        <th className="text-left py-2 px-2">Semester</th>
                        <th className="text-left py-2 px-2">Branch</th>
                        <th className="text-left py-2 px-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pyqs.map((p, idx) => {
                        const rowBg = idx % 2 === 0 ? (darkMode ? 'bg-gray-900/30' : 'bg-white/60') : 'transparent'
                        const semNum = p.semesters?.number ?? '-'
                        const branchName = p.semesters?.branch?.name ?? '-'
                        return (
                          <tr key={p.id} className={rowBg}>
                            <td className="py-2 px-2">{p.title}</td>
                            <td className="py-2 px-2">{p.year}</td>
                            <td className="py-2 px-2">{p.exam_type}</td>
                            <td className="py-2 px-2">{semNum}</td>
                            <td className="py-2 px-2">{branchName}</td>
                            <td className="py-2 px-2 flex gap-2">
                              <button
                                type="button"
                                className="underline text-purple-600"
                                onClick={() => updatePyq(p.id, { title: prompt('New title', p.title) || p.title })}
                              >
                                Edit title
                              </button>
                              <button type="button" className="underline text-purple-600" onClick={() => deletePyq(p.id)}>
                                Delete
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* Contributions */}
          {section === 'contributions' && (
            <div className={`border rounded-lg p-5 ${cardBg}`}>
              <div className="font-bold mb-4">Contributions</div>
              {!!contribMsg && <div className="text-sm text-purple-600 mb-3">{contribMsg}</div>}
              {contribLoading ? (
                <div className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Loading...</div>
              ) : (
                <div className="overflow-auto">
                  <table className="min-w-[1100px] w-full text-sm">
                    <thead>
                      <tr className={darkMode ? 'text-gray-200' : 'text-gray-700'}>
                        <th className="text-left py-2 px-2">Title</th>
                        <th className="text-left py-2 px-2">Type</th>
                        <th className="text-left py-2 px-2">Contributor</th>
                        <th className="text-left py-2 px-2">Branch</th>
                        <th className="text-left py-2 px-2">Semester</th>
                        <th className="text-left py-2 px-2">Subject</th>
                        <th className="text-left py-2 px-2">Note</th>
                        <th className="text-left py-2 px-2">Submitted</th>
                        <th className="text-left py-2 px-2">Status</th>
                        <th className="text-left py-2 px-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contributions.map((c, idx) => {
                        const rowBg = idx % 2 === 0 ? (darkMode ? 'bg-gray-900/30' : 'bg-white/60') : 'transparent'
                        return (
                          <tr key={c.id} className={rowBg}>
                            <td className="py-2 px-2">{c.title}</td>
                            <td className="py-2 px-2">{TYPE_LABELS[c.type as MaterialType] ?? c.type}</td>
                            <td className="py-2 px-2">{c.contributor_name ?? '-'}</td>
                            <td className="py-2 px-2">{c.branch?.name ?? '-'}</td>
                            <td className="py-2 px-2">{c.semesters?.number ?? '-'}</td>
                            <td className="py-2 px-2">{c.subjects?.name ?? '-'}</td>
                            <td className="py-2 px-2">{c.note ?? '-'}</td>
                            <td className="py-2 px-2">{formatDate(c.created_at)}</td>
                            <td className="py-2 px-2">{c.is_approved ? 'Approved' : 'Pending'}</td>
                            <td className="py-2 px-2 flex gap-2">
                              <button type="button" className="underline text-purple-600" onClick={() => window.open(c.url, '_blank')}>
                                View File
                              </button>
                              {!c.is_approved && (
                                <button type="button" className="underline text-purple-600" onClick={() => approveContribution(c)}>
                                  Approve
                                </button>
                              )}
                              <button type="button" className="underline text-purple-600" onClick={() => rejectContribution(c.id)}>
                                Reject
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Announcements */}
          {section === 'announcements' && (
            <div className={`border rounded-lg p-5 ${cardBg}`}>
              <div className="font-bold mb-4">Announcements</div>

              <div className="grid grid-cols-1 gap-3">
                <input
                  className={`w-full border rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500 ${inputBg}`}
                  value={annTitle}
                  onChange={(e) => setAnnTitle(e.target.value)}
                  placeholder="Title *"
                />
                <textarea
                  className={`w-full border rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500 ${inputBg} h-24 resize-none`}
                  value={annBody}
                  onChange={(e) => setAnnBody(e.target.value)}
                  placeholder="Body *"
                />
              </div>

              <button
                type="button"
                onClick={addAnnouncement}
                className="mt-3 bg-purple-600 hover:bg-purple-700 text-white rounded-md px-4 py-2 text-sm font-semibold"
              >
                Create announcement
              </button>

              {!!annMsg && <div className="mt-3 text-sm text-purple-600">{annMsg}</div>}

              <div className="mt-6 grid grid-cols-1 gap-3">
                {annLoading ? (
                  <div className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Loading...</div>
                ) : (
                  announcements.map((a) => (
                    <div
                      key={a.id}
                      className={`border rounded-lg p-4 ${darkMode ? 'border-gray-700 bg-gray-900/30' : 'border-gray-200 bg-white/60'}`}
                    >
                      <div className="font-semibold">{a.title}</div>
                      <div className={`text-sm mt-1 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>{a.body}</div>
                      <div className={`text-xs mt-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{formatDate(a.created_at)}</div>
                      <button type="button" onClick={() => deleteAnnouncement(a.id)} className="mt-3 underline text-purple-600 text-sm">
                        Delete
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Requests */}
          {section === 'requests' && (
            <div className={`border rounded-lg p-5 ${cardBg}`}>
              <div className="font-bold mb-4">Requests</div>
              {!!reqMsg && <div className="text-sm text-purple-600 mb-3">{reqMsg}</div>}
              {reqLoading ? (
                <div className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Loading...</div>
              ) : (
                <div className="flex flex-col gap-2">
                  {requests.map((r) => (
                    <div key={r.id} className={`border rounded-lg p-4 ${darkMode ? 'border-gray-700' : 'border-gray-200 bg-white/60'}`}>
                      <div className="font-medium">{r.message}</div>
                      <div className={`text-sm mt-1 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                        {r.branch?.name ?? '-'} • Sem {r.semesters?.number ?? '-'} • {r.subject_name ?? '-'}
                      </div>
                      <div className={`text-xs mt-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{formatDate(r.created_at)}</div>
                      <button type="button" className="mt-2 underline text-purple-600 text-sm" onClick={() => deleteRequest(r.id)}>
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Feedback */}
          {section === 'feedback' && (
            <div className={`border rounded-lg p-5 ${cardBg}`}>
              <div className="font-bold mb-4">Feedback</div>
              {!!fbMsg && <div className="text-sm text-purple-600 mb-3">{fbMsg}</div>}
              {fbLoading ? (
                <div className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Loading...</div>
              ) : (
                <div className="flex flex-col gap-2">
                  {feedback.map((f) => (
                    <div key={f.id} className={`border rounded-lg p-4 ${darkMode ? 'border-gray-700' : 'border-gray-200 bg-white/60'}`}>
                      <div className="font-medium">{f.type}</div>
                      <div className={`text-sm mt-1 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>{f.message}</div>
                      <div className={`text-xs mt-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{formatDate(f.created_at)}</div>
                      <button type="button" className="mt-2 underline text-purple-600 text-sm" onClick={() => deleteFeedback(f.id)}>
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

