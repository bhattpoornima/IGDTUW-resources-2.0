'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

type Branch = { id: number; name: string }
type Semester = { id: number; number: number; branch_id: number }
type ExamType = 'midterm' | 'endterm'
type Pyq = { id: number; title: string; year: number; url: string; exam_type: ExamType; semester_id: number }

export default function PyqsPage() {
  const router = useRouter()
  const [darkMode, setDarkMode] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Dropdown state
  const [branches, setBranches] = useState<Branch[]>([])
  const [semesters, setSemesters] = useState<Semester[]>([])
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null)
  const [selectedSemesterId, setSelectedSemesterId] = useState<number | null>(null)

  // Results state
  const [pyqs, setPyqs] = useState<Pyq[]>([])
  const [loadingBranches, setLoadingBranches] = useState(false)
  const [loadingSemesters, setLoadingSemesters] = useState(false)
  const [loadingPyqs, setLoadingPyqs] = useState(false)
  const [error, setError] = useState<string>('')

  const bg = darkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'
  const cardBg = darkMode ? 'bg-gray-800 border-gray-700' : 'bg-slate-100 border-slate-200'
  const inputBg = darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'

  const closeDrawer = () => setDrawerOpen(false)
  const navigate = (href: string) => {
    closeDrawer()
    router.push(href)
  }

  const openPdf = (url: string) => {
    // Schema note: `pyqs.url` is the file link (not `file_url`).
    if (!url) return
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  // Fetch all branches once on load.
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoadingBranches(true)
      setError('')
      try {
        const { data, error: e } = await supabase.from('branch').select('*')
        if (e) throw e
        if (!cancelled) setBranches((data as Branch[]) || [])
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load branches.')
      } finally {
        if (!cancelled) setLoadingBranches(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [])

  // When branch changes: reset dependent selections and fetch semesters for it.
  useEffect(() => {
    let cancelled = false

    // Reset downstream state for clean debugging + correct outputs.
    setSelectedSemesterId(null)
    setPyqs([])

    if (selectedBranchId === null) {
      setSemesters([])
      return
    }

    const run = async () => {
      setLoadingSemesters(true)
      setError('')
      try {
        const { data, error: e } = await supabase
          .from('semesters')
          .select('*')
          .eq('branch_id', selectedBranchId)
          .order('number')
        if (e) throw e
        if (!cancelled) setSemesters((data as Semester[]) || [])
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load semesters.')
      } finally {
        if (!cancelled) setLoadingSemesters(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [selectedBranchId])

  // When both branch and semester are selected: fetch PYQs (auto-load, no button).
  useEffect(() => {
    let cancelled = false
    if (selectedBranchId === null || selectedSemesterId === null) return

    const run = async () => {
      setLoadingPyqs(true)
      setError('')
      try {
        const { data, error: e } = await supabase
          .from('pyqs')
          .select('*')
          .eq('semester_id', selectedSemesterId)
          .order('year', { ascending: false })
        if (e) throw e
        if (!cancelled) setPyqs((data as Pyq[]) || [])
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load PYQs.')
      } finally {
        if (!cancelled) setLoadingPyqs(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [selectedBranchId, selectedSemesterId])

  // UX: ESC closes drawer.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setDrawerOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const midterms = useMemo(() => pyqs.filter((p) => p.exam_type === 'midterm'), [pyqs])
  const endterms = useMemo(() => pyqs.filter((p) => p.exam_type === 'endterm'), [pyqs])

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

      {/* Hero */}
      <div className="pt-10 pb-2">
        <div className="text-center font-extrabold text-purple-600 text-6xl sm:text-7xl md:text-8xl tracking-tight">
          PYQ
        </div>
      </div>

      {/* Breadcrumb */}
      <div className={`px-8 py-3 text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>PYQs</div>

      {/* Controls */}
      <section className="px-8 pb-6">
        <div className="flex flex-col md:flex-row gap-4 md:items-center">
          <div className="flex-1">
            <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>Select Branch</label>
            <select
              className={`w-full border rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500 ${inputBg}`}
              value={selectedBranchId ?? ''}
              onChange={(e) => setSelectedBranchId(e.target.value ? Number(e.target.value) : null)}
              disabled={loadingBranches}
            >
              <option value="">{loadingBranches ? 'Loading branches...' : 'Choose a branch'}</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1">
            <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>Select Semester</label>
            <select
              className={`w-full border rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500 ${inputBg} ${
                selectedBranchId === null ? 'opacity-60 cursor-not-allowed' : ''
              }`}
              value={selectedSemesterId ?? ''}
              onChange={(e) => setSelectedSemesterId(e.target.value ? Number(e.target.value) : null)}
              disabled={selectedBranchId === null || loadingSemesters}
            >
              <option value="">
                {selectedBranchId === null
                  ? 'Select a branch first'
                  : loadingSemesters
                    ? 'Loading semesters...'
                    : 'Choose a semester'}
              </option>
              {semesters.map((s) => (
                <option key={s.id} value={s.id}>
                  Semester {s.number}
                </option>
              ))}
            </select>
          </div>
        </div>

        {!!error && (
          <div className="mt-4 text-sm text-red-500">
            {error}
          </div>
        )}
      </section>

      {/* Results */}
      <section className="px-8 pb-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className={`border rounded-lg p-6 ${cardBg}`}>
            <div className="font-bold mb-3">Midterm</div>
            {loadingPyqs && selectedSemesterId !== null ? (
              <div className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Loading papers...</div>
            ) : midterms.length === 0 ? (
              <div className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>No midterm papers yet</div>
            ) : (
              <div className="flex flex-col">
                {midterms.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => openPdf(p.url)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-left transition-colors ${
                      darkMode ? 'hover:bg-purple-600/20' : 'hover:bg-purple-50'
                    }`}
                  >
                    <div className="flex items-baseline gap-3">
                      <span className="font-semibold">{p.year}</span>
                      <span className="text-sm">{p.title}</span>
                    </div>
                    <span className="opacity-80">›</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className={`border rounded-lg p-6 ${cardBg}`}>
            <div className="font-bold mb-3">End Term</div>
            {loadingPyqs && selectedSemesterId !== null ? (
              <div className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Loading papers...</div>
            ) : endterms.length === 0 ? (
              <div className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>No end term papers yet</div>
            ) : (
              <div className="flex flex-col">
                {endterms.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => openPdf(p.url)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-left transition-colors ${
                      darkMode ? 'hover:bg-purple-600/20' : 'hover:bg-purple-50'
                    }`}
                  >
                    <div className="flex items-baseline gap-3">
                      <span className="font-semibold">{p.year}</span>
                      <span className="text-sm">{p.title}</span>
                    </div>
                    <span className="opacity-80">›</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  )
}

