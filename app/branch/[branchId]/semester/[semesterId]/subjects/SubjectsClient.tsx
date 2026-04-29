'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

type Branch = { id: number; name: string }
type Semester = { id: number; number: number; branch_id: number }
type Subject = { id: number; name: string; semester_id: number }

type MaterialType = 'syllabus' | 'unit1' | 'unit2' | 'unit3' | 'unit4' | 'practical' | 'miscellaneous'
type Material = { id: number; title: string; url: string; type: MaterialType; subject_id: number }

type Props = {
  branch: Branch | null
  semester: Semester | null
  subjects: Subject[]
  materials: Material[]
}

const TYPE_LABELS: Record<MaterialType, string> = {
  syllabus: 'Syllabus',
  unit1: 'Unit 1',
  unit2: 'Unit 2',
  unit3: 'Unit 3',
  unit4: 'Unit 4',
  practical: 'Practical',
  miscellaneous: 'Miscellaneous',
}

const TYPE_ORDER: MaterialType[] = ['syllabus', 'unit1', 'unit2', 'unit3', 'unit4', 'practical', 'miscellaneous']

export default function SubjectsClient({ branch, semester, subjects, materials }: Props) {
  const router = useRouter()
  const [darkMode, setDarkMode] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerTitle, setPickerTitle] = useState('')
  const [pickerItems, setPickerItems] = useState<Material[]>([])

  const materialsBySubjectId = useMemo(() => {
    // Schema note: `materials.url` is the file link (not `file_url`).
    const bySubject = new Map<number, Map<MaterialType, Material[]>>()

    for (const m of materials) {
      const types = bySubject.get(m.subject_id) ?? new Map<MaterialType, Material[]>()
      const list = types.get(m.type) ?? []
      list.push(m)
      types.set(m.type, list)
      bySubject.set(m.subject_id, types)
    }

    return bySubject
  }, [materials])

  // Defensive: if Supabase returns unexpected rows (nulls / missing fields),
  // avoid crashing the entire UI and show what we can.
  const safeSubjects = useMemo(() => {
    return (subjects || []).filter((s: any) => s && typeof s.id === 'number')
  }, [subjects])

  // UX: ESC closes overlays.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setDrawerOpen(false)
      setPickerOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const bg = darkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'

  const closeDrawer = () => setDrawerOpen(false)
  const navigate = (href: string) => {
    closeDrawer()
    router.push(href)
  }

  const openPdf = (url: string) => {
    if (!url || typeof url !== 'string') {
      setPickerTitle('This PDF link is missing.')
      setPickerItems([])
      setPickerOpen(true)
      return
    }
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const onMaterialTypeClick = (subjectName: string, type: MaterialType, items: Material[]) => {
    const validItems = (items || []).filter((m) => !!m?.url)
    if (validItems.length === 0) {
      setPickerTitle('No valid PDFs found for this item.')
      setPickerItems([])
      setPickerOpen(true)
      return
    }
    if (validItems.length === 1) {
      openPdf(validItems[0].url)
      return
    }
    setPickerTitle(`${subjectName} • ${TYPE_LABELS[type]}`)
    setPickerItems(validItems)
    setPickerOpen(true)
  }

  return (
    <main className={`min-h-screen ${bg} transition-colors duration-200 flex flex-col`}>
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

      {/* Breadcrumb */}
      <div className={`px-8 py-4 text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
        <button type="button" className="font-semibold hover:underline" onClick={() => router.push('/')}>
          {branch?.name ?? 'Branch'}
        </button>
        <span className="mx-2">/</span>
        <span>Sem {semester?.number ?? '-'}</span>
      </div>

      {/* Content */}
      <section className="flex-1 overflow-auto px-8 pb-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 justify-start items-start">
          {safeSubjects.map((subject: any) => {
            const subjectId: number = subject.id
            const subjectName: string = subject.name ?? subject.subject_name ?? 'Untitled subject'
            const typeMap = materialsBySubjectId.get(subjectId)
            const availableTypes = TYPE_ORDER.filter((t) => (typeMap?.get(t)?.length ?? 0) > 0)

            return (
              <div key={subjectId} className="bg-purple-600 rounded-none shadow-md overflow-hidden">
                <div className="px-5 py-4">
                  <div className="text-white font-bold text-lg leading-snug">{subjectName}</div>
                </div>

                <div className="px-3 pb-4">
                  <div className="bg-white/10 rounded-none overflow-hidden">
                    {availableTypes.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-white/80">No materials yet.</div>
                    ) : (
                      availableTypes.map((t) => {
                        const items = typeMap!.get(t)!
                        return (
                          <button
                            key={t}
                            type="button"
                            onClick={() => onMaterialTypeClick(subjectName, t, items)}
                            className="w-full flex items-center justify-between px-4 py-3 text-left text-white/95 hover:bg-purple-700/40 transition-colors group"
                          >
                            <span className="text-sm group-hover:text-[0.95rem] transition-all">{TYPE_LABELS[t]}</span>
                            <span className="opacity-90 group-hover:opacity-100 transition-opacity">›</span>
                          </button>
                        )
                      })
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* PDF picker modal */}
      {pickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setPickerOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div
            className={`relative w-full max-w-md rounded-xl shadow-xl p-5 ${
              darkMode ? 'bg-gray-900 text-white border border-gray-700' : 'bg-white text-gray-900 border border-gray-200'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="font-bold">{pickerTitle}</div>
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                className={`${darkMode ? 'text-gray-300 hover:text-white' : 'text-gray-500 hover:text-black'}`}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="max-h-[60vh] overflow-auto rounded-lg border border-gray-200/60">
              {pickerItems.length === 0 ? (
                <div className={`px-4 py-3 text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  No links available.
                </div>
              ) : (
                pickerItems.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => openPdf(m.url)}
                    className={`w-full text-left px-4 py-3 text-sm border-b last:border-b-0 ${
                      darkMode
                        ? 'border-gray-800 hover:bg-gray-800'
                        : 'border-gray-200 hover:bg-purple-50 hover:text-purple-700'
                    }`}
                  >
                    {m.title || 'Untitled PDF'}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

