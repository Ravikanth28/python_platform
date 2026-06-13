/**
 * TestMode page – identical to PracticeMode but with proctoring enabled.
 * We re-use the ProblemForm component from PracticeMode by passing isTest=true.
 */
import { useEffect, useState } from 'react'
import { Plus, Trash2, Search, FlaskConical, ShieldCheck, Edit, Copy, Power } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../api/client'
import Modal          from '../../components/ui/Modal'
import { PageLoader } from '../../components/ui/LoadingSpinner'
import { DifficultyBadge } from '../../components/ui/Badge'
import CountBar, { diffStats } from '../../components/ui/CountBar'

// ── Re-use ProblemForm ─────────────────────────────────────────────────────
// (Inline here to avoid circular import; identical to PracticeMode's form
//  but with isTest=true so proctoring section is shown.)

const EMPTY_TC = { input_data: '', expected_output: '', is_hidden: false }

function ProblemForm({ initial, onSave, onCancel }) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState(
    initial || {
      title: '', description: '', topics: '', difficulty: 'medium',
      duration: 60, is_for_all: true, assigned_user_ids: '',
      start_time: '', end_time: '',
      tab_switch_detect: true, copy_paste_disable: true,
      f12_disable: true, fullscreen_required: true,
      window_switch_detect: true, block_paste: true,
      test_cases: [{ ...EMPTY_TC }],
    }
  )
  const [aiLoading, setAiLoading] = useState(false)
  const [aiForm, setAiForm] = useState({ topic: '', difficulty: 'medium', description: '' })

  const set = (k) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm({ ...form, [k]: val })
  }
  const setTc = (i, k, v) => {
    const tcs = [...form.test_cases]; tcs[i] = { ...tcs[i], [k]: v }
    setForm({ ...form, test_cases: tcs })
  }
  const addTc   = () => setForm({ ...form, test_cases: [...form.test_cases, { ...EMPTY_TC }] })
  const removeTc = (i) => setForm({ ...form, test_cases: form.test_cases.filter((_, idx) => idx !== i) })

  const generateAI = async () => {
    if (!aiForm.topic) { toast.error('Enter a topic'); return }
    setAiLoading(true)
    try {
      const { data } = await api.post('/ai/generate-problem', aiForm)
      setForm((f) => ({
        ...f,
        title: data.title || f.title, description: data.description || f.description,
        topics: data.topics || f.topics, difficulty: data.difficulty || f.difficulty,
        test_cases: data.test_cases?.length ? data.test_cases : f.test_cases,
      }))
      toast.success('AI problem generated!'); setStep(1)
    } catch (err) { toast.error(err.response?.data?.detail || 'AI generation failed') }
    finally { setAiLoading(false) }
  }

  const handleSave = () => {
    if (!form.title || !form.description) { toast.error('Title and description required'); return }
    onSave({
      ...form, mode: 'test',
      start_time: form.start_time || null, end_time: form.end_time || null,
      duration: Number(form.duration) || null,
      assigned_user_ids: form.assigned_user_ids
        ? form.assigned_user_ids.split(',').map((x) => parseInt(x.trim())).filter(Boolean) : [],
    })
  }

  return (
    <div>
      <div className="flex gap-2 mb-5">
        {[['1 · Problem Details', 1], ['2 · Questions & Proctoring', 2]].map(([label, s]) => (
          <button key={s} type="button" onClick={() => setStep(s)}
            className={step === s ? 'tab-active' : 'tab-inactive'}>{label}</button>
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <div><label className="label">Title *</label>
            <input className="input" value={form.title} onChange={set('title')} placeholder="Test name" required /></div>
          <div><label className="label">Description *</label>
            <textarea className="input resize-none" rows={4} value={form.description} onChange={set('description')}
              placeholder="Problem statement…" required /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Topics</label>
              <input className="input" value={form.topics} onChange={set('topics')} placeholder="arrays, pointers" /></div>
            <div><label className="label">Difficulty</label>
              <select className="input" value={form.difficulty} onChange={set('difficulty')}>
                <option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
              </select></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Start Time</label>
              <input type="datetime-local" className="input" value={form.start_time} onChange={set('start_time')} /></div>
            <div><label className="label">End Time</label>
              <input type="datetime-local" className="input" value={form.end_time} onChange={set('end_time')} /></div>
          </div>
          <div><label className="label">Duration (minutes)</label>
            <input type="number" className="input" value={form.duration} onChange={set('duration')} min={5} /></div>
          <div>
            <label className="label">Assign To</label>
            <div className="flex gap-3 mb-2">
              {[['All Students', true], ['Specific Students', false]].map(([lbl, val]) => (
                <label key={lbl} className="flex items-center gap-2 cursor-pointer text-sm text-t2">
                  <input type="radio" className="accent-primary" checked={form.is_for_all === val}
                    onChange={() => setForm({ ...form, is_for_all: val })} />{lbl}
                </label>
              ))}
            </div>
            {!form.is_for_all && (
              <input className="input" value={form.assigned_user_ids} onChange={set('assigned_user_ids')}
                placeholder="Student IDs comma-separated" />
            )}
          </div>

          {/* Proctoring */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck size={15} style={{ color: 'var(--d-purple)' }} />
              <label className="label !mb-0" style={{ color: 'var(--d-purple)' }}>Proctoring Options</label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                ['tab_switch_detect',   'Tab Switch Detection'],
                ['window_switch_detect','Window Switch Detection'],
                ['copy_paste_disable',  'Disable Copy-Paste'],
                ['block_paste',         'Block Paste into Editor'],
                ['f12_disable',         'Disable F12 / DevTools'],
                ['fullscreen_required', 'Require Full Screen'],
              ].map(([key, label]) => (
                <label key={key}
                  className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                    form[key] ? 'border-line-strong' : 'border-line text-t3 hover:border-line-strong'
                  }`}
                  style={form[key] ? { background: 'var(--brandGhost)', color: 'var(--d-purple)' } : undefined}>
                  <input type="checkbox" className="accent-violet" checked={form[key]} onChange={set(key)} />
                  <span className="text-sm">{label}</span>
                </label>
              ))}
            </div>
          </div>

          <button type="button" onClick={() => setStep(2)} className="btn-primary w-full justify-center">
            Next: Add Questions →
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="rounded-lg border border-line p-4" style={{ background: 'var(--brandGhost)' }}>
            <p className="text-xs font-semibold mb-3 flex items-center gap-1" style={{ color: 'var(--d-purple)' }}>
              <span>⚡</span> AI Generator (Cerebras)
            </p>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <input className="input" placeholder="Topic" value={aiForm.topic}
                onChange={(e) => setAiForm({ ...aiForm, topic: e.target.value })} />
              <select className="input" value={aiForm.difficulty}
                onChange={(e) => setAiForm({ ...aiForm, difficulty: e.target.value })}>
                <option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
              </select>
            </div>
            <button type="button" onClick={generateAI} disabled={aiLoading}
              className="btn-secondary w-full justify-center text-sm">
              {aiLoading ? 'Generating…' : '✨ Generate with AI'}
            </button>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label !mb-0">Test Cases</label>
              <button type="button" onClick={addTc} className="btn-ghost btn-sm"><Plus size={13} /> Add</button>
            </div>
            <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
              {form.test_cases.map((tc, i) => (
                <div key={i} className="rounded-lg border border-line p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-t3 tabular">Case #{i + 1}</span>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 text-xs text-t3 cursor-pointer">
                        <input type="checkbox" className="accent-primary" checked={tc.is_hidden}
                          onChange={(e) => setTc(i, 'is_hidden', e.target.checked)} /> Hidden
                      </label>
                      {form.test_cases.length > 1 && (
                        <button type="button" onClick={() => removeTc(i)} style={{ color: 'var(--err)' }}>
                          <Trash2 size={13} /></button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="label text-[10px]">Input</label>
                      <textarea className="input font-mono text-xs resize-none" rows={3}
                        value={tc.input_data} onChange={(e) => setTc(i, 'input_data', e.target.value)} />
                    </div>
                    <div>
                      <label className="label text-[10px]">Expected Output</label>
                      <textarea className="input font-mono text-xs resize-none" rows={3}
                        value={tc.expected_output} onChange={(e) => setTc(i, 'expected_output', e.target.value)} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={() => setStep(1)} className="btn-secondary flex-1">← Back</button>
            <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
            <button type="button" onClick={handleSave} className="btn-primary flex-1">Save Test</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function TestMode() {
  const [problems, setProblems] = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editProblem, setEditProblem] = useState(null)

  const load = () => {
    setLoading(true)
    api.get('/problems?mode=test&include_inactive=true').then((r) => setProblems(r.data)).finally(() => setLoading(false))
  }
  useEffect(load, [])

  const handleDuplicate = async (id) => {
    try { await api.post(`/problems/${id}/duplicate`); toast.success('Test duplicated'); load() }
    catch { toast.error('Failed to duplicate') }
  }
  const handleToggleActive = async (p) => {
    try {
      await api.patch(`/problems/${p.id}/active`, { is_active: !p.is_active })
      toast.success(p.is_active ? 'Test deactivated' : 'Test activated')
      load()
    } catch { toast.error('Failed to update status') }
  }
  const handleDelete = async (p) => {
    if (!window.confirm(`Permanently delete "${p.title}"?\n\nThis removes the test, its cases and all student attempts/submissions. This cannot be undone.`)) return
    try {
      await api.delete(`/problems/${p.id}/permanent`)
      toast.success('Test deleted')
      load()
    } catch { toast.error('Failed to delete') }
  }

  const handleSave = async (payload) => {
    try {
      if (editProblem) {
        await api.put(`/problems/${editProblem.id}`, payload)
        toast.success('Test updated!')
      } else {
        await api.post('/problems', payload)
        toast.success('Test created!')
      }
      setShowModal(false); load()
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed') }
  }

  const handleEdit = async (id) => {
    try {
      const { data } = await api.get(`/problems/${id}`)
      if (data.start_time) data.start_time = data.start_time.slice(0, 16)
      if (data.end_time) data.end_time = data.end_time.slice(0, 16)
      data.assigned_user_ids = ''
      setEditProblem(data)
      setShowModal(true)
    } catch (err) {
      toast.error('Failed to fetch test details')
    }
  }

  const filtered = problems.filter((p) =>
    p.title.toLowerCase().includes(search.toLowerCase()) && (showInactive || p.is_active)
  )
  const inactiveCount = problems.filter((p) => !p.is_active).length
  if (loading) return <PageLoader />

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="h1">Test Mode</h1>
          <p className="section-sub mt-0.5">Create proctored tests for students</p>
        </div>
        <button onClick={() => { setEditProblem(null); setShowModal(true); }} className="btn-primary">
          <Plus size={16} /> Create Test
        </button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative max-w-xs flex-1 min-w-[180px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-t4" />
          <input className="input pl-8" placeholder="Search tests…" value={search}
            onChange={(e) => setSearch(e.target.value)} />
        </div>
        {inactiveCount > 0 && (
          <button onClick={() => setShowInactive(v => !v)} className={showInactive ? 'tab-active' : 'tab-inactive'}>
            {showInactive ? 'Hide' : 'Show'} inactive ({inactiveCount})
          </button>
        )}
        <CountBar stats={[{ label: 'Total', count: problems.length }, ...diffStats(problems)]} />
      </div>

      {filtered.length === 0 ? (
        <div className="card text-center py-16">
          <FlaskConical size={40} className="mx-auto text-t4 mb-3" />
          <p className="text-t3">No tests yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <div key={p.id} className="card" style={p.is_active ? undefined : { opacity: 0.62 }}>
              <div className="flex items-start justify-between mb-2">
                <h3 className="h3 text-sm line-clamp-2 flex-1 pr-2">{p.title}</h3>
                <div className="flex gap-0.5 flex-shrink-0">
                  <button onClick={() => handleEdit(p.id)} title="Edit" className="btn-ghost p-1" style={{ color: 'var(--t2)' }}>
                    <Edit size={14} />
                  </button>
                  <button onClick={() => handleDuplicate(p.id)} title="Duplicate" className="btn-ghost p-1" style={{ color: 'var(--t2)' }}>
                    <Copy size={14} />
                  </button>
                  <button onClick={() => handleToggleActive(p)} title={p.is_active ? 'Deactivate' : 'Activate'} className="btn-ghost p-1"
                    style={{ color: p.is_active ? 'var(--warn)' : 'var(--ok)' }}>
                    <Power size={14} />
                  </button>
                  <button onClick={() => handleDelete(p)} title="Delete permanently" className="btn-ghost p-1" style={{ color: 'var(--err)' }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-2">
                <DifficultyBadge level={p.difficulty} />
                <span className="badge-violet badge tabular">{p.test_cases_count} cases</span>
                {p.fullscreen_required && <span className="badge-violet badge">🔒 Fullscreen</span>}
                {p.tab_switch_detect   && <span className="badge-yellow badge">⚠ Tab Switch</span>}
                {!p.is_active && <span className="badge-gray badge">Inactive</span>}
              </div>
              {p.duration && <p className="text-xs text-t4 tabular">Duration: {p.duration} min</p>}
            </div>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editProblem ? "Edit Proctored Test" : "Create Proctored Test"} size="lg">
        <ProblemForm key={editProblem ? editProblem.id : 'new'} initial={editProblem} onSave={handleSave} onCancel={() => setShowModal(false)} />
      </Modal>
    </div>
  )
}
