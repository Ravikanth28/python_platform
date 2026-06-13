export default function StatCard({ icon: Icon, label, value, sub, color, trend }) {
  const c = color || 'var(--brand)'
  return (
    <div className="stat-card">
      <div
        className="stat-icon"
        style={{ background: `color-mix(in srgb, ${c} 14%, transparent)`, color: c }}
      >
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="h-section truncate">{label}</p>
        <p className="h-metric mt-1">{value ?? '—'}</p>
        {sub && <p className="text-[12px] text-t4 mt-0.5">{sub}</p>}
      </div>
      {trend !== undefined && (
        <div
          className="ml-auto text-[12px] font-semibold px-2 py-1 rounded-lg tabular"
          style={{
            color: trend >= 0 ? 'var(--ok)' : 'var(--err)',
            background: trend >= 0
              ? 'color-mix(in srgb, var(--ok) 14%, transparent)'
              : 'color-mix(in srgb, var(--err) 14%, transparent)',
          }}
        >
          {trend >= 0 ? '+' : ''}{trend}%
        </div>
      )}
    </div>
  )
}
