import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Eye, Bug, Puzzle, Sparkles, Loader2, CalendarClock } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import toast from 'react-hot-toast'
import api from '../../api/client'
import { PageLoader } from '../../components/ui/LoadingSpinner'
import { DifficultyBadge } from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import CountBar, { diffStats } from '../../components/ui/CountBar'
import ScheduleControl from '../../components/ui/ScheduleControl'

const TOPICS = [
  ['basics', 'Basics & I/O'], ['conditionals', 'Conditionals'], ['loops', 'Loops'],
  ['functions', 'Functions'], ['arrays', 'Arrays'], ['strings', 'Strings'],
  ['pointers', 'Pointers'], ['matrices', '2-D Arrays & Matrices'], ['structures', 'Structures'],
]

const BLANK = {
  kind: 'predict', title: '', topic: 'basics', difficulty: 'easy',
  snippet: '', test_input: '', expected_output: '', explanation: '', is_active: true,
}

export default function AdminChallenges() {
  const [items, setItems] = useState(null)
  const [editing, setEditing] = useState(null)   // object or null
  const [filter, setFilter] = useState('')        // '' | predict | fixbug
  const [generating, setGenerating] = useState(false)
  const [sched, setSched] = useState({ frequency: 'off', hour: 9, dow: 0 })

  const load = () => api.get('/learn/admin/challenges').then(r => setItems(r.data))
  useEffect(() => {
    load()
    api.get('/learn/admin/challenges/schedule')
      .then(r => setSched({ frequency: r.data.frequency || 'off', hour: r.data.hour ?? 9, dow: r.data.dow ?? 0, last_run: r.data.last_run, last_result: r.data.last_result }))
      .catch(() => {})
  }, [])

  const saveSchedule = async (next) => {
    setSched(s => ({ ...s, ...next }))
    try { await api.post('/learn/admin/challenges/schedule', next); toast.success(next.frequency === 'off' ? 'Auto-add off' : `Auto-add: ${next.frequency}`) }
    catch { toast.error('Could not save schedule') }
  }

  const remove = async (id) => {
    if (!window.confirm('Delete this challenge?')) return
    await api.delete(`/learn/admin/challenges/${id}`)
    toast.success('Deleted')
    load()
  }

  const generate = async () => {
    setGenerating(true)
    try {
      const { data } = await api.post('/learn/admin/challenges/generate')
      toast.success(`AI added ${data.count} challenge${data.count === 1 ? '' : 's'} (1 predict + 1 fix-the-bug)`)
      load()
    } catch (e) { toast.error(e.response?.data?.detail || 'Generation failed — try again') }
    finally { setGenerating(false) }
  }

  if (!items) return <PageLoader />
  const shown = filter ? items.filter(c => c.kind === filter) : items

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="h1">Challenges</h1>
          <p className="section-sub mt-0.5">Author Predict-the-Output and Fix-the-Bug skill-builders for students.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button className="btn-secondary btn-sm" disabled={generating} onClick={generate} title="AI creates & verifies 1 Predict + 1 Fix-the-Bug">
            {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} {generating ? 'Generating…' : 'AI generate'}
          </button>
          <button className="btn-primary btn-sm" onClick={() => setEditing({ ...BLANK })}>
            <Plus size={14} /> New challenge
          </button>
        </div>
      </div>

      {/* Auto-schedule */}
      <div className="card flex items-center gap-3 flex-wrap" style={{ background: 'var(--brandGhost)', borderColor: 'color-mix(in srgb, var(--brand) 22%, transparent)' }}>
        <CalendarClock size={16} style={{ color: 'var(--brand)' }} className="flex-shrink-0" />
        <div className="flex-1 min-w-[180px]">
          <p className="text-[13px] font-semibold text-t">Auto-add challenges on a schedule</p>
          <p className="text-[12px] text-t4">AI generates a fresh Predict + Fix-the-Bug at the time you pick.</p>
          {sched.last_run && (
            <p className="text-[11px] text-t4 mt-1">
              Last run {formatDistanceToNow(new Date(sched.last_run), { addSuffix: true })}
              {sched.last_result ? ` · ${sched.last_result}` : ''}
            </p>
          )}
        </div>
        <ScheduleControl value={sched} onChange={saveSchedule} />
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-2">
          {[['All', '', items.length],
            ['Predict', 'predict', items.filter(c => c.kind === 'predict').length],
            ['Fix the Bug', 'fixbug', items.filter(c => c.kind === 'fixbug').length]].map(([l, v, n]) => (
            <button key={v} onClick={() => setFilter(v)} className={filter === v ? 'tab-active' : 'tab-inactive'}>
              {l} <span className="tabular opacity-70">{n}</span>
            </button>
          ))}
        </div>
        <span className="text-t4">·</span>
        <CountBar stats={diffStats(items)} />
      </div>

      {shown.length === 0 ? (
        <div className="card text-center py-16">
          <Puzzle size={40} className="mx-auto text-t4 mb-3" />
          <p className="text-t3">No challenges yet. Click “New challenge” to add one.</p>
        </div>
      ) : (
        <div className="table-container">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="table-header">
                  <th className="table-cell">Type</th>
                  <th className="table-cell">Title</th>
                  <th className="table-cell">Topic</th>
                  <th className="table-cell">Difficulty</th>
                  <th className="table-cell">Active</th>
                  <th className="table-cell text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {shown.map(c => (
                  <tr key={c.id} className="table-row">
                    <td className="table-cell">
                      <span className="inline-flex items-center gap-1.5 text-[13px] text-t2">
                        {c.kind === 'predict' ? <Eye size={14} /> : <Bug size={14} style={{ color: 'var(--warn)' }} />}
                        {c.kind === 'predict' ? 'Predict' : 'Fix Bug'}
                      </span>
                    </td>
                    <td className="table-cell text-t font-medium">{c.title}</td>
                    <td className="table-cell text-t3">{c.topic}</td>
                    <td className="table-cell"><DifficultyBadge level={c.difficulty} /></td>
                    <td className="table-cell">{c.is_active ? '✓' : '—'}</td>
                    <td className="table-cell">
                      <div className="flex items-center gap-1.5 justify-end">
                        <button className="btn-secondary text-xs py-1 px-2.5" onClick={() => setEditing(c)}>
                          <Pencil size={12} /> Edit
                        </button>
                        <button className="btn-ghost text-xs py-1 px-2" onClick={() => remove(c.id)}>
                          <Trash2 size={12} style={{ color: 'var(--err)' }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ChallengeEditor item={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />
    </div>
  )
}

function ChallengeEditor({ item, onClose, onSaved }) {
  const [form, setForm] = useState(BLANK)
  const [saving, setSaving] = useState(false)
  useEffect(() => { if (item) setForm({ ...BLANK, ...item }) }, [item])

  if (!item) return null
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))
  const isFix = form.kind === 'fixbug'

  const save = async () => {
    if (!form.title.trim() || !form.snippet.trim()) { toast.error('Title and code are required'); return }
    if (!form.expected_output.trim()) { toast.error('Expected output is required'); return }
    setSaving(true)
    try {
      const payload = { ...form, is_active: !!form.is_active }
      if (form.id) await api.put(`/learn/admin/challenges/${form.id}`, payload)
      else await api.post('/learn/admin/challenges', payload)
      toast.success('Saved')
      onSaved()
    } catch { toast.error('Save failed') }
    finally { setSaving(false) }
  }

  return (
    <Modal open={!!item} onClose={onClose} title={form.id ? 'Edit challenge' : 'New challenge'} size="lg">
      <div className="space-y-3">
        <div className="grid sm:grid-cols-4 gap-3">
          <div>
            <label className="label">Type</label>
            <select className="input" value={form.kind} onChange={set('kind')}>
              <option value="predict">Predict the Output</option>
              <option value="fixbug">Fix the Bug</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Title</label>
            <input className="input" value={form.title} onChange={set('title')} placeholder="e.g. Integer division" />
          </div>
          <div>
            <label className="label">Difficulty</label>
            <select className="input" value={form.difficulty} onChange={set('difficulty')}>
              <option value="easy">easy</option><option value="medium">medium</option><option value="hard">hard</option>
            </select>
          </div>
        </div>

        <div>
          <label className="label">Topic</label>
          <select className="input max-w-xs" value={form.topic} onChange={set('topic')}>
            {TOPICS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>

        <div>
          <label className="label">{isFix ? 'Buggy code (shown to student to fix)' : 'Code snippet (shown to student)'}</label>
          <textarea className="input font-mono text-[13px] resize-y" rows={8} value={form.snippet} onChange={set('snippet')}
            placeholder={'# Write your solution here'} />
        </div>

        {isFix && (
          <div>
            <label className="label">Program input / stdin (optional)</label>
            <textarea className="input font-mono text-[13px] resize-none" rows={2} value={form.test_input} onChange={set('test_input')}
              placeholder="e.g. 4 6" />
          </div>
        )}

        <div>
          <label className="label">Expected output</label>
          <textarea className="input font-mono text-[13px] resize-none" rows={3} value={form.expected_output} onChange={set('expected_output')}
            placeholder="Exact correct stdout" />
        </div>

        <div>
          <label className="label">Explanation (revealed after answering)</label>
          <textarea className="input text-[13px] resize-none" rows={3} value={form.explanation} onChange={set('explanation')}
            placeholder="Explain why — the teaching moment." />
        </div>

        <label className="flex items-center gap-2 text-[13px] text-t2">
          <input type="checkbox" className="accent-primary" checked={!!form.is_active}
            onChange={(e) => setForm(f => ({ ...f, is_active: e.target.checked }))} />
          Active (visible to students)
        </label>

        <div className="flex gap-2 pt-1">
          <button className="btn-primary" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save challenge'}</button>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </Modal>
  )
}
