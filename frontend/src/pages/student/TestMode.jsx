import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FlaskConical, Clock, ArrowRight, Lock, ShieldCheck } from 'lucide-react'
import { format, isPast, isFuture } from 'date-fns'
import api from '../../api/client'
import { PageLoader } from '../../components/ui/LoadingSpinner'
import { DifficultyBadge, StatusBadge } from '../../components/ui/Badge'
import CountBar, { diffStats } from '../../components/ui/CountBar'

function TestStatusBadge({ problem }) {
  const now = new Date()
  if (problem.start_time && isFuture(new Date(problem.start_time)))
    return <span className="badge-yellow badge">Upcoming</span>
  if (problem.end_time && isPast(new Date(problem.end_time)))
    return <span className="badge-violet badge">Ended</span>
  return <span className="badge-green badge">Active</span>
}

export default function StudentTestMode() {
  const [problems, setProblems] = useState([])
  const [subs, setSubs]         = useState({})
  const [loading, setLoading]   = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([
      api.get('/problems?mode=test'),
      api.get('/submissions'),
    ]).then(([pRes, sRes]) => {
      setProblems(pRes.data)
      const map = {}
      sRes.data.forEach((s) => {
        if (!map[s.problem_id] || new Date(s.submitted_at) > new Date(map[s.problem_id].submitted_at))
          map[s.problem_id] = s
      })
      setSubs(map)
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return <PageLoader />

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="h1">Tests</h1>
        <p className="section-sub mt-0.5">Proctored assessments assigned to you</p>
      </div>

      {/* Proctoring notice */}
      <div className="flex items-start gap-3 p-4 rounded-xl border border-line" style={{ background: 'var(--brandGhost)' }}>
        <ShieldCheck size={18} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--d-purple)' }} />
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--d-purple)' }}>Proctored Environment</p>
          <p className="text-xs text-t3 mt-0.5">
            Tests may enforce full-screen mode, disable copy-paste, detect tab switches,
            and block developer tools depending on test settings.
          </p>
        </div>
      </div>

      {problems.length > 0 && (
        <CountBar stats={[{ label: 'Total', count: problems.length }, ...diffStats(problems)]} />
      )}

      {problems.length === 0 ? (
        <div className="card text-center py-16">
          <FlaskConical size={40} className="mx-auto text-t4 mb-3" />
          <p className="text-t3">No tests available.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {problems.map((p) => {
            const sub  = subs[p.id]
            const canEnter = !p.end_time || !isPast(new Date(p.end_time))
            const alreadyDone = sub?.status === 'Accepted'

            return (
              <div key={p.id} className="card-hover flex flex-col">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="h3 line-clamp-2 flex-1 pr-2">{p.title}</h3>
                  <TestStatusBadge problem={p} />
                </div>

                <div className="flex flex-wrap gap-1.5 mb-3">
                  <DifficultyBadge level={p.difficulty} />
                  {p.duration && <span className="badge-cyan badge flex items-center gap-1"><Clock size={10} />{p.duration}m</span>}
                  {p.fullscreen_required && <span className="badge-violet badge">🔒 Fullscreen</span>}
                  {p.tab_switch_detect   && <span className="badge-yellow badge">⚠ Tab Monitor</span>}
                  {p.copy_paste_disable  && <span className="badge-yellow badge">No Copy-Paste</span>}
                </div>

                {p.start_time && (
                  <p className="text-xs text-t4 mb-1 tabular">
                    Starts: {format(new Date(p.start_time), 'MMM d, HH:mm')}
                  </p>
                )}
                {p.end_time && (
                  <p className="text-xs text-t4 mb-2 tabular">
                    Ends: {format(new Date(p.end_time), 'MMM d, HH:mm')}
                  </p>
                )}

                {sub && (
                  <div className="mb-2">
                    <StatusBadge status={sub.status} />
                    <span className="text-xs text-t4 ml-2 tabular">Score: {sub.score}%</span>
                  </div>
                )}

                <button
                  onClick={() => canEnter && navigate(`/code/${p.id}?mode=test`)}
                  disabled={!canEnter}
                  className={`mt-auto justify-center text-sm ${canEnter ? 'btn-primary' : 'btn-secondary opacity-50 cursor-not-allowed'}`}
                >
                  {!canEnter ? <><Lock size={13} /> Closed</> : alreadyDone ? <>Retry <ArrowRight size={13} /></> : <>Enter Test <ArrowRight size={13} /></>}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
