import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Plus, Trash2, Users, GraduationCap, ClipboardList, BarChart3,
  CalendarClock, CheckCircle2, Circle, ArrowRight, BookOpen, ChevronDown, Search,
  Copy, RefreshCw, KeyRound, Sparkles, Loader2,
} from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { formatDistanceToNow, format } from 'date-fns'
import ScheduleControl from './../components/ui/ScheduleControl'
import toast from 'react-hot-toast'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import Modal from '../components/ui/Modal'
import StatCard from '../components/ui/StatCard'
import LoadingSpinner, { PageLoader } from '../components/ui/LoadingSpinner'
import { DifficultyBadge } from '../components/ui/Badge'
import useChartTheme from '../hooks/useChartTheme'

export default function Classroom() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const [tab, setTab] = useState('assignments')

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="h1">Classroom</h1>
        <p className="section-sub mt-1">
          {isAdmin ? 'Create classes, assign problem sets, and track progress.' : 'Your assignments and learning analytics.'}
        </p>
      </div>

      {/* sub-tabs */}
      <div className="flex items-center gap-1.5 border-b border-line pb-px">
        <button onClick={() => setTab('assignments')} className={tab === 'assignments' ? 'tab-active' : 'tab-inactive'}>
          <ClipboardList size={14} className="inline mr-1.5 -mt-0.5" />
          {isAdmin ? 'Assignments' : 'My Assignments'}
        </button>
        <button onClick={() => setTab('analytics')} className={tab === 'analytics' ? 'tab-active' : 'tab-inactive'}>
          <BarChart3 size={14} className="inline mr-1.5 -mt-0.5" />
          Analytics
        </button>
      </div>

      {tab === 'assignments'
        ? (isAdmin ? <AdminAssignments /> : <StudentAssignments />)
        : (isAdmin ? <AdminAnalytics /> : <StudentAnalytics />)}
    </div>
  )
}

// ─────────────────────────── Admin · Assignments ───────────────────────────

function AdminAssignments() {
  const [classes, setClasses] = useState(null)
  const [assignments, setAssignments] = useState(null)
  const [students, setStudents] = useState([])
  const [problems, setProblems] = useState([])
  const [showClass, setShowClass] = useState(false)
  const [showAssign, setShowAssign] = useState(false)
  const [selected, setSelected] = useState(null)
  const [classSearch, setClassSearch] = useState('')
  const [drill, setDrill] = useState(null)        // assignment being inspected
  const [drillData, setDrillData] = useState(null)
  const [genning, setGenning] = useState(false)
  const [sched, setSched] = useState({ frequency: 'off', hour: 9, dow: 0 })

  const openDrill = async (a) => {
    setDrill(a); setDrillData(null)
    load()   // refresh class member counts too (picks up recent self-enrolments)
    try { const { data } = await api.get(`/classroom/assignments/${a.id}/progress`); setDrillData(data) }
    catch { setDrillData({ error: true }) }
  }

  const load = () => {
    api.get('/classroom/classes').then(r => {
      setClasses(r.data)
      setSelected(prev => (prev && r.data.some(c => c.id === prev) ? prev : (r.data[0]?.id ?? null)))
    }).catch(() => setClasses([]))
    api.get('/classroom/assignments').then(r => setAssignments(r.data)).catch(() => setAssignments([]))
  }
  useEffect(() => {
    load()
    api.get('/classroom/students').then(r => setStudents(r.data)).catch(() => {})
    api.get('/classroom/problems').then(r => setProblems(r.data)).catch(() => {})
    api.get('/classroom/assignments/schedule')
      .then(r => setSched({ frequency: r.data.frequency || 'off', hour: r.data.hour ?? 9, dow: r.data.dow ?? 0, last_run: r.data.last_run, last_result: r.data.last_result }))
      .catch(() => {})
  }, [])

  const deleteClass = async (id) => {
    if (!confirm('Delete this class and its assignments?')) return
    await api.delete(`/classroom/classes/${id}`); toast.success('Class deleted'); load()
  }
  const deleteAssign = async (id) => {
    if (!confirm('Delete this assignment?')) return
    await api.delete(`/classroom/assignments/${id}`); toast.success('Assignment deleted'); load()
  }
  const genAssignment = async () => {
    if (!selected) return
    setGenning(true)
    try {
      const { data } = await api.post('/classroom/assignments/generate', { class_id: selected })
      toast.success(`AI added assignment: ${data.title}`)
      load()
    } catch (e) { toast.error(e.response?.data?.detail || 'Generation failed — try again') }
    finally { setGenning(false) }
  }
  const changeSched = async (next) => {
    setSched(s => ({ ...s, ...next }))
    try {
      await api.post('/classroom/assignments/schedule', { ...next, class_id: selected })
      toast.success(next.frequency === 'off' ? 'Auto-add off' : `Auto-add: ${next.frequency}`)
    } catch (e) { toast.error(e.response?.data?.detail || 'Could not save schedule') }
  }
  const seedDemo = async () => {
    try {
      const { data } = await api.post('/classroom/seed-demo')
      toast.success(data.created ? 'Sample class + assignments created' : 'Classes already exist')
      load()
    } catch { toast.error('Failed to create sample data') }
  }
  const regenCode = async (id) => {
    try { await api.post(`/classroom/classes/${id}/regenerate-code`); toast.success('New invite code generated'); load() }
    catch { toast.error('Failed to regenerate code') }
  }
  const copyText = (t) => { navigator.clipboard.writeText(t || ''); toast.success('Copied') }

  if (classes === null || assignments === null) return <PageLoader />

  const filteredClasses = classes.filter(c => c.name.toLowerCase().includes(classSearch.toLowerCase()))
  const selectedClass = classes.find(c => c.id === selected) || null
  const classAssignments = assignments.filter(a => a.class_id === selected)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Classes list (selectable) */}
      <div className="card lg:col-span-1 flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h3 className="h3">Classes</h3>
          <div className="flex items-center gap-1.5">
            <button className="btn-secondary btn-sm" onClick={load} title="Refresh — pick up students who just joined"><RefreshCw size={13} /></button>
            <button className="btn-secondary btn-sm" onClick={() => setShowClass(true)}><Plus size={13} /> New</button>
          </div>
        </div>
        {classes.length === 0 ? (
          <div className="text-[13px] text-t4 space-y-3">
            <p>No classes yet. Create one to start assigning work, or load a sample to explore.</p>
            <button className="btn-secondary btn-sm" onClick={seedDemo}><GraduationCap size={13} /> Create sample class</button>
          </div>
        ) : (
          <>
            {classes.length > 6 && (
              <input className="input mb-2" placeholder="Search classes…" value={classSearch} onChange={e => setClassSearch(e.target.value)} />
            )}
            <div className="space-y-1.5 overflow-y-auto max-h-[62vh] pr-1">
              {filteredClasses.map(c => {
                const active = c.id === selected
                return (
                  <div
                    key={c.id}
                    onClick={() => setSelected(c.id)}
                    className="w-full rounded-lg border px-3 py-2.5 cursor-pointer transition-colors"
                    style={active ? { borderColor: 'var(--brand)', background: 'var(--brandL)' } : { borderColor: 'var(--b)', background: 'var(--beige-pill)' }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold truncate" style={{ color: active ? 'var(--brand)' : 'var(--t)' }}>{c.name}</p>
                        <div className="flex items-center gap-3 mt-1 text-[11px] text-t4 tabular">
                          <span className="inline-flex items-center gap-1"><Users size={11} /> {c.member_count}</span>
                          <span className="inline-flex items-center gap-1"><ClipboardList size={11} /> {c.assignment_count}</span>
                        </div>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); deleteClass(c.id) }} className="text-t4 hover:text-[color:var(--err)] transition-colors flex-shrink-0"><Trash2 size={13} /></button>
                    </div>
                  </div>
                )
              })}
              {filteredClasses.length === 0 && <p className="text-t4 text-[12px] px-1 py-2">No classes match "{classSearch}".</p>}
            </div>
          </>
        )}
      </div>

      {/* Assignments for the selected class */}
      <div className="card lg:col-span-2 flex flex-col">
        <div className="flex items-center justify-between mb-4 gap-2">
          <div className="min-w-0">
            <h3 className="h3 truncate">{selectedClass ? selectedClass.name : 'Assignments'}</h3>
            {selectedClass && (
              <>
                <p className="text-[12px] text-t4 tabular">{classAssignments.length} assignment{classAssignments.length === 1 ? '' : 's'} · {selectedClass.member_count} students</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-[11px] text-t4 inline-flex items-center gap-1"><KeyRound size={11} /> Invite code:</span>
                  <code className="text-[12px] font-mono font-semibold px-1.5 py-0.5 rounded" style={{ background: 'var(--brandL)', color: 'var(--brand)' }}>{selectedClass.invite_code || '—'}</code>
                  <button onClick={() => copyText(selectedClass.invite_code)} title="Copy code" className="text-t4 hover:text-t transition-colors"><Copy size={12} /></button>
                  <button onClick={() => regenCode(selectedClass.id)} title="Regenerate code" className="text-t4 hover:text-t transition-colors"><RefreshCw size={12} /></button>
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button className="btn-secondary btn-sm disabled:opacity-50" disabled={!selectedClass || genning} onClick={genAssignment}
              title="AI creates & verifies a coding problem and posts it as an assignment">
              {genning ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} {genning ? 'Generating…' : 'AI generate'}
            </button>
            <button className="btn-primary btn-sm disabled:opacity-50" disabled={!selectedClass} onClick={() => setShowAssign(true)}>
              <Plus size={13} /> New assignment
            </button>
          </div>
        </div>

        {/* Auto-schedule for this class */}
        {selectedClass && (
          <div className="flex items-center gap-2.5 mb-3 p-2.5 rounded-lg flex-wrap"
            style={{ background: 'var(--brandGhost)', border: '1px solid color-mix(in srgb, var(--brand) 20%, transparent)' }}>
            <CalendarClock size={15} style={{ color: 'var(--brand)' }} className="flex-shrink-0" />
            <div className="flex-1 min-w-[160px]">
              <span className="text-[12.5px] text-t2">Auto-add an AI assignment to <b>{selectedClass.name}</b> at the time you pick</span>
              {sched.last_run && (
                <p className="text-[11px] text-t4 mt-0.5">
                  Last run {formatDistanceToNow(new Date(sched.last_run), { addSuffix: true })}
                  {sched.last_result ? ` · ${sched.last_result}` : ''}
                </p>
              )}
            </div>
            <ScheduleControl value={sched} onChange={changeSched} />
          </div>
        )}

        {!selectedClass ? (
          <p className="text-t4 text-[13px]">Select a class on the left to view its assignments.</p>
        ) : classAssignments.length === 0 ? (
          <p className="text-t4 text-[13px]">No assignments in this class yet — create one with “New assignment”.</p>
        ) : (
          <div className="space-y-2 overflow-y-auto max-h-[62vh] pr-1">
            {classAssignments.map(a => (
              <div key={a.id} onClick={() => openDrill(a)}
                className="rounded-lg surface-inset border border-line p-3 cursor-pointer hover:border-line-strong transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-t truncate">{a.title}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-t4">
                      <span>{a.problem_count} problems</span>
                      {a.due_date && <span className="inline-flex items-center gap-1"><CalendarClock size={11} /> due {format(new Date(a.due_date), 'MMM d, h:mm a')}</span>}
                      <span className="text-brand">· view who's done →</span>
                    </div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); deleteAssign(a.id) }} className="text-t4 hover:text-[color:var(--err)] transition-colors flex-shrink-0"><Trash2 size={13} /></button>
                </div>
                <div className="mt-2">
                  <div className="flex justify-between text-[11px] text-t4 mb-1 tabular">
                    <span>Class completion</span><span>{a.completion_pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface-h overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${a.completion_pct}%`, background: 'var(--brand)' }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showClass && <NewClassModal students={students} onClose={() => setShowClass(false)} onSaved={() => { setShowClass(false); load() }} />}
      {showAssign && <NewAssignmentModal classes={classes} defaultClassId={selected} problems={problems} onClose={() => setShowAssign(false)} onSaved={() => { setShowAssign(false); load() }} />}
      {drill && <AssignmentProgressModal data={drillData} onClose={() => setDrill(null)} />}
    </div>
  )
}

function AssignmentProgressModal({ data, onClose }) {
  return (
    <Modal open onClose={onClose} title={data?.assignment ? `${data.assignment.title} · who's done` : 'Assignment progress'} size="xl">
      {!data ? (
        <div className="py-10"><LoadingSpinner text="Loading progress…" /></div>
      ) : data.error ? (
        <p className="text-t4 text-[13px]">Could not load progress.</p>
      ) : (
        <div className="space-y-3">
          <p className="text-[12px] text-t4">
            {data.assignment.class_name} · {data.assignment.member_count} students · {data.assignment.problems.length} problems · sorted by least completed
          </p>
          <div className="table-container max-h-[58vh] overflow-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="table-header">
                  <th className="table-cell">Student</th>
                  {data.assignment.problems.map((p, i) => (
                    <th key={p.id} className="table-cell text-center" title={p.title}>P{i + 1}</th>
                  ))}
                  <th className="table-cell">Done</th>
                  <th className="table-cell">Last active</th>
                </tr>
              </thead>
              <tbody>
                {data.students.length === 0 && (
                  <tr><td colSpan={data.assignment.problems.length + 3} className="table-cell text-center text-t4 py-8">No students in this class yet.</td></tr>
                )}
                {data.students.map(s => {
                  const solvedSet = new Set(s.solved)
                  const pct = s.total ? Math.round(s.solved_count / s.total * 100) : 0
                  return (
                    <tr key={s.id} className="table-row">
                      <td className="table-cell">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-semibold font-serif flex-shrink-0" style={{ background: s.avatar_color || 'var(--brand-solid)' }}>{(s.name || '?')[0].toUpperCase()}</div>
                          <span className="text-t font-medium truncate">{s.name}</span>
                        </div>
                      </td>
                      {data.assignment.problems.map(p => (
                        <td key={p.id} className="table-cell text-center">
                          {solvedSet.has(p.id)
                            ? <CheckCircle2 size={15} className="inline" style={{ color: 'var(--ok)' }} />
                            : <Circle size={15} className="inline text-t4" />}
                        </td>
                      ))}
                      <td className="table-cell">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-surface-h overflow-hidden"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct === 100 ? 'var(--ok)' : 'var(--brand)' }} /></div>
                          <span className="text-[11px] tabular text-t3">{s.solved_count}/{s.total}</span>
                        </div>
                      </td>
                      <td className="table-cell text-[11px] text-t4 tabular">{s.last_activity ? formatDistanceToNow(new Date(s.last_activity), { addSuffix: true }) : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="text-[11px] text-t4 flex flex-wrap gap-x-4 gap-y-1">
            {data.assignment.problems.map((p, i) => (
              <span key={p.id}><span className="font-semibold text-t3">P{i + 1}</span> = {p.title}</span>
            ))}
          </div>
        </div>
      )}
    </Modal>
  )
}

function NewClassModal({ students, onClose, onSaved }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [picked, setPicked] = useState([])
  const [saving, setSaving] = useState(false)

  const toggle = (id) => setPicked(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])

  const save = async () => {
    if (!name.trim()) { toast.error('Name is required'); return }
    setSaving(true)
    try {
      await api.post('/classroom/classes', { name, description, member_ids: picked })
      toast.success('Class created'); onSaved()
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to create class') }
    finally { setSaving(false) }
  }

  return (
    <Modal open onClose={onClose} title="New class" size="md">
      <div className="space-y-4">
        <div><label className="label">Class name</label><input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. CS-101 Section A" autoFocus /></div>
        <div><label className="label">Description (optional)</label><input className="input" value={description} onChange={e => setDescription(e.target.value)} placeholder="Short note" /></div>
        <div>
          <label className="label">Students ({picked.length} selected)</label>
          <div className="max-h-56 overflow-y-auto rounded-lg border border-line surface-inset divide-y divide-[color:var(--beige-rule)]">
            {students.length === 0 ? <p className="text-t4 text-[13px] p-3">No students registered yet.</p> : students.map(s => (
              <label key={s.id} className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-surface-h">
                <input type="checkbox" checked={picked.includes(s.id)} onChange={() => toggle(s.id)} />
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-semibold font-serif flex-shrink-0" style={{ background: s.avatar_color || 'var(--brand-solid)' }}>{(s.full_name || '?')[0].toUpperCase()}</div>
                <span className="text-[13px] text-t2 truncate">{s.full_name}</span>
                <span className="text-[11px] text-t4 ml-auto truncate">{s.email}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button className="btn-secondary btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? 'Creating…' : 'Create class'}</button>
        </div>
      </div>
    </Modal>
  )
}

function NewAssignmentModal({ classes, problems, defaultClassId, onClose, onSaved }) {
  const [title, setTitle] = useState('')
  const [instructions, setInstructions] = useState('')
  const [classId, setClassId] = useState(defaultClassId || classes[0]?.id || '')
  const [due, setDue] = useState('')
  const [picked, setPicked] = useState([])
  const [saving, setSaving] = useState(false)

  const toggle = (id) => setPicked(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])

  const save = async () => {
    if (!title.trim()) { toast.error('Title is required'); return }
    if (!classId) { toast.error('Pick a class'); return }
    if (picked.length === 0) { toast.error('Select at least one problem'); return }
    setSaving(true)
    try {
      await api.post('/classroom/assignments', {
        title, instructions, class_id: Number(classId),
        due_date: due ? new Date(due).toISOString() : null,
        problem_ids: picked,
      })
      toast.success('Assignment created'); onSaved()
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to create assignment') }
    finally { setSaving(false) }
  }

  return (
    <Modal open onClose={onClose} title="New assignment" size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Title</label><input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Week 1 — Loops" autoFocus /></div>
          <div><label className="label">Class</label>
            <select className="input" value={classId} onChange={e => setClassId(e.target.value)}>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Instructions (optional)</label><input className="input" value={instructions} onChange={e => setInstructions(e.target.value)} placeholder="Notes for students" /></div>
          <div><label className="label">Due date (optional)</label><input type="datetime-local" className="input" value={due} onChange={e => setDue(e.target.value)} /></div>
        </div>
        <div>
          <label className="label">Problems ({picked.length} selected)</label>
          <div className="max-h-56 overflow-y-auto rounded-lg border border-line surface-inset divide-y divide-[color:var(--beige-rule)]">
            {problems.length === 0 ? <p className="text-t4 text-[13px] p-3">No problems available — create some in Practice/Test mode first.</p> : problems.map(p => (
              <label key={p.id} className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-surface-h">
                <input type="checkbox" checked={picked.includes(p.id)} onChange={() => toggle(p.id)} />
                <span className="text-[13px] text-t2 truncate">{p.title}</span>
                <span className="ml-auto flex items-center gap-1.5"><DifficultyBadge level={p.difficulty} /><span className="text-[10px] text-t4 uppercase">{p.mode}</span></span>
              </label>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button className="btn-secondary btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? 'Creating…' : 'Create assignment'}</button>
        </div>
      </div>
    </Modal>
  )
}

// ─────────────────────── Admin · Analytics (assignment-based) ──────────────

function AdminAnalytics() {
  const [assignments, setAssignments] = useState(null)
  const [classes, setClasses] = useState([])
  const [aSearch, setASearch] = useState('')
  const ct = useChartTheme()
  useEffect(() => {
    api.get('/classroom/assignments').then(r => setAssignments(r.data)).catch(() => setAssignments([]))
    api.get('/classroom/classes').then(r => setClasses(r.data)).catch(() => {})
  }, [])
  if (assignments === null) return <PageLoader />

  const avg = assignments.length ? Math.round(assignments.reduce((s, a) => s + a.completion_pct, 0) / assignments.length) : 0
  const done = assignments.filter(a => a.completion_pct >= 100).length
  const chartData = assignments.slice(0, 10).map(a => ({ name: a.title.length > 16 ? a.title.slice(0, 16) + '…' : a.title, completion: a.completion_pct }))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={ClipboardList} label="Assignments" value={assignments.length} color="var(--brand)" />
        <StatCard icon={GraduationCap} label="Classes" value={classes.length} color="var(--d-purple)" />
        <StatCard icon={CheckCircle2} label="Avg completion" value={`${avg}%`} color="var(--ok)" />
        <StatCard icon={CheckCircle2} label="Fully done" value={`${done}/${assignments.length}`} color="var(--info)" />
      </div>

      {assignments.length === 0 ? (
        <div className="card"><p className="text-t4 text-[13px]">No assignments yet. Create one in the Assignments tab to see completion analytics.</p></div>
      ) : (
        <>
          <div className="card">
            <h3 className="h3 mb-4">Completion by assignment</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                <XAxis dataKey="name" tick={{ fill: ct.axis, fontSize: 10 }} axisLine={false} tickLine={false} interval={0} angle={-15} textAnchor="end" height={50} />
                <YAxis tick={{ fill: ct.axis, fontSize: 11 }} axisLine={false} tickLine={false} unit="%" domain={[0, 100]} />
                <Tooltip {...ct.tooltip} />
                <Bar dataKey="completion" fill={ct.brand} radius={[4, 4, 0, 0]} name="Completion %" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
              <h3 className="h3">Assignment breakdown</h3>
              <div className="relative w-full max-w-[220px]">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-t4" />
                <input className="input pl-8 py-1.5 text-[12px]" placeholder="Filter assignments…" value={aSearch} onChange={e => setASearch(e.target.value)} />
              </div>
            </div>
            <div className="table-container">
              <table className="w-full text-left">
                <thead><tr className="table-header">
                  <th className="table-cell">Assignment</th><th className="table-cell">Class</th>
                  <th className="table-cell">Problems</th><th className="table-cell">Students</th>
                  <th className="table-cell">Completion</th>
                </tr></thead>
                <tbody>
                  {assignments.filter(a => `${a.title} ${a.class_name}`.toLowerCase().includes(aSearch.toLowerCase())).map(a => (
                    <tr key={a.id} className="table-row">
                      <td className="table-cell text-t font-medium">{a.title}</td>
                      <td className="table-cell">{a.class_name}</td>
                      <td className="table-cell tabular">{a.problem_count}</td>
                      <td className="table-cell tabular">{a.member_count}</td>
                      <td className="table-cell tabular" style={{ color: a.completion_pct >= 60 ? 'var(--ok)' : a.completion_pct > 0 ? 'var(--warn)' : 'var(--err)' }}>{a.completion_pct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─────────────────────────── Student · Assignments ─────────────────────────

function JoinClassCard({ onJoined }) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const join = async () => {
    if (!code.trim()) { toast.error('Enter an invite code'); return }
    setBusy(true)
    try {
      const { data } = await api.post('/classroom/join', { code })
      toast.success(data.joined ? `Joined ${data.class_name}` : (data.message || 'Already enrolled'))
      setCode(''); onJoined()
    } catch (e) { toast.error(e.response?.data?.detail || 'Could not join') }
    finally { setBusy(false) }
  }
  return (
    <div className="card flex items-center gap-2 flex-wrap">
      <span className="text-[13px] text-t2 font-medium inline-flex items-center gap-1.5"><KeyRound size={14} className="text-brand" /> Have a class invite code?</span>
      <input className="input max-w-[160px] font-mono uppercase tracking-wide" placeholder="A1B2C3" value={code}
        onChange={e => setCode(e.target.value.toUpperCase())} onKeyDown={e => { if (e.key === 'Enter') join() }} />
      <button className="btn-primary btn-sm" onClick={join} disabled={busy}>{busy ? 'Joining…' : 'Join class'}</button>
    </div>
  )
}

function StudentAssignments() {
  const [list, setList] = useState(null)
  const [openId, setOpenId] = useState(null)
  const load = () => api.get('/classroom/my-assignments')
    .then(r => { setList(r.data); setOpenId(o => o ?? (r.data[0]?.id ?? null)) })
    .catch(() => setList([]))
  useEffect(() => { load() }, [])
  if (list === null) return <PageLoader />

  if (list.length === 0) {
    return (
      <div className="space-y-3">
        <JoinClassCard onJoined={load} />
        <div className="card text-center py-12">
          <BookOpen size={32} className="mx-auto mb-3" style={{ color: 'var(--t4)' }} />
          <p className="h3 mb-1">No assignments yet</p>
          <p className="section-sub">Join a class with an invite code above, or wait for your teacher to assign work.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <JoinClassCard onJoined={load} />
      {list.map(a => {
        const pct = a.total ? Math.round(a.solved / a.total * 100) : 0
        const overdue = a.due_date && new Date(a.due_date) < new Date() && pct < 100
        const open = openId === a.id
        return (
          <div key={a.id} className="card !p-0 overflow-hidden">
            {/* clickable header */}
            <button
              onClick={() => setOpenId(open ? null : a.id)}
              className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-surface-h transition-colors"
            >
              <ChevronDown size={16} className={`text-t4 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
              <div className="min-w-0 flex-1">
                <h3 className="h3 truncate">{a.title}</h3>
                <div className="flex items-center gap-2 mt-1 text-[12px] text-t4 flex-wrap">
                  <span className="inline-flex items-center gap-1"><GraduationCap size={12} /> {a.class_name}</span>
                  {a.due_date && (
                    <span className="inline-flex items-center gap-1" style={overdue ? { color: 'var(--err)' } : undefined}>
                      <CalendarClock size={12} /> {overdue ? 'overdue · ' : 'due '}{formatDistanceToNow(new Date(a.due_date), { addSuffix: true })}
                    </span>
                  )}
                </div>
              </div>
              {/* compact progress in header */}
              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="hidden sm:block w-28 h-1.5 rounded-full bg-surface-h overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct === 100 ? 'var(--ok)' : 'var(--brand)' }} />
                </div>
                <div className="text-right">
                  <p className="text-[15px] font-bold tabular" style={{ color: pct === 100 ? 'var(--ok)' : 'var(--t)' }}>{pct}%</p>
                  <p className="text-[10px] text-t4 tabular">{a.solved}/{a.total}</p>
                </div>
              </div>
            </button>

            {open && (
              <div className="px-5 pb-5 pt-0">
                {a.instructions && <p className="text-[13px] text-t2 mb-3">{a.instructions}</p>}
                <div className="space-y-1.5">
                  {a.problems.map(p => (
                    <div key={p.id} className="flex items-center gap-2.5 rounded-lg surface-inset border border-line px-3 py-2">
                      {p.solved
                        ? <CheckCircle2 size={15} style={{ color: 'var(--ok)' }} />
                        : <Circle size={15} className="text-t4" />}
                      <span className="text-[13px] text-t2 truncate">{p.title}</span>
                      <DifficultyBadge level={p.difficulty} />
                      <Link to={`/code/${p.id}${p.mode === 'test' ? '?mode=test' : ''}`} className="btn-secondary btn-sm ml-auto">
                        {p.solved ? 'Review' : 'Solve'} <ArrowRight size={12} />
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────── Student · Analytics (assignment-based) ────────────

function StudentAnalytics() {
  const [list, setList] = useState(null)
  const ct = useChartTheme()
  useEffect(() => { api.get('/classroom/my-assignments').then(r => setList(r.data)).catch(() => setList([])) }, [])
  if (list === null) return <PageLoader />

  if (list.length === 0) {
    return (
      <div className="card text-center py-12">
        <BarChart3 size={32} className="mx-auto mb-3" style={{ color: 'var(--t4)' }} />
        <p className="h3 mb-1">No assignment analytics yet</p>
        <p className="section-sub">Once you're in a class with assignments, your per-assignment progress shows here. For your overall skills &amp; weak topics, open the <span className="text-brand font-medium">Analytics</span> tab.</p>
      </div>
    )
  }

  const totalProblems = list.reduce((s, a) => s + a.total, 0)
  const solved = list.reduce((s, a) => s + a.solved, 0)
  const completed = list.filter(a => a.total && a.solved === a.total).length
  const overall = totalProblems ? Math.round(solved / totalProblems * 100) : 0
  const chartData = list.map(a => ({ name: a.title.length > 16 ? a.title.slice(0, 16) + '…' : a.title, pct: a.total ? Math.round(a.solved / a.total * 100) : 0 }))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={ClipboardList} label="Assignments" value={list.length} color="var(--brand)" />
        <StatCard icon={CheckCircle2} label="Completed" value={`${completed}/${list.length}`} color="var(--ok)" />
        <StatCard icon={GraduationCap} label="Problems solved" value={`${solved}/${totalProblems}`} color="var(--info)" />
        <StatCard icon={BarChart3} label="Overall" value={`${overall}%`} color="var(--warn)" />
      </div>

      <div className="card">
        <h3 className="h3 mb-4">Progress by assignment</h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chartData} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
            <XAxis dataKey="name" tick={{ fill: ct.axis, fontSize: 10 }} axisLine={false} tickLine={false} interval={0} angle={-15} textAnchor="end" height={50} />
            <YAxis tick={{ fill: ct.axis, fontSize: 11 }} axisLine={false} tickLine={false} unit="%" domain={[0, 100]} />
            <Tooltip {...ct.tooltip} />
            <Bar dataKey="pct" fill={ct.ok} radius={[4, 4, 0, 0]} name="Solved %" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
