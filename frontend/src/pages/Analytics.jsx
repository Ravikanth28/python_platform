import { useEffect, useState } from 'react'
import {
  Users, ClipboardList, CheckCircle2, Clock, AlertTriangle, Target, TrendingUp, Search,
} from 'lucide-react'
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import StatCard from '../components/ui/StatCard'
import LoadingSpinner, { PageLoader } from '../components/ui/LoadingSpinner'
import Modal from '../components/ui/Modal'
import useChartTheme from '../hooks/useChartTheme'

const fmtTime = (s) => (!s ? '—' : s >= 60 ? `${Math.floor(s / 60)}m ${Math.round(s % 60)}s` : `${Math.round(s)}s`)

const RANGES = [['1h', '1h'], ['24h', '24h'], ['7d', '7d'], ['14d', '14d'], ['all', 'All']]

// Reusable compact table search box
function TableSearch({ value, onChange, placeholder }) {
  return (
    <div className="relative w-full max-w-[220px]">
      <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-t4" />
      <input className="input pl-8 py-1.5 text-[12px]" placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} />
    </div>
  )
}

// Range-aware activity chart (1h / 24h / 7d / 14d / All)
function ProgressChart({ endpoint, title }) {
  const [range, setRange] = useState('14d')
  const [data, setData] = useState(null)
  const ct = useChartTheme()
  const gid = 'g' + endpoint.replace(/[^a-z]/gi, '')
  useEffect(() => {
    let alive = true
    setData(null)
    api.get(`${endpoint}?range=${range}`).then(r => { if (alive) setData(r.data.progress || []) }).catch(() => { if (alive) setData([]) })
    return () => { alive = false }
  }, [endpoint, range])

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="h3">{title}</h3>
        <div className="flex items-center gap-0.5 surface-inset border border-line rounded-lg p-0.5">
          {RANGES.map(([v, l]) => (
            <button key={v} onClick={() => setRange(v)}
              className="px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors"
              style={range === v ? { background: 'var(--brand)', color: '#fff' } : { color: 'var(--t3)' }}>
              {l}
            </button>
          ))}
        </div>
      </div>
      {data === null ? (
        <div className="h-[200px] flex items-center justify-center"><LoadingSpinner size="sm" /></div>
      ) : data.length === 0 ? (
        <div className="h-[200px] flex items-center justify-center text-t4 text-[13px]">No activity in this range.</div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={ct.brand} stopOpacity={0.28} /><stop offset="95%" stopColor={ct.brand} stopOpacity={0} /></linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
            <XAxis dataKey="date" tick={{ fill: ct.axis, fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={20} />
            <YAxis tick={{ fill: ct.axis, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip {...ct.tooltip} />
            <Area type="monotone" dataKey="submissions" stroke={ct.brand} strokeWidth={2} fill={`url(#${gid})`} name="Submissions" />
            <Area type="monotone" dataKey="accepted" stroke={ct.ok} strokeWidth={2} fillOpacity={0} name="Accepted" />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

export default function Analytics() {
  const { user } = useAuth()
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="h1">Analytics</h1>
        <p className="section-sub mt-1">
          {user?.role === 'admin'
            ? 'Per-problem performance, hardest test cases, and who needs help.'
            : 'Your skill breakdown, weak topics, and progress over time.'}
        </p>
      </div>
      {user?.role === 'admin' ? <AdminAnalytics /> : <StudentAnalytics />}
    </div>
  )
}

// ─────────────────────────── Admin ─────────────────────────────────────────

function AdminAnalytics() {
  const [data, setData] = useState(null)
  const [roster, setRoster] = useState([])
  const [pick, setPick] = useState(null)        // { id, name }
  const [studentData, setStudentData] = useState(null)
  const [probSearch, setProbSearch] = useState('')
  const [rosterSearch, setRosterSearch] = useState('')
  const ct = useChartTheme()
  useEffect(() => {
    api.get('/analytics/admin').then(r => setData(r.data)).catch(() => setData(null))
    api.get('/analytics/admin/students').then(r => setRoster(r.data)).catch(() => {})
  }, [])

  const openStudent = async (s) => {
    setPick(s); setStudentData(null)
    try { const { data } = await api.get(`/analytics/admin/student/${s.id}`); setStudentData(data) }
    catch { setStudentData(null) }
  }

  if (!data) return <PageLoader />
  const { stats, per_problem, hardest_tests, stuck_students } = data

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Students" value={stats.students} color="var(--brand)" />
        <StatCard icon={ClipboardList} label="Submissions" value={stats.submissions} color="var(--info)" />
        <StatCard icon={CheckCircle2} label="Acceptance" value={`${stats.acceptance}%`} color="var(--ok)" />
        <StatCard icon={Clock} label="Avg time / attempt" value={fmtTime(stats.avg_time_sec)} color="var(--warn)" />
      </div>

      <ProgressChart endpoint="/analytics/admin/progress" title="Submissions over time" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Hardest test cases */}
        <div className="card">
          <h3 className="h3 mb-3 flex items-center gap-2"><Target size={16} style={{ color: 'var(--err)' }} /> Hardest test cases</h3>
          {hardest_tests.length === 0 ? <p className="text-t4 text-[13px]">No failures recorded yet.</p> : (
            <div className="space-y-1.5">
              {hardest_tests.map((t, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg surface-inset border border-line px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] text-t font-medium truncate">{t.problem}</p>
                    <p className="text-[11px] text-t4">{t.case}</p>
                  </div>
                  <span className="text-[12px] font-semibold tabular" style={{ color: 'var(--err)' }}>{t.students_failed} failed</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Who's stuck */}
        <div className="card">
          <h3 className="h3 mb-3 flex items-center gap-2"><AlertTriangle size={16} style={{ color: 'var(--warn)' }} /> Who needs help</h3>
          {stuck_students.length === 0 ? <p className="text-t4 text-[13px]">Everyone's doing fine — no one is stuck.</p> : (
            <div className="space-y-1.5">
              {stuck_students.map(s => (
                <div key={s.id} className="flex items-center gap-3 rounded-lg surface-inset border border-line px-3 py-2">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-semibold font-serif flex-shrink-0" style={{ background: s.avatar_color || 'var(--brand-solid)' }}>{(s.name || '?')[0].toUpperCase()}</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] text-t font-medium truncate">{s.name}</p>
                    <p className="text-[11px] text-t4 tabular">{s.attempts} attempts · {s.solved} solved</p>
                  </div>
                  <span className="text-[12px] font-semibold tabular" style={{ color: 'var(--err)' }}>{s.acceptance}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Per-problem deep table */}
      <div className="card">
        <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
          <h3 className="h3">Per-problem performance</h3>
          <TableSearch value={probSearch} onChange={setProbSearch} placeholder="Filter problems…" />
        </div>
        {per_problem.length === 0 ? <p className="text-t4 text-[13px]">No submissions yet.</p> : (
          <div className="table-container">
            <table className="w-full text-left">
              <thead><tr className="table-header">
                <th className="table-cell">Problem</th><th className="table-cell">Students</th>
                <th className="table-cell">Attempts</th><th className="table-cell">Avg tries</th>
                <th className="table-cell">Acceptance</th><th className="table-cell">Avg score</th>
                <th className="table-cell">Avg time</th>
              </tr></thead>
              <tbody>
                {per_problem.filter(p => p.title.toLowerCase().includes(probSearch.toLowerCase())).map(p => (
                  <tr key={p.id} className="table-row">
                    <td className="table-cell text-t font-medium">{p.title}</td>
                    <td className="table-cell tabular">{p.students}</td>
                    <td className="table-cell tabular">{p.attempts}</td>
                    <td className="table-cell tabular">{p.avg_attempts}</td>
                    <td className="table-cell tabular" style={{ color: p.acceptance >= 60 ? 'var(--ok)' : p.acceptance > 0 ? 'var(--warn)' : 'var(--err)' }}>{p.acceptance}%</td>
                    <td className="table-cell tabular">{p.avg_score}%</td>
                    <td className="table-cell tabular">{fmtTime(p.avg_time_sec)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Students roster — click for full per-student analytics */}
      <div className="card">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="h3 flex items-center gap-2"><Users size={16} className="text-brand" /> Students</h3>
          <TableSearch value={rosterSearch} onChange={setRosterSearch} placeholder="Filter students…" />
        </div>
        <p className="text-[12px] text-t4 mb-3 mt-1">Lowest acceptance first — click a student to see their full skill breakdown &amp; weak topics.</p>
        {roster.length === 0 ? <p className="text-t4 text-[13px]">No students yet.</p> : (
          <div className="table-container">
            <table className="w-full text-left">
              <thead><tr className="table-header">
                <th className="table-cell">Student</th><th className="table-cell">Submissions</th>
                <th className="table-cell">Solved</th><th className="table-cell">Acceptance</th><th className="table-cell"></th>
              </tr></thead>
              <tbody>
                {roster.filter(s => `${s.name} ${s.email}`.toLowerCase().includes(rosterSearch.toLowerCase())).map(s => (
                  <tr key={s.id} className="table-row cursor-pointer" onClick={() => openStudent(s)}>
                    <td className="table-cell">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-semibold font-serif flex-shrink-0" style={{ background: s.avatar_color || 'var(--brand-solid)' }}>{(s.name || '?')[0].toUpperCase()}</div>
                        <div className="min-w-0"><p className="text-t font-medium truncate">{s.name}</p><p className="text-[11px] text-t4 truncate">{s.email}</p></div>
                      </div>
                    </td>
                    <td className="table-cell tabular">{s.submissions}</td>
                    <td className="table-cell tabular">{s.solved}/{s.attempted}</td>
                    <td className="table-cell tabular" style={{ color: s.submissions === 0 ? 'var(--t4)' : s.acceptance >= 60 ? 'var(--ok)' : s.acceptance > 0 ? 'var(--warn)' : 'var(--err)' }}>{s.submissions === 0 ? '—' : `${s.acceptance}%`}</td>
                    <td className="table-cell text-right"><span className="text-brand text-[12px] font-medium">View →</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pick && (
        <Modal open onClose={() => setPick(null)} title={`${pick.name} · analytics`} size="xl">
          {studentData
            ? <StudentAnalyticsView data={studentData} progressNode={<MiniProgress rows={studentData.progress} />} />
            : <div className="py-10"><LoadingSpinner text="Loading student…" /></div>}
        </Modal>
      )}
    </div>
  )
}

// ─────────────────────────── Student ───────────────────────────────────────

function MiniProgress({ rows }) {
  const ct = useChartTheme()
  if (!rows || rows.length === 0) return null
  return (
    <div className="card">
      <h3 className="h3 mb-4">Activity (last 14 days)</h3>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={rows} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
          <defs><linearGradient id="miniProg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={ct.brand} stopOpacity={0.28} /><stop offset="95%" stopColor={ct.brand} stopOpacity={0} /></linearGradient></defs>
          <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
          <XAxis dataKey="date" tick={{ fill: ct.axis, fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={20} />
          <YAxis tick={{ fill: ct.axis, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip {...ct.tooltip} />
          <Area type="monotone" dataKey="submissions" stroke={ct.brand} strokeWidth={2} fill="url(#miniProg)" name="Submissions" />
          <Area type="monotone" dataKey="accepted" stroke={ct.ok} strokeWidth={2} fillOpacity={0} name="Accepted" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

function StudentAnalyticsView({ data, progressNode }) {
  const ct = useChartTheme()
  const [topicSearch, setTopicSearch] = useState('')
  const { stats, by_topic, weak_topics, by_status, by_difficulty } = data
  const statusColors = { Accepted: ct.ok, 'Wrong Answer': ct.err, 'Time Limit Exceeded': ct.warn, 'Runtime Error': ct.err, 'Compilation Error': ct.series[4], Pending: ct.axis }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={ClipboardList} label="Submissions" value={stats.submissions} color="var(--brand)" />
        <StatCard icon={CheckCircle2} label="Accepted" value={stats.accepted} color="var(--ok)" />
        <StatCard icon={TrendingUp} label="Avg score" value={`${stats.avg_score}%`} color="var(--warn)" />
        <StatCard icon={Target} label="Solved" value={`${stats.solved}/${stats.attempted}`} color="var(--info)" />
      </div>

      {weak_topics.length > 0 && (
        <div className="card">
          <h3 className="h3 mb-3 flex items-center gap-2"><AlertTriangle size={16} style={{ color: 'var(--warn)' }} /> Focus areas</h3>
          <div className="flex flex-wrap gap-2">
            {weak_topics.map(t => (
              <span key={t.topic} className="badge-yellow">{t.topic} · {t.acceptance}%</span>
            ))}
          </div>
          <p className="text-[12px] text-t4 mt-2">Lowest solve-rate topics — worth revisiting.</p>
        </div>
      )}

      {progressNode}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="h3 mb-4">Submissions by status</h3>
          {by_status.length === 0 ? <p className="text-t4 text-[13px]">No submissions yet.</p> : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={by_status} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value" nameKey="name">
                  {by_status.map((s, i) => <Cell key={i} fill={statusColors[s.name] || ct.series[i % ct.series.length]} />)}
                </Pie>
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: ct.text }} />
                <Tooltip {...ct.tooltip} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card">
          <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
            <h3 className="h3">By topic</h3>
            {by_topic.length > 0 && <TableSearch value={topicSearch} onChange={setTopicSearch} placeholder="Filter topics…" />}
          </div>
          {by_topic.length === 0 ? <p className="text-t4 text-[13px]">No data yet.</p> : (
            <div className="table-container">
              <table className="w-full text-left">
                <thead><tr className="table-header">
                  <th className="table-cell">Topic</th><th className="table-cell">Solved</th>
                  <th className="table-cell">Attempted</th><th className="table-cell">Rate</th>
                </tr></thead>
                <tbody>
                  {by_topic.filter(t => t.topic.toLowerCase().includes(topicSearch.toLowerCase())).map(t => (
                    <tr key={t.topic} className="table-row">
                      <td className="table-cell text-t font-medium">{t.topic}</td>
                      <td className="table-cell tabular">{t.solved}</td>
                      <td className="table-cell tabular">{t.attempted}</td>
                      <td className="table-cell tabular" style={{ color: t.acceptance >= 60 ? 'var(--ok)' : t.acceptance > 0 ? 'var(--warn)' : 'var(--err)' }}>{t.acceptance}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h3 className="h3 mb-4">Solved by difficulty</h3>
        {by_difficulty.length === 0 ? <p className="text-t4 text-[13px]">No data yet.</p> : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={by_difficulty} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
              <XAxis dataKey="difficulty" tick={{ fill: ct.axis, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: ct.axis, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip {...ct.tooltip} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: ct.text }} />
              <Bar dataKey="attempted" fill={ct.axis} radius={[4, 4, 0, 0]} name="Attempted" />
              <Bar dataKey="solved" fill={ct.ok} radius={[4, 4, 0, 0]} name="Solved" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

function StudentAnalytics() {
  const [data, setData] = useState(null)
  useEffect(() => { api.get('/analytics/student').then(r => setData(r.data)).catch(() => setData(null)) }, [])
  if (!data) return <PageLoader />
  return <StudentAnalyticsView data={data} progressNode={<ProgressChart endpoint="/analytics/student/progress" title="Your activity over time" />} />
}
