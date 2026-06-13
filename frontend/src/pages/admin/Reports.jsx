import { useEffect, useState } from 'react'
import { Search, Eye, CheckCircle, XCircle, Clock, Code2, Download, Sparkles, MessageSquare } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import toast from 'react-hot-toast'
import api, { downloadFile } from '../../api/client'
import Modal          from '../../components/ui/Modal'
import { PageLoader } from '../../components/ui/LoadingSpinner'
import { StatusBadge, ModeBadge } from '../../components/ui/Badge'

export default function AdminReports() {
  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode]       = useState('')          // '' | 'practice' | 'test'
  const [search, setSearch]   = useState('')
  const [status, setStatus]   = useState('')
  const [detail, setDetail]   = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [studentModal, setStudentModal]   = useState(null)

  const load = () => {
    setLoading(true)
    const params = mode ? `?mode=${mode}` : ''
    api.get(`/reports${params}`).then((r) => setRows(r.data)).finally(() => setLoading(false))
  }
  useEffect(load, [mode])

  const openDetail = async (subId) => {
    setDetailLoading(true)
    const { data } = await api.get(`/reports/${subId}`)
    setDetail(data)
    setDetailLoading(false)
  }

  const statuses = [...new Set(rows.map((r) => r.status))]
  const filtered = rows.filter((r) => {
    const q = search.toLowerCase()
    const matchesSearch =
      r.student_name.toLowerCase().includes(q) ||
      r.problem_title.toLowerCase().includes(q) ||
      r.student_email.toLowerCase().includes(q)
    return matchesSearch && (status === '' || r.status === status)
  })

  const grouped = new Map()
  filtered.forEach(r => {
    const key = r.student_email || r.student_name
    if (!grouped.has(key)) {
      grouped.set(key, {
        student_name: r.student_name,
        student_email: r.student_email,
        latest_submission: r,
        submissions: [r],
        total_score: r.score,
      })
    } else {
      const group = grouped.get(key)
      group.submissions.push(r)
      group.total_score += r.score
      if (new Date(r.submitted_at) > new Date(group.latest_submission.submitted_at)) {
        group.latest_submission = r
      }
    }
  })
  
  const groupedArray = Array.from(grouped.values()).sort((a, b) => 
    new Date(b.latest_submission.submitted_at) - new Date(a.latest_submission.submitted_at)
  )

  if (loading) return <PageLoader />

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="h1">Reports</h1>
        <p className="section-sub mt-0.5">All submission reports across the platform</p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-2">
          {[['All', ''], ['Practice', 'practice'], ['Test', 'test']].map(([label, val]) => (
            <button key={val} onClick={() => setMode(val)}
              className={mode === val ? 'tab-active' : 'tab-inactive'}>{label}</button>
          ))}
        </div>
        <select className="input max-w-[170px]" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <div className="relative flex-1 min-w-0 max-w-xs ml-auto">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-t4" />
          <input className="input pl-8" placeholder="Search by student or problem…"
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button
          className="btn-secondary btn-sm"
          onClick={() => downloadFile(`/reports/export${mode ? `?mode=${mode}` : ''}`, 'codeforge_gradebook.xlsx').catch(() => toast.error('Export failed'))}
        >
          <Download size={13} /> Export Excel
        </button>
      </div>

      {/* Table */}
      <div className="table-container">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="table-header">
                <th className="table-cell">#</th>
                <th className="table-cell">Student</th>
                <th className="table-cell">Recent Problem</th>
                <th className="table-cell">Total Submissions</th>
                <th className="table-cell">Avg Score</th>
                <th className="table-cell">Feedback</th>
                <th className="table-cell">Last Active</th>
                <th className="table-cell">Actions</th>
              </tr>
            </thead>
            <tbody>
              {groupedArray.length === 0 && (
                <tr>
                  <td colSpan={8} className="table-cell text-center py-12 text-t4">
                    No students found.
                  </td>
                </tr>
              )}
              {groupedArray.map((g, i) => (
                <tr key={g.student_email || i} className="table-row">
                  <td className="table-cell text-t4 tabular">{i + 1}</td>
                  <td className="table-cell">
                    <div>
                      <p className="text-t font-medium">{g.student_name}</p>
                      <p className="text-xs text-t4">{g.student_email}</p>
                    </div>
                  </td>
                  <td className="table-cell text-t2 max-w-[180px] truncate">{g.latest_submission.problem_title}</td>
                  <td className="table-cell text-t3 tabular">{g.submissions.length}</td>
                  <td className="table-cell">
                    <span className="tabular" style={{ color: Math.round(g.total_score / g.submissions.length) >= 100 ? 'var(--ok)' : Math.round(g.total_score / g.submissions.length) > 0 ? 'var(--warn)' : 'var(--err)' }}>
                      {Math.round(g.total_score / g.submissions.length)}%
                    </span>
                  </td>
                  <td className="table-cell">
                    {(() => {
                      const n = g.submissions.filter(s => s.feedback_sent).length
                      return n > 0
                        ? <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--brand)' }}>
                            <MessageSquare size={12} /> {n} sent
                          </span>
                        : <span className="text-t4 text-xs">—</span>
                    })()}
                  </td>
                  <td className="table-cell text-t4 text-xs tabular">
                    {formatDistanceToNow(new Date(g.latest_submission.submitted_at), { addSuffix: true })}
                  </td>
                  <td className="table-cell">
                    <button
                      onClick={() => setStudentModal(g)}
                      className="btn-secondary btn-sm"
                    >
                      <Eye size={12} /> View History
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Student History Modal */}
      <Modal open={!!studentModal} onClose={() => setStudentModal(null)} title={`${studentModal?.student_name}'s Submissions`} size="xl">
        {studentModal && (
          <div className="max-h-[60vh] overflow-y-auto table-container">
            <table className="w-full text-left">
              <thead>
                <tr className="table-header sticky top-0 bg-surface-h">
                  <th className="table-cell">Mode</th>
                  <th className="table-cell">Problem</th>
                  <th className="table-cell">Status</th>
                  <th className="table-cell">Score</th>
                  <th className="table-cell">Time</th>
                  <th className="table-cell">Submitted</th>
                  <th className="table-cell">Feedback</th>
                  <th className="table-cell">Report</th>
                </tr>
              </thead>
              <tbody>
                {studentModal.submissions.map((r) => (
                  <tr key={r.submission_id} className="table-row">
                    <td className="table-cell"><ModeBadge mode={r.mode} /></td>
                    <td className="table-cell text-t2 max-w-[150px] truncate">{r.problem_title}</td>
                    <td className="table-cell"><StatusBadge status={r.status} /></td>
                    <td className="table-cell text-t3 tabular">{r.score}%</td>
                    <td className="table-cell text-t3 tabular">{r.time_taken != null ? `${Math.floor(r.time_taken/60)}m ${r.time_taken%60}s` : '—'}</td>
                    <td className="table-cell text-t4 text-xs tabular">{formatDistanceToNow(new Date(r.submitted_at), { addSuffix: true })}</td>
                    <td className="table-cell">
                      {r.feedback_viewed
                        ? <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--ok)' }}><MessageSquare size={12} /> Viewed</span>
                        : r.feedback_sent
                          ? <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--brand)' }}><MessageSquare size={12} /> Sent</span>
                          : <span className="text-t4 text-xs">—</span>}
                    </td>
                    <td className="table-cell">
                      <button onClick={() => openDetail(r.submission_id)} className="btn-secondary btn-sm"><Eye size={12}/> View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      {/* Detail Modal */}
      <Modal
        open={!!detail || detailLoading}
        onClose={() => setDetail(null)}
        title="Submission Report"
        size="lg"
      >
        {detailLoading && <PageLoader />}
        {detail && <ReportDetail report={detail} onSaved={load} />}
      </Modal>
    </div>
  )
}

function ReportDetail({ report: r, onSaved }) {
  const [showCode, setShowCode] = useState(false)
  const [fb, setFb] = useState(r.feedback || '')
  const [savingFb, setSavingFb] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const [sent, setSent] = useState(!!r.feedback_sent)
  const [viewed, setViewed] = useState(!!r.feedback_viewed)
  const saveFb = async () => {
    setSavingFb(true)
    try {
      const { data } = await api.post(`/submissions/${r.submission_id}/feedback`, { feedback: fb })
      setSent(!!data.feedback_sent); setViewed(!!data.feedback_viewed)
      toast.success(data.feedback_sent ? 'Feedback sent to student' : 'Feedback cleared')
      onSaved?.()
    }
    catch { toast.error('Failed to send feedback') }
    finally { setSavingFb(false) }
  }
  const suggestFb = async () => {
    setSuggesting(true)
    try { const { data } = await api.post(`/submissions/${r.submission_id}/feedback/suggest`); setFb(data.suggestion || ''); toast.success('AI draft ready — edit & save') }
    catch (e) { toast.error(e.response?.status === 502 ? 'AI not configured on the server' : 'Could not generate') }
    finally { setSuggesting(false) }
  }
  const passed  = r.test_cases_passed
  const total   = r.test_cases_total
  const pct     = total ? Math.round((passed / total) * 100) : 0

  return (
    <div className="space-y-5">
      {/* Meta */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          ['Student',  r.student_name],
          ['Problem',  r.problem_title],
          ['Mode',     r.mode],
          ['Status',   null, <StatusBadge status={r.status} />],
          ['Score',    `${r.score}%`],
          ['Time',     r.time_taken != null ? `${Math.floor(r.time_taken / 60)}m ${r.time_taken % 60}s` : '—'],
        ].map(([label, val, el]) => (
          <div key={label} className="surface-inset p-3">
            <p className="text-xs text-t4 mb-1">{label}</p>
            {el || <p className="text-sm font-semibold text-t">{val}</p>}
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex justify-between text-xs text-t3 mb-1.5 tabular">
          <span>Test Cases: {passed}/{total} passed</span>
          <span>{pct}%</span>
        </div>
        <div className="h-2 rounded-full bg-surface-h overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${pct}%`,
              background: pct === 100 ? 'var(--ok)' : pct > 50 ? 'var(--warn)' : 'var(--err)',
            }}
          />
        </div>
      </div>

      {r.tab_switches > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-line text-sm"
          style={{ background: 'color-mix(in srgb, var(--warn) 12%, transparent)', color: 'var(--warn)' }}>
          ⚠ Tab switches detected: {r.tab_switches}
        </div>
      )}

      {/* Test case results */}
      {r.results?.length > 0 && (
        <div>
          <p className="label">Test Case Results</p>
          <div className="space-y-2 max-h-56 overflow-y-auto">
            {r.results.map((res, i) => (
              <div key={i} className="flex items-center gap-3 p-2.5 surface-inset">
                {res.status === 'Passed'
                  ? <CheckCircle size={14} className="flex-shrink-0" style={{ color: 'var(--ok)' }} />
                  : <XCircle    size={14} className="flex-shrink-0" style={{ color: 'var(--err)' }} />
                }
                <span className="text-xs text-t3 w-20">Case #{i + 1}</span>
                <StatusBadge status={res.status} />
                {res.execution_time != null && (
                  <span className="text-xs text-t4 ml-auto flex items-center gap-1 tabular">
                    <Clock size={10} />{res.execution_time.toFixed(1)}ms
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Code */}
      {r.code && (
        <div>
          <button onClick={() => setShowCode(!showCode)}
            className="btn-ghost btn-sm flex items-center gap-1">
            <Code2 size={13} /> {showCode ? 'Hide' : 'View'} Code
          </button>
          {showCode && (
            <pre className="mt-2 p-3 rounded-lg surface-inset text-xs text-t2 font-mono overflow-x-auto max-h-64">
              {r.code}
            </pre>
          )}
        </div>
      )}

      {/* Teacher feedback */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="label !mb-0">Feedback to student</p>
          <button onClick={suggestFb} disabled={suggesting} className="btn-ghost btn-sm" style={{ color: 'var(--d-purple)' }}>
            <Sparkles size={13} /> {suggesting ? 'Thinking…' : 'AI suggest'}
          </button>
        </div>
        <textarea className="input resize-none" rows={3} value={fb} onChange={(e) => setFb(e.target.value)}
          placeholder="Write feedback the student will see in their report…" />
        <div className="flex items-center justify-between mt-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium">
            {viewed
              ? <span className="inline-flex items-center gap-1" style={{ color: 'var(--ok)' }}><MessageSquare size={12} /> Viewed by student</span>
              : sent
                ? <span className="inline-flex items-center gap-1" style={{ color: 'var(--brand)' }}><MessageSquare size={12} /> Sent — awaiting student</span>
                : <span className="text-t4">Not sent yet</span>}
          </span>
          <button className="btn-primary btn-sm" onClick={saveFb} disabled={savingFb}>
            {savingFb ? 'Sending…' : sent ? 'Update & resend' : 'Send to student'}
          </button>
        </div>
      </div>
    </div>
  )
}
