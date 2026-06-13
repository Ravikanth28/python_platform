import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Code2, ArrowRight, Clock, CheckCircle } from 'lucide-react'
import api from '../../api/client'
import { PageLoader } from '../../components/ui/LoadingSpinner'
import { DifficultyBadge, StatusBadge } from '../../components/ui/Badge'

export default function StudentPractice() {
  const [problems, setProblems]   = useState([])
  const [subs, setSubs]           = useState({})   // problem_id -> latest submission
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [difficulty, setDifficulty] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([
      api.get('/problems?mode=practice'),
      api.get('/submissions'),
    ]).then(([pRes, sRes]) => {
      setProblems(pRes.data)
      // Map problem_id -> latest submission
      const map = {}
      sRes.data.forEach((s) => {
        if (!map[s.problem_id] || new Date(s.submitted_at) > new Date(map[s.problem_id].submitted_at)) {
          map[s.problem_id] = s
        }
      })
      setSubs(map)
    }).finally(() => setLoading(false))
  }, [])

  const filtered = problems.filter((p) => {
    const q = search.toLowerCase()
    return (
      p.title.toLowerCase().includes(q) &&
      (difficulty ? p.difficulty === difficulty : true)
    )
  })

  if (loading) return <PageLoader />

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="h1">Practice</h1>
        <p className="section-sub mt-0.5">Sharpen your Python programming skills</p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-0 max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-t4" />
          <input className="input pl-8" placeholder="Search problems…" value={search}
            onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2">
          {[['All', ''], ['Easy', 'easy'], ['Medium', 'medium'], ['Hard', 'hard']].map(([label, val]) => {
            const n = val ? problems.filter(p => p.difficulty === val).length : problems.length
            return (
              <button key={val} onClick={() => setDifficulty(val)}
                className={difficulty === val ? 'tab-active' : 'tab-inactive'}>{label} <span className="tabular opacity-70">{n}</span></button>
            )
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card text-center py-16">
          <Code2 size={40} className="mx-auto text-t4 mb-3" />
          <p className="text-t3">No practice problems available.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => {
            const sub = subs[p.id]
            return (
              <div key={p.id} className="card-hover flex flex-col">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="h3 line-clamp-2 flex-1 pr-2">{p.title}</h3>
                  {sub && (
                    <StatusBadge status={sub.status} />
                  )}
                </div>
                {p.topics && <p className="text-xs text-t4 mb-2">{p.topics}</p>}
                <div className="flex items-center gap-2 flex-wrap mb-3">
                  <DifficultyBadge level={p.difficulty} />
                  <span className="badge-blue badge">{p.test_cases_count} cases</span>
                  {p.duration && (
                    <span className="badge-cyan badge flex items-center gap-1">
                      <Clock size={10} />{p.duration}m
                    </span>
                  )}
                </div>
                {sub && (
                  <div className="flex items-center gap-1.5 text-xs text-t4 mb-2">
                    {sub.status === 'Accepted'
                      ? <CheckCircle size={12} style={{ color: 'var(--ok)' }} />
                      : <div className="w-3 h-3 rounded-full" style={{ background: 'color-mix(in srgb, var(--warn) 40%, transparent)' }} />
                    }
                    Last score: <span className="font-medium tabular" style={{ color: 'var(--warn)' }}>{sub.score}%</span>
                  </div>
                )}
                <button
                  onClick={() => navigate(`/code/${p.id}`)}
                  className="btn-primary mt-auto justify-center text-sm"
                >
                  {sub ? 'Retry' : 'Solve'} <ArrowRight size={14} />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
