// Small row of labeled count chips, e.g. "All 24 · Easy 10 · Medium 8 · Hard 6".
export default function CountBar({ stats }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {stats.filter(Boolean).map((s) => (
        <span key={s.label}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-line text-[12px] bg-surface">
          <span className="text-t3">{s.label}</span>
          <span className="tabular font-semibold" style={{ color: s.color || 'var(--t)' }}>{s.count}</span>
        </span>
      ))}
    </div>
  )
}

// Helper: difficulty breakdown chips from a list of items with a `difficulty` field.
export function diffStats(items, key = 'difficulty') {
  const c = { easy: 0, medium: 0, hard: 0 }
  for (const it of items || []) {
    const d = (it[key] || '').toLowerCase()
    if (d in c) c[d]++
  }
  return [
    { label: 'Easy', count: c.easy, color: 'var(--ok)' },
    { label: 'Medium', count: c.medium, color: 'var(--warn)' },
    { label: 'Hard', count: c.hard, color: 'var(--err)' },
  ]
}
