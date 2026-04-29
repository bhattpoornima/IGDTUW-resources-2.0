'use client'

import { useEffect } from 'react'

export default function SubjectsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Surface route-level crashes in the console for debugging.
    console.error('Subjects route error:', error)
  }, [error])

  return (
    <main style={{ padding: 24 }}>
      <h1 style={{ fontSize: 20, fontWeight: 800 }}>Something went wrong</h1>
      <p style={{ marginTop: 8, color: '#666' }}>
        The subjects page crashed while rendering. The details below help us debug it.
      </p>
      <pre style={{ marginTop: 12, padding: 12, background: '#f5f5f5', overflow: 'auto' }}>
        {String(error?.message || error)}
        {error?.digest ? `\n\ndigest: ${error.digest}` : ''}
      </pre>
      <button
        type="button"
        onClick={reset}
        style={{
          marginTop: 12,
          padding: '8px 12px',
          border: '1px solid #ddd',
          borderRadius: 8,
          cursor: 'pointer',
        }}
      >
        Retry
      </button>
    </main>
  )
}

