'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

type Branch = { id: number; name: string }
type Announcement = { id: number; title: string; body: string; created_at: string }
type Semester = { id: number; number: number; branch_id: number }
type Subject = { id: number; name: string; semester_id: number }

type ContributionType = 'syllabus' | 'unit1' | 'unit2' | 'unit3' | 'unit4' | 'practical' | 'miscellaneous'

const CONTRIBUTION_TYPE_LABELS: Record<ContributionType, string> = {
  syllabus: 'Syllabus',
  unit1: 'Unit 1',
  unit2: 'Unit 2',
  unit3: 'Unit 3',
  unit4: 'Unit 4',
  practical: 'Practical',
  miscellaneous: 'Miscellaneous',
}

type Props = {
  branches: Branch[]
  semesters: { id: number; number: number; branch_id: number }[]
  announcements: Announcement[]
}

type Modal = 'contribute' | 'request' | 'feedback' | 'announcements' | null

export default function HomeClient({ branches, semesters, announcements }: Props) {
  const router = useRouter()
  const [darkMode, setDarkMode] = useState(false)
  const [search, setSearch] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [modal, setModal] = useState<Modal>(null)
  const [openBranchId, setOpenBranchId] = useState<number | null>(null)

  const [contributeForm, setContributeForm] = useState({
    title: '',
    branch_id: '',
    semester_id: '',
    subject_id: '',
    type: '' as '' | ContributionType,
    contributor_name: '',
    note: '',
  })
  const [contributeFile, setContributeFile] = useState<File | null>(null)
  const [contributeSubjects, setContributeSubjects] = useState<Subject[]>([])
  const [contributeSubjectsLoading, setContributeSubjectsLoading] = useState(false)
  const [requestForm, setRequestForm] = useState({
    message: '', branch_id: '', subject_name: ''
  })
  const [feedbackForm, setFeedbackForm] = useState({ type: 'feedback', message: '' })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')

  // Keep filtering deterministic and cheap on re-render.
  const filteredBranches = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return branches
    return branches.filter((b) => b.name.toLowerCase().includes(q))
  }, [branches, search])

  const semestersByBranchId = useMemo(() => {
    const map = new Map<number, Semester[]>()
    for (const s of semesters) {
      const list = map.get(s.branch_id) ?? []
      list.push(s)
      map.set(s.branch_id, list)
    }
    for (const [branchId, list] of map) {
      list.sort((a, b) => a.number - b.number)
      map.set(branchId, list)
    }
    return map
  }, [semesters])

  // UX: ESC closes whichever overlay is open.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setDrawerOpen(false)
      setModal(null)
      setSuccess('')
      setLoading(false)
      setOpenBranchId(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Close the semesters dropdown when clicking outside.
  useEffect(() => {
    if (openBranchId === null) return
    const onPointerDown = (e: PointerEvent) => {
      const el = e.target as HTMLElement | null
      if (!el) return
      if (el.closest('[data-semester-dropdown-root="true"]')) return
      setOpenBranchId(null)
    }
    window.addEventListener('pointerdown', onPointerDown)
    return () => window.removeEventListener('pointerdown', onPointerDown)
  }, [openBranchId])

  // Contribute modal: fetch subjects after semester selection.
  useEffect(() => {
    let cancelled = false

    const semesterId = Number(contributeForm.semester_id)
    if (!Number.isFinite(semesterId)) {
      setContributeSubjects([])
      return
    }

    const run = async () => {
      setContributeSubjectsLoading(true)
      try {
        // Schema note: `subjects` table uses `semester_id`.
        const { data, error } = await supabase.from('subjects').select('*').eq('semester_id', semesterId)
        if (error) throw error
        if (!cancelled) setContributeSubjects((data as Subject[]) || [])
      } catch {
        if (!cancelled) setContributeSubjects([])
      } finally {
        if (!cancelled) setContributeSubjectsLoading(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [contributeForm.semester_id])

  const closeModal = () => {
    setModal(null)
    setSuccess('')
    setLoading(false)
  }

  const closeDrawer = () => setDrawerOpen(false)

  const navigate = (href: string) => {
    // Ensure drawer doesn't stay open after navigation.
    closeDrawer()
    router.push(href)
  }

  const handleContribute = async () => {
    // Required fields per schema: title, branch_id, semester_id, subject_id, type, file.
    if (
      !contributeFile ||
      !contributeForm.title.trim() ||
      !contributeForm.branch_id ||
      !contributeForm.semester_id ||
      !contributeForm.subject_id ||
      !contributeForm.type
    ) {
      setSuccess('Please fill all required fields.')
      return
    }

    // Basic file validation for easier debugging.
    const ext = contributeFile.name.split('.').pop()?.toLowerCase()
    if (!ext || !['pdf', 'ppt', 'pptx'].includes(ext)) {
      setSuccess('Only .pdf, .ppt, .pptx files are allowed.')
      return
    }

    setLoading(true)
    try {
      const fileName = `${Date.now()}-${contributeForm.branch_id}-${contributeForm.semester_id}-${contributeForm.subject_id}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('contributions')
        .upload(fileName, contributeFile)
      if (uploadError) throw uploadError
      const { data: urlData } = supabase.storage.from('contributions').getPublicUrl(fileName)
      await supabase.from('contributions').insert({
        title: contributeForm.title,
        // Schema note: contributions uses `url` (not `file_url`).
        url: urlData.publicUrl,
        branch_id: Number(contributeForm.branch_id),
        semester_id: Number(contributeForm.semester_id),
        subject_id: Number(contributeForm.subject_id),
        type: contributeForm.type,
        contributor_name: contributeForm.contributor_name.trim() || null,
        note: contributeForm.note.trim() || null,
        is_approved: false,
      })
      setSuccess('Contribution submitted! We will review it shortly.')
    } catch {
      setSuccess('Something went wrong. Please try again.')
    }
    setLoading(false)
  }

  const handleRequest = async () => {
    if (!requestForm.message) return
    setLoading(true)
    try {
      await supabase.from('requests').insert({
        message: requestForm.message,
        branch_id: requestForm.branch_id ? Number(requestForm.branch_id) : null,
        subject_name: requestForm.subject_name || null,
      })
      setSuccess('Request submitted!')
    } catch {
      setSuccess('Something went wrong. Please try again.')
    }
    setLoading(false)
  }

  const handleFeedback = async () => {
    if (!feedbackForm.message) return
    setLoading(true)
    try {
      await supabase.from('feedback').insert({
        type: feedbackForm.type,
        message: feedbackForm.message,
      })
      setSuccess('Thank you for your feedback!')
    } catch {
      setSuccess('Something went wrong. Please try again.')
    }
    setLoading(false)
  }

  const bg = darkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'
  const cardBg = darkMode ? 'bg-gray-800 border-gray-700' : 'bg-slate-100 border-slate-200'
  const inputCls = darkMode
    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'

  // `announcements` is already constrained server-side (last 60 days, most recent 10).
  const announcementPreview = announcements.slice(0, 3)
  const hasMoreAnnouncements = announcements.length > 3

  return (
    <main className={`min-h-screen ${bg} transition-colors duration-200`}>

      {/* Header */}
      <header className={`relative flex items-center justify-between px-8 py-7 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="text-2xl leading-none select-none"
          aria-label="Open menu"
        >
          ☰
        </button>
        <h1 className="absolute left-1/2 -translate-x-1/2 text-2xl font-extrabold tracking-tight text-center">
          WELCOME TO IGDTUW RESOURCES
        </h1>
        <div className="flex items-center gap-3">
          {/* Keep this as a simple local toggle for now (no persistence). */}
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
                onClick={() => navigate('/community-connect')}
                className={`text-left rounded-md px-3 py-2 border ${
                  darkMode ? 'border-gray-700 hover:bg-gray-800' : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                Community Connect
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

      {/* Search */}
      <div style={{display: 'flex', justifyContent: 'center', padding: '48px 32px 16px 32px'}}>
        <div className={`flex items-center border rounded-md px-4 py-2 w-full max-w-sm ${inputCls}`}>
          <span className="mr-2 text-gray-400">🔍</span>
          <input
            type="text"
            placeholder="type subject to search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-transparent outline-none w-full text-sm"
          />
        </div>
      </div>

      {/* Three column layout */}
      <div style={{display: 'flex', gap: '32px', padding: '24px 48px', alignItems: 'start', width: '100%'}}>

        {/* Left */}
        <div style={{width: '260px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '24px'}}>
          <div className={`border rounded-lg p-6 ${cardBg}`}>
            <h2 className="font-bold mb-3">Wanna Contribute</h2>
            <button
              onClick={() => setModal('contribute')}
              className="border border-gray-300 bg-white text-gray-700 rounded px-3 py-1.5 text-sm w-full text-left"
            >
              Drop study material here
            </button>
          </div>
          <div className={`border rounded-lg p-6 ${cardBg}`}>
            <h2 className="font-bold mb-3">Requests</h2>
            <button
              onClick={() => setModal('request')}
              className="border border-gray-300 bg-white text-gray-700 rounded px-3 py-1.5 text-sm w-full text-left"
            >
              Any material required?
            </button>
          </div>
        </div>

        {/* Center - Branches */}
        <div className="flex-1 flex flex-col gap-4">
          {filteredBranches.length === 0 ? (
            <p className="text-center text-gray-400 mt-8">No branches found</p>
          ) : (
            filteredBranches.map((branch) => {
              const isOpen = openBranchId === branch.id
              const branchSemesters = semestersByBranchId.get(branch.id) ?? []

              return (
                <div key={branch.id} data-semester-dropdown-root="true" className="w-full">
                  <button
                    type="button"
                    onClick={() => setOpenBranchId((prev) => (prev === branch.id ? null : branch.id))}
                    className="bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white font-semibold py-4 rounded-md w-full transition-colors duration-150 text-lg"
                  >
                    {branch.name}
                  </button>

                  {isOpen && (
                    <div className="mt-2 bg-white text-gray-900 rounded-lg shadow-md border border-gray-200 overflow-hidden">
                      {branchSemesters.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-gray-500">No semesters available.</div>
                      ) : (
                        branchSemesters.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            className="w-full text-left px-4 py-3 text-sm hover:bg-purple-50 hover:text-purple-700 transition-colors"
                            onClick={() => router.push(`/branch/${branch.id}/semester/${s.id}/subjects`)}
                          >
                            Semester {s.number}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Right */}
        <div style={{width: '260px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '24px'}}>
          <div className={`border rounded-lg p-6 ${cardBg}`}>
            <h2 className="font-bold mb-3">Announcements</h2>
            {announcements.length === 0 ? (
              <p className="text-sm text-gray-400">No announcements yet</p>
            ) : (
              <>
                <div className="flex flex-col gap-2">
                  {announcementPreview.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setModal('announcements')}
                      className="border border-gray-300 bg-white text-gray-700 rounded px-3 py-1.5 text-sm w-full text-left"
                      title="Open announcements"
                    >
                      {a.title}
                    </button>
                  ))}
                </div>

                {hasMoreAnnouncements && (
                  <button
                    type="button"
                    onClick={() => setModal('announcements')}
                    className={`mt-3 text-sm font-medium underline ${
                      darkMode ? 'text-gray-200 hover:text-white' : 'text-gray-700 hover:text-black'
                    }`}
                  >
                    Show more
                  </button>
                )}
              </>
            )}
          </div>
          <div className={`border rounded-lg p-6 ${cardBg}`}>
            <h2 className="font-bold mb-3">Feedback / Suggestions</h2>
            <button
              onClick={() => setModal('feedback')}
              className="border border-gray-300 bg-white text-gray-700 rounded px-3 py-1.5 text-sm w-full text-left"
            >
              Help us improve
            </button>
          </div>
        </div>

      </div>

      {/* Modal */}
      {modal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={closeModal}
        >
          <div
            className={`rounded-xl p-6 w-full max-w-md shadow-xl ${darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}`}
            onClick={e => e.stopPropagation()}
          >
            {modal === 'contribute' && (
              <>
                <h2 className="text-lg font-bold mb-4">Contribute Material</h2>
                {success ? <p className="text-green-500 text-sm">{success}</p> : (
                  <div className="flex flex-col gap-3">
                    <input placeholder="Title *" className={`border rounded px-3 py-2 text-sm w-full ${inputCls}`}
                      value={contributeForm.title} onChange={e => setContributeForm({ ...contributeForm, title: e.target.value })} />
                    <select
                      className={`border rounded px-3 py-2 text-sm w-full ${inputCls}`}
                      value={contributeForm.branch_id}
                      onChange={(e) => {
                        // Reset dependent fields to keep output correct.
                        setContributeForm({
                          ...contributeForm,
                          branch_id: e.target.value,
                          semester_id: '',
                          subject_id: '',
                        })
                        setContributeSubjects([])
                      }}
                    >
                      <option value="">Select branch *</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>

                    <select
                      className={`border rounded px-3 py-2 text-sm w-full ${inputCls} ${
                        !contributeForm.branch_id ? 'opacity-60 cursor-not-allowed' : ''
                      }`}
                      value={contributeForm.semester_id}
                      disabled={!contributeForm.branch_id}
                      onChange={(e) => {
                        // Reset subject when semester changes.
                        setContributeForm({ ...contributeForm, semester_id: e.target.value, subject_id: '' })
                      }}
                    >
                      <option value="">Select semester *</option>
                      {(semestersByBranchId.get(Number(contributeForm.branch_id)) ?? []).map((s) => (
                        <option key={s.id} value={s.id}>
                          Semester {s.number}
                        </option>
                      ))}
                    </select>

                    <select
                      className={`border rounded px-3 py-2 text-sm w-full ${inputCls} ${
                        !contributeForm.semester_id ? 'opacity-60 cursor-not-allowed' : ''
                      }`}
                      value={contributeForm.subject_id}
                      disabled={!contributeForm.semester_id || contributeSubjectsLoading}
                      onChange={(e) => setContributeForm({ ...contributeForm, subject_id: e.target.value })}
                    >
                      <option value="">
                        {!contributeForm.semester_id
                          ? 'Select semester first'
                          : contributeSubjectsLoading
                            ? 'Loading subjects...'
                            : 'Select subject *'}
                      </option>
                      {contributeSubjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>

                    <select
                      className={`border rounded px-3 py-2 text-sm w-full ${inputCls}`}
                      value={contributeForm.type}
                      onChange={(e) => setContributeForm({ ...contributeForm, type: e.target.value as any })}
                    >
                      <option value="">Select type *</option>
                      {(Object.keys(CONTRIBUTION_TYPE_LABELS) as Array<keyof typeof CONTRIBUTION_TYPE_LABELS>).map((k) => (
                        <option key={k} value={k}>
                          {CONTRIBUTION_TYPE_LABELS[k]}
                        </option>
                      ))}
                    </select>

                    <input
                      placeholder="Contributor name (optional)"
                      className={`border rounded px-3 py-2 text-sm w-full ${inputCls}`}
                      value={contributeForm.contributor_name}
                      onChange={(e) => setContributeForm({ ...contributeForm, contributor_name: e.target.value })}
                    />

                    <textarea
                      placeholder="Note (optional)"
                      className={`border rounded px-3 py-2 text-sm w-full h-20 resize-none ${inputCls}`}
                      value={contributeForm.note}
                      onChange={(e) => setContributeForm({ ...contributeForm, note: e.target.value })}
                    />

                    <input
                      type="file"
                      accept=".pdf,.ppt,.pptx"
                      className="text-sm"
                      onChange={(e) => setContributeFile(e.target.files?.[0] || null)}
                    />
                    <button onClick={handleContribute} disabled={loading}
                      className="bg-purple-600 hover:bg-purple-700 text-white rounded px-4 py-2 text-sm font-medium">
                      {loading ? 'Submitting...' : 'Submit'}
                    </button>
                  </div>
                )}
              </>
            )}

            {modal === 'request' && (
              <>
                <h2 className="text-lg font-bold mb-4">Request Material</h2>
                {success ? <p className="text-green-500 text-sm">{success}</p> : (
                  <div className="flex flex-col gap-3">
                    <textarea placeholder="What material do you need? *" className={`border rounded px-3 py-2 text-sm w-full h-24 resize-none ${inputCls}`}
                      value={requestForm.message} onChange={e => setRequestForm({ ...requestForm, message: e.target.value })} />
                    <select className={`border rounded px-3 py-2 text-sm w-full ${inputCls}`}
                      value={requestForm.branch_id} onChange={e => setRequestForm({ ...requestForm, branch_id: e.target.value })}>
                      <option value="">Select branch (optional)</option>
                      {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                    <input placeholder="Subject name (optional)" className={`border rounded px-3 py-2 text-sm w-full ${inputCls}`}
                      value={requestForm.subject_name} onChange={e => setRequestForm({ ...requestForm, subject_name: e.target.value })} />
                    <button onClick={handleRequest} disabled={loading}
                      className="bg-purple-600 hover:bg-purple-700 text-white rounded px-4 py-2 text-sm font-medium">
                      {loading ? 'Submitting...' : 'Submit'}
                    </button>
                  </div>
                )}
              </>
            )}

            {modal === 'feedback' && (
              <>
                <h2 className="text-lg font-bold mb-4">Feedback / Suggestions</h2>
                {success ? <p className="text-green-500 text-sm">{success}</p> : (
                  <div className="flex flex-col gap-3">
                    <select className={`border rounded px-3 py-2 text-sm w-full ${inputCls}`}
                      value={feedbackForm.type} onChange={e => setFeedbackForm({ ...feedbackForm, type: e.target.value })}>
                      <option value="feedback">Feedback</option>
                      <option value="suggestion">Suggestion</option>
                    </select>
                    <textarea placeholder="Write here... *" className={`border rounded px-3 py-2 text-sm w-full h-24 resize-none ${inputCls}`}
                      value={feedbackForm.message} onChange={e => setFeedbackForm({ ...feedbackForm, message: e.target.value })} />
                    <button onClick={handleFeedback} disabled={loading}
                      className="bg-purple-600 hover:bg-purple-700 text-white rounded px-4 py-2 text-sm font-medium">
                      {loading ? 'Submitting...' : 'Submit'}
                    </button>
                  </div>
                )}
              </>
            )}

            {modal === 'announcements' && (
              <>
                <h2 className="text-lg font-bold mb-4">Announcements</h2>
                {announcements.length === 0 ? (
                  <p className="text-sm text-gray-400">No announcements yet.</p>
                ) : (
                  <div className="flex flex-col gap-3 max-h-[60vh] overflow-auto pr-1">
                    {announcements.map((a) => (
                      <div
                        key={a.id}
                        className={`border rounded-lg p-3 ${
                          darkMode ? 'border-gray-700 bg-gray-900/30' : 'border-gray-200 bg-slate-50'
                        }`}
                      >
                        <div className="font-semibold">{a.title}</div>
                        {!!a.body && <div className={`text-sm mt-1 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>{a.body}</div>}
                        {!!a.created_at && (
                          <div className={`text-xs mt-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            {new Date(a.created_at).toLocaleString()}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            <button onClick={closeModal} className="mt-4 text-sm text-gray-400 hover:text-gray-600 w-full text-center">
              Close
            </button>
          </div>
        </div>
      )}

    </main>
  )
}