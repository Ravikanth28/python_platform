import { useEffect, useMemo, useRef, useState } from 'react'
import { RefreshCw, CheckCircle2, XCircle, AlertTriangle, Search, Pause, Play, Database, HardDrive, Download, Trash2, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import api, { downloadFile } from '../../api/client'
import { PageLoader } from '../../components/ui/LoadingSpinner'
import Modal from '../../components/ui/Modal'

const STATUS = {
  healthy:  { color: 'var(--ok)',   label: 'All systems operational' },
  degraded: { color: 'var(--warn)', label: 'Operational — with warnings' },
  down:     { color: 'var(--err)',  label: 'Service disruption' },
}

const INTERVALS = [['Off', 0], ['2s', 2000], ['5s', 5000], ['15s', 15000]]

// disk-breakdown segment colours
const SEG_COLOR = {
  system: 'var(--t4)',           // OS / base image / other tenants
  uploads: 'var(--brand-solid)', // files we store
  free: 'color-mix(in srgb, var(--ok) 35%, transparent)',
}

const methodColor = (m) => ({
  GET: 'var(--info)', POST: 'var(--ok)', PUT: 'var(--warn)',
  PATCH: 'var(--warn)', DELETE: 'var(--err)',
}[m] || 'var(--t3)')

const statusColor = (s) =>
  s >= 500 ? 'var(--err)' : s >= 400 ? 'var(--warn)' : s >= 300 ? 'var(--info)' : 'var(--ok)'

const levelColor = (l) =>
  (l === 'ERROR' || l === 'CRITICAL') ? 'var(--err)' : l === 'WARNING' ? 'var(--warn)' : 'var(--t3)'

export default function AdminSystem() {
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [interval_, setInterval_] = useState(5000)
  const [kind, setKind]   = useState('all')   // all | http | log
  const [query, setQuery] = useState('')
  const scrollRef = useRef(null)

  const load = (initial = false) => {
    if (!initial) setRefreshing(true)
    api.get('/admin/health')
      .then(r => setData(r.data))
      .catch(() => setData({ status: 'down', checks: [], logs: [] }))
      .finally(() => { setLoading(false); setRefreshing(false) })
  }

  useEffect(() => { load(true) }, [])

  useEffect(() => {
    if (!interval_) return
    const t = setInterval(() => load(), interval_)
    return () => clearInterval(t)
  }, [interval_])

  const logs = data?.logs || []
  const counts = useMemo(() => ({
    http: logs.filter(l => l.kind === 'http').length,
    log:  logs.filter(l => l.kind !== 'http').length,
    err:  logs.filter(l => (l.kind === 'http' && l.status >= 400) ||
                           (l.kind !== 'http' && (l.level === 'ERROR' || l.level === 'CRITICAL'))).length,
  }), [logs])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return logs.filter(l => {
      if (kind === 'http' && l.kind !== 'http') return false
      if (kind === 'log'  && l.kind === 'http') return false
      if (!q) return true
      const hay = l.kind === 'http'
        ? `${l.method} ${l.path} ${l.status}`
        : `${l.level} ${l.logger} ${l.message}`
      return hay.toLowerCase().includes(q)
    })
  }, [logs, kind, query])

  if (loading) return <PageLoader />

  const st = STATUS[data.status] || { color: 'var(--t4)', label: data.status }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="h1">System health</h1>
          <p className="section-sub mt-1">Live status of backend services &amp; dependencies, with a real-time request log.</p>
        </div>
        <button className="btn-secondary btn-sm" onClick={() => load()}>
          <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Overall status */}
      <div className="card flex items-center gap-3">
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: st.color }} />
        <span className="font-serif font-semibold text-[18px]" style={{ color: st.color }}>{st.label}</span>
      </div>

      {/* Service checks */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.checks.map(c => (
          <div key={c.name} className="card">
            <div className="flex items-center gap-2">
              {c.ok
                ? <CheckCircle2 size={16} style={{ color: 'var(--ok)' }} />
                : (c.critical ? <XCircle size={16} style={{ color: 'var(--err)' }} /> : <AlertTriangle size={16} style={{ color: 'var(--warn)' }} />)}
              <span className="text-[13px] font-semibold text-t">{c.name}</span>
              {!c.critical && <span className="text-[10px] text-t4 border border-line rounded px-1 ml-auto">optional</span>}
            </div>
            <p className="text-[12px] text-t3 mt-1.5 font-mono break-words">{c.detail}</p>
          </div>
        ))}
      </div>

      {/* Storage usage */}
      {data.storage?.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {data.storage.map((s) => {
            const Icon = s.kind === 'db' ? Database : HardDrive
            const over = s.warn
            const near = !over && s.percent >= 75
            const color = over ? 'var(--err)' : near ? 'var(--warn)' : 'var(--ok)'
            return (
              <div key={s.name} className="card">
                <div className="flex items-center gap-2 mb-2">
                  <Icon size={16} style={{ color }} />
                  <span className="text-[13px] font-semibold text-t">{s.name}</span>
                  {over && <span className="text-[10px] ml-auto px-1.5 py-0.5 rounded" style={{ color: 'var(--err)', background: 'color-mix(in srgb, var(--err) 14%, transparent)' }}>running low</span>}
                </div>
                {s.error ? (
                  <p className="text-[12px] text-t4 font-mono break-words">unavailable: {s.error}</p>
                ) : s.breakdown ? (
                  /* split disk usage (informational): System / Your files / Free */
                  <>
                    <div className="flex justify-between text-[12px] text-t3 mb-1.5">
                      <span className="tabular">{s.used_mb} MB / {s.limit_mb} MB used</span>
                      <span className="tabular font-semibold text-t3">{s.percent}%</span>
                    </div>
                    <div className="flex h-2.5 rounded-full overflow-hidden surface-inset">
                      {s.breakdown.map((seg) => (
                        <div key={seg.seg} title={`${seg.label}: ${seg.mb} MB`}
                          style={{ width: `${s.limit_mb ? (seg.mb / s.limit_mb) * 100 : 0}%`, background: SEG_COLOR[seg.seg] }} />
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px]">
                      {s.breakdown.map((seg) => (
                        <span key={seg.seg} className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: SEG_COLOR[seg.seg] }} />
                          <span className="text-t3">{seg.label}</span>
                          <span className="tabular font-semibold text-t2">{seg.mb} MB</span>
                        </span>
                      ))}
                    </div>
                    {s.note && <p className="text-[11px] text-t4 mt-1.5">{s.note}</p>}
                  </>
                ) : (
                  <>
                    <div className="flex justify-between text-[12px] text-t3 mb-1.5">
                      <span className="tabular">{s.used_mb} MB / {s.limit_mb} MB{s.rows != null ? ` · ${s.rows.toLocaleString()} rows` : ''}</span>
                      <span className="tabular font-semibold" style={{ color }}>{s.percent}%</span>
                    </div>
                    <div className="h-2.5 rounded-full surface-inset overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, s.percent)}%`, background: color }} />
                    </div>
                    {s.note && <p className="text-[11px] text-t4 mt-1.5">{s.note}</p>}
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Data & backup */}
      <DataBackup onChanged={() => load()} />

      {/* Live console */}
      <div className="card">
        <div className="flex items-center gap-3 flex-wrap mb-3">
          <h3 className="h3">Live activity</h3>

          {/* kind filter */}
          <div className="flex gap-1 ml-1">
            {[['All', 'all', logs.length], ['HTTP', 'http', counts.http], ['Logs', 'log', counts.log]].map(([label, val, n]) => (
              <button key={val} onClick={() => setKind(val)}
                className={`text-[12px] px-2.5 py-1 rounded-md border ${kind === val ? 'tab-active' : 'tab-inactive'}`}>
                {label} <span className="tabular opacity-70">{n}</span>
              </button>
            ))}
            {counts.err > 0 && (
              <span className="text-[12px] px-2.5 py-1 rounded-md self-center"
                style={{ color: 'var(--err)', background: 'color-mix(in srgb, var(--err) 12%, transparent)' }}>
                {counts.err} error{counts.err > 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* search */}
          <div className="relative ml-auto min-w-[180px]">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-t4" />
            <input className="input pl-8 py-1 text-[12px]" placeholder="Filter…"
              value={query} onChange={e => setQuery(e.target.value)} />
          </div>

          {/* live-tail interval */}
          <div className="flex items-center gap-1">
            {interval_ ? <Play size={13} className="text-ok" /> : <Pause size={13} className="text-t4" />}
            <select className="input py-1 text-[12px] max-w-[78px]" value={interval_}
              onChange={e => setInterval_(Number(e.target.value))}>
              {INTERVALS.map(([l, v]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="text-t4 text-[13px]">{logs.length === 0 ? 'No activity captured yet — interact with the app and it will stream here.' : 'No entries match the current filter.'}</p>
        ) : (
          <div ref={scrollRef} className="surface-inset border border-line rounded-lg max-h-[46vh] overflow-auto font-mono text-[12px]">
            {filtered.map((l) => (
              <div key={l.seq} className="flex items-start gap-2.5 px-3 py-1.5 border-b border-[color:var(--beige-rule)] last:border-0 hover:bg-[color:var(--surface)]">
                <span className="text-t4 tabular flex-shrink-0">{l.time}</span>
                {l.kind === 'http' ? (
                  <>
                    <span className="font-bold flex-shrink-0 w-[52px]" style={{ color: methodColor(l.method) }}>{l.method}</span>
                    <span className="font-bold tabular flex-shrink-0 w-9" style={{ color: statusColor(l.status) }}>{l.status}</span>
                    <span className="text-t2 break-all flex-1">{l.path}</span>
                    <span className="text-t4 tabular flex-shrink-0">{l.ms}ms</span>
                  </>
                ) : (
                  <>
                    <span className="font-semibold flex-shrink-0 w-[52px]" style={{ color: levelColor(l.level) }}>{l.level}</span>
                    <span className="text-t4 flex-shrink-0 truncate max-w-[130px]">{l.logger}</span>
                    <span className="text-t2 break-words flex-1">{l.message}</span>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function DataBackup({ onChanged }) {
  const [downloading, setDownloading] = useState('')
  const [showPurge, setShowPurge] = useState(false)
  const [scope, setScope] = useState('submissions')
  const [confirm, setConfirm] = useState('')
  const [purging, setPurging] = useState(false)

  const download = async (fmt) => {
    setDownloading(fmt)
    try {
      const ext = fmt === 'xlsx' ? 'xlsx' : 'json'
      await downloadFile(`/admin/backup?format=${fmt}`, `codeforge_db_backup.${ext}`)
      toast.success('Database backup downloaded')
    } catch { toast.error('Backup failed') }
    finally { setDownloading('') }
  }

  const downloadFiles = async () => {
    setDownloading('files')
    try {
      await downloadFile('/admin/backup/files', 'codeforge_files.zip')
      toast.success('Files backup downloaded')
    } catch { toast.error('Files backup failed') }
    finally { setDownloading('') }
  }

  const purge = async () => {
    if (confirm !== 'DELETE') return
    setPurging(true)
    try {
      const { data } = await api.post('/admin/purge', { confirm, scope })
      const total = Object.values(data.deleted || {}).reduce((a, b) => a + b, 0)
      toast.success(`Cleared ${total.toLocaleString()} records`)
      setShowPurge(false); setConfirm('')
      onChanged?.()
    } catch (e) { toast.error(e.response?.data?.detail || 'Purge failed') }
    finally { setPurging(false) }
  }

  return (
    <div className="card">
      <h3 className="h3 mb-1">Data &amp; backup</h3>
      <p className="section-sub mb-4">Your two storage areas are backed up separately.</p>

      {/* Database (TiDB) */}
      <div className="rounded-lg border border-line p-3 mb-3">
        <div className="flex items-center gap-2 mb-1">
          <Database size={15} className="text-t3" />
          <span className="text-[13px] font-semibold text-t">Database (TiDB)</span>
          <span className="text-[11px] text-t4">— all records: users, problems, submissions, classes…</span>
        </div>
        <p className="text-[12px] text-t4 mb-2.5">Full export (nothing omitted). Download a backup, then free up space by clearing records — tables and logins are kept.</p>
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-secondary btn-sm" disabled={!!downloading} onClick={() => download('json')}>
            {downloading === 'json' ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} Backup (JSON)
          </button>
          <button className="btn-secondary btn-sm" disabled={!!downloading} onClick={() => download('xlsx')}>
            {downloading === 'xlsx' ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} Backup (Excel)
          </button>
          <button className="btn-sm ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium border"
            style={{ color: 'var(--err)', borderColor: 'color-mix(in srgb, var(--err) 40%, transparent)' }}
            onClick={() => setShowPurge(true)}>
            <Trash2 size={13} /> Free up space
          </button>
        </div>
      </div>

      {/* Files (Render disk) */}
      <div className="rounded-lg border border-line p-3">
        <div className="flex items-center gap-2 mb-1">
          <HardDrive size={15} className="text-t3" />
          <span className="text-[13px] font-semibold text-t">Files (Render disk)</span>
          <span className="text-[11px] text-t4">— uploaded note files (PDF/DOCX)</span>
        </div>
        <p className="text-[12px] text-t4 mb-2.5">These sit on Render's ephemeral disk and are <b>wiped on every redeploy</b> — download a ZIP to keep them safe.</p>
        <button className="btn-secondary btn-sm" disabled={!!downloading} onClick={downloadFiles}>
          {downloading === 'files' ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} Download files (ZIP)
        </button>
      </div>

      <Modal open={showPurge} onClose={() => { setShowPurge(false); setConfirm('') }} title="Free up space" size="md">
        <div className="space-y-4">
          <div className="flex items-start gap-2.5 p-3 rounded-lg" style={{ background: 'color-mix(in srgb, var(--err) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--err) 35%, transparent)' }}>
            <AlertTriangle size={18} style={{ color: 'var(--err)' }} className="flex-shrink-0 mt-0.5" />
            <p className="text-[13px] text-t2">This permanently deletes records. <b>Download a full backup first</b> — it cannot be undone. Table structure and user logins are preserved.</p>
          </div>

          <div className="space-y-2">
            <label className="flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer" style={{ borderColor: scope === 'submissions' ? 'var(--brand-solid)' : 'var(--line)' }}>
              <input type="radio" className="mt-0.5 accent-primary" checked={scope === 'submissions'} onChange={() => setScope('submissions')} />
              <div>
                <p className="text-[13px] font-semibold text-t">Clear submission history <span className="text-t4 font-normal">(recommended)</span></p>
                <p className="text-[12px] text-t4">Deletes all submissions &amp; their results — the fast-growing data. Keeps users, problems, classes, notes, challenges.</p>
              </div>
            </label>
            <label className="flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer" style={{ borderColor: scope === 'all_records' ? 'var(--err)' : 'var(--line)' }}>
              <input type="radio" className="mt-0.5 accent-primary" checked={scope === 'all_records'} onChange={() => setScope('all_records')} />
              <div>
                <p className="text-[13px] font-semibold text-t">Clear ALL records</p>
                <p className="text-[12px] text-t4">Wipes every table <b>except user accounts</b> (so logins still work). You'll lose problems, classes, notes too.</p>
              </div>
            </label>
          </div>

          <div>
            <label className="label">Type <span className="font-mono" style={{ color: 'var(--err)' }}>DELETE</span> to confirm</label>
            <input className="input" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="DELETE" />
          </div>

          <div className="flex gap-2">
            <button className="btn-sm inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium text-white disabled:opacity-50"
              style={{ background: 'var(--err)' }} disabled={confirm !== 'DELETE' || purging} onClick={purge}>
              {purging ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />} Permanently clear records
            </button>
            <button className="btn-secondary btn-sm" onClick={() => { setShowPurge(false); setConfirm('') }}>Cancel</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
