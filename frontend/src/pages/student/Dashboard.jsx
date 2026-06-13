import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Code2, CheckCircle, TrendingUp, BookOpen,
  FlaskConical, Clock, ArrowRight,
} from 'lucide-react'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer,
} from 'recharts'
import api from '../../api/client'
import StatCard      from '../../components/ui/StatCard'
import { PageLoader } from '../../components/ui/LoadingSpinner'
import { StatusBadge, ModeBadge } from '../../components/ui/Badge'
import useChartTheme  from '../../hooks/useChartTheme'
import { formatDistanceToNow } from 'date-fns'

const radarData = [
  { skill: 'Arrays',    score: 80 },
  { skill: 'Pointers',  score: 65 },
  { skill: 'Strings',   score: 70 },
  { skill: 'Loops',     score: 90 },
  { skill: 'Functions', score: 75 },
  { skill: 'Structs',   score: 55 },
]

export default function StudentDashboard() {
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)
  const ct = useChartTheme()

  useEffect(() => {
    api.get('/students/dashboard').then((r) => setData(r.data)).finally(() => setLoading(false))
  }, [])

  if (loading) return <PageLoader />
  if (!data) return <p className="text-t3">Failed to load.</p>

  const { stats, recent_submissions, upcoming_tests } = data

  const scoreColor = (n) => (n >= 100 ? 'var(--ok)' : n > 0 ? 'var(--warn)' : 'var(--err)')

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="h1">My Dashboard</h1>
        <p className="section-sub mt-1">Your progress and activity at a glance</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Code2}       label="Total Submissions" value={stats.total_submissions} color="var(--brand)" />
        <StatCard icon={CheckCircle} label="Accepted"          value={stats.accepted}          color="var(--ok)" />
        <StatCard icon={TrendingUp}  label="Average Score"     value={`${stats.avg_score}%`}   color="var(--warn)" />
        <StatCard icon={BookOpen}    label="Notes Available"   value={stats.notes_available}   color="var(--info)" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="h3 mb-4">Skill Distribution</h3>
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={radarData}>
              <PolarGrid stroke={ct.grid} />
              <PolarAngleAxis dataKey="skill" tick={{ fill: ct.axis, fontSize: 11 }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: ct.axis, fontSize: 9 }} />
              <Radar dataKey="score" stroke={ct.brand} fill={ct.brand} fillOpacity={0.2} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="h3 mb-4 flex items-center gap-2">
            <FlaskConical size={15} style={{ color: 'var(--d-purple)' }} /> Upcoming Tests
          </h3>
          {upcoming_tests.length === 0 ? (
            <p className="text-t4 text-[13px]">No upcoming tests.</p>
          ) : (
            <div className="space-y-2">
              {upcoming_tests.map((t) => (
                <div key={t.id} className="flex items-center justify-between p-3 rounded-lg surface-inset">
                  <div>
                    <p className="text-[13px] font-medium text-t">{t.title}</p>
                    {t.start_time && (
                      <p className="text-[12px] text-t4 flex items-center gap-1 mt-0.5 tabular">
                        <Clock size={10} />
                        {formatDistanceToNow(new Date(t.start_time), { addSuffix: true })}
                      </p>
                    )}
                  </div>
                  <Link to={`/code/${t.id}?mode=test`} className="btn-secondary btn-sm">
                    Enter <ArrowRight size={12} />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent submissions */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="h3">Recent Submissions</h3>
          <Link to="/student/reports" className="text-[12px] font-medium text-brand hover:opacity-80">View all →</Link>
        </div>
        {recent_submissions.length === 0 ? (
          <p className="text-t4 text-[13px]">No submissions yet. Start coding.</p>
        ) : (
          <div className="table-container">
            <table className="w-full text-left">
              <thead>
                <tr className="table-header">
                  <th className="table-cell">Problem</th>
                  <th className="table-cell">Mode</th>
                  <th className="table-cell">Status</th>
                  <th className="table-cell">Score</th>
                  <th className="table-cell">When</th>
                </tr>
              </thead>
              <tbody>
                {recent_submissions.map((s) => (
                  <tr key={s.id} className="table-row">
                    <td className="table-cell text-t font-medium">{s.problem_title}</td>
                    <td className="table-cell"><ModeBadge mode={s.mode} /></td>
                    <td className="table-cell"><StatusBadge status={s.status} /></td>
                    <td className="table-cell tabular font-semibold" style={{ color: scoreColor(s.score) }}>
                      {s.score}%
                    </td>
                    <td className="table-cell text-t4 text-[12px] tabular">
                      {formatDistanceToNow(new Date(s.submitted_at), { addSuffix: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
