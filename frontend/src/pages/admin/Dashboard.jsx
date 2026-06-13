import { useEffect, useState } from 'react'
import {
  Users, FileText, Code2, FlaskConical,
  CheckCircle, TrendingUp, Activity, Clock, AlertTriangle, Database, HardDrive,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts'
import api from '../../api/client'
import StatCard      from '../../components/ui/StatCard'
import { PageLoader } from '../../components/ui/LoadingSpinner'
import { StatusBadge } from '../../components/ui/Badge'
import useChartTheme  from '../../hooks/useChartTheme'
import { formatDistanceToNow } from 'date-fns'

const mockActivity = [
  { day: 'Mon', submissions: 12, students: 5 },
  { day: 'Tue', submissions: 18, students: 8 },
  { day: 'Wed', submissions: 9,  students: 4 },
  { day: 'Thu', submissions: 25, students: 11 },
  { day: 'Fri', submissions: 31, students: 15 },
  { day: 'Sat', submissions: 14, students: 7 },
  { day: 'Sun', submissions: 8,  students: 3 },
]

export default function AdminDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const ct = useChartTheme()

  useEffect(() => {
    api.get('/admin/dashboard').then((r) => setData(r.data)).finally(() => setLoading(false))
  }, [])

  if (loading) return <PageLoader />
  if (!data)   return <p className="text-t3">Failed to load dashboard.</p>

  const { stats, recent_submissions, students } = data
  const storage = data.storage || []
  const storageAlerts = storage.filter((s) => s.warn)

  const pieData = [
    { name: 'Accepted', value: stats.accepted_submissions },
    { name: 'Other',    value: Math.max(0, stats.total_submissions - stats.accepted_submissions) },
  ]
  const pieColors = [ct.ok, ct.axis]

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="h1">Dashboard</h1>
          <p className="section-sub mt-1">Platform overview and analytics</p>
        </div>
        {/* Storage usage chips (always visible) */}
        {storage.length > 0 && (
          <div className="flex items-center gap-2">
            {storage.map((s) => {
              const Icon = s.kind === 'db' ? Database : HardDrive
              const over = s.warn   // only the DB can warn; disk is informational
              const color = over ? 'var(--err)' : 'var(--t3)'
              const value = s.error ? '—' : (s.limit_mb == null ? `${s.used_mb} MB` : `${s.percent}%`)
              return (
                <Link key={s.name} to="../system"
                  title={s.error ? s.error : `${s.used_mb} / ${s.limit_mb} MB`}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[12px]"
                  style={{ borderColor: over ? 'color-mix(in srgb, var(--err) 40%, transparent)' : 'var(--line)', background: over ? 'color-mix(in srgb, var(--err) 10%, transparent)' : 'transparent' }}>
                  <Icon size={13} style={{ color }} />
                  <span className="text-t3">{s.kind === 'db' ? 'TiDB' : 'Disk'}</span>
                  <span className="tabular font-semibold" style={{ color }}>{value}</span>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {/* Storage warning badge — shows when any store crosses 90% */}
      {storageAlerts.length > 0 && (
        <div className="flex items-start gap-3 p-3.5 rounded-xl border"
          style={{ borderColor: 'color-mix(in srgb, var(--err) 40%, transparent)', background: 'color-mix(in srgb, var(--err) 10%, transparent)' }}>
          <AlertTriangle size={18} style={{ color: 'var(--err)' }} className="flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold" style={{ color: 'var(--err)' }}>Storage almost full</p>
            <p className="text-[12.5px] text-t2 mt-0.5">
              {storageAlerts.map((s) => `${s.name} is at ${s.percent}% (${s.used_mb}/${s.limit_mb} MB)`).join(' · ')}.
              {' '}Free up space or upgrade soon to avoid write failures.
            </p>
          </div>
          <Link to="../system" className="btn-secondary btn-sm flex-shrink-0">View System</Link>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users}        label="Total Students"    value={stats.total_students}   color="var(--brand)" />
        <StatCard icon={FileText}     label="Notes Uploaded"    value={stats.total_notes}      color="var(--info)" />
        <StatCard icon={Code2}        label="Practice Sets"     value={stats.total_practice}   color="var(--ok)" />
        <StatCard icon={FlaskConical} label="Tests Created"     value={stats.total_tests}      color="var(--d-purple)" />
        <StatCard icon={Activity}     label="Total Submissions" value={stats.total_submissions} color="var(--warn)" />
        <StatCard icon={CheckCircle}  label="Accepted"          value={stats.accepted_submissions} color="var(--ok)" />
        <StatCard
          icon={TrendingUp}
          label="Acceptance Rate"
          value={stats.total_submissions ? `${Math.round((stats.accepted_submissions / stats.total_submissions) * 100)}%` : '0%'}
          color="var(--info)"
        />
        <StatCard icon={Users} label="Admins" value={stats.total_admins} color="var(--err)" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card lg:col-span-2">
          <h3 className="h3 mb-4">Weekly Activity</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={mockActivity} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
              <defs>
                <linearGradient id="gradSub" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={ct.brand} stopOpacity={0.28} />
                  <stop offset="95%" stopColor={ct.brand} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradStu" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={ct.ok} stopOpacity={0.28} />
                  <stop offset="95%" stopColor={ct.ok} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
              <XAxis dataKey="day" tick={{ fill: ct.axis, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: ct.axis, fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip {...ct.tooltip} />
              <Area type="monotone" dataKey="submissions" stroke={ct.brand} strokeWidth={2} fill="url(#gradSub)" name="Submissions" />
              <Area type="monotone" dataKey="students"    stroke={ct.ok}    strokeWidth={2} fill="url(#gradStu)" name="Active Students" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card flex flex-col">
          <h3 className="h3 mb-4">Submission Status</h3>
          <div className="flex-1 flex items-center justify-center">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={4} dataKey="value">
                  {pieData.map((_, i) => <Cell key={i} fill={pieColors[i]} />)}
                </Pie>
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: ct.text }} />
                <Tooltip {...ct.tooltip} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="h3 mb-4">Recent Submissions</h3>
          {recent_submissions.length === 0 ? (
            <p className="text-t4 text-[13px]">No submissions yet.</p>
          ) : (
            <div className="space-y-1">
              {recent_submissions.map((s) => (
                <div key={s.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-surface-h transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-t truncate">{s.problem}</p>
                    <p className="text-[12px] text-t4">{s.student}</p>
                  </div>
                  <StatusBadge status={s.status} />
                  <span className="text-[12px] text-t4 hidden sm:block tabular">
                    {formatDistanceToNow(new Date(s.submitted_at), { addSuffix: true })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h3 className="h3 mb-4">Recent Students</h3>
          {students.length === 0 ? (
            <p className="text-t4 text-[13px]">No students registered yet.</p>
          ) : (
            <div className="space-y-1">
              {students.slice(0, 5).map((s) => (
                <div key={s.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-surface-h transition-colors">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold font-serif flex-shrink-0"
                    style={{ background: s.avatar_color || 'var(--brand-solid)' }}
                  >
                    {(s.full_name || s.username || '?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-t truncate">{s.full_name || s.username}</p>
                    <p className="text-[12px] text-t4 truncate">{s.email}</p>
                  </div>
                  <div className="flex items-center gap-1 text-[12px] text-t4 tabular">
                    <Clock size={11} />
                    {formatDistanceToNow(new Date(s.created_at), { addSuffix: true })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
