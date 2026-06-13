import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, BookMarked, ChevronUp, ChevronDown, Type, Play, HelpCircle, Link2, Users, CheckCircle2, Circle, Sparkles, Loader2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import toast from 'react-hot-toast'
import api from '../../api/client'
import { PageLoader } from '../../components/ui/LoadingSpinner'
import Modal from '../../components/ui/Modal'

const TOPICS = [
  ['basics', 'Basics & I/O'], ['conditionals', 'Conditionals'], ['loops', 'Loops'],
  ['functions', 'Functions'], ['arrays', 'Arrays'], ['strings', 'Strings'],
  ['pointers', 'Pointers'], ['matrices', '2-D Arrays & Matrices'], ['structures', 'Structures'],
]

const BLANK = { title: '', topic: 'basics', order_index: 0, blocks: [], is_active: true }
const NEW_BLOCK = {
  concept: () => ({ type: 'concept', body: '' }),
  example: () => ({ type: 'example', title: 'Run this', code: '# Write your code here\n', stdin: '' }),
  check:   () => ({ type: 'check', mode: 'mcq', question: '', options: ['', ''], answer: '', explanation: '' }),
  reference: () => ({ type: 'reference', items: [{ title: '', url: '' }] }),
}

export default function AdminLessons() {
  const [items, setItems] = useState(null)
  const [editing, setEditing] = useState(null)
  const [progressFor, setProgressFor] = useState(null)

  const load = () => api.get('/learn/admin/lessons').then(r => setItems(r.data))
  useEffect(() => { load() }, [])

  const remove = async (id) => {
    if (!window.confirm('Delete this lesson?')) return
    await api.delete(`/learn/admin/lessons/${id}`)
    toast.success('Deleted'); load()
  }

  if (!items) return <PageLoader />

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="h1">Lessons</h1>
          <p className="section-sub mt-0.5">Author the interactive curriculum — concept, runnable example, and quick check.</p>
        </div>
        <button className="btn-primary btn-sm" onClick={() => setEditing({ ...BLANK, order_index: items.length + 1 })}>
          <Plus size={14} /> New lesson
        </button>
      </div>

      {items.length === 0 ? (
        <div className="card text-center py-16">
          <BookMarked size={40} className="mx-auto text-t4 mb-3" />
          <p className="text-t3">No lessons yet. Click “New lesson” to start your curriculum.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((l) => (
            <div key={l.id} className="flex items-center gap-3 p-3.5 rounded-xl border border-line surface">
              <span className="w-7 h-7 rounded-lg flex items-center justify-center bg-beige-pill text-t3 font-serif font-bold text-[12px] flex-shrink-0">{l.order_index}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold text-t">{l.title} {!l.is_active && <span className="text-[11px] text-t4">(hidden)</span>}</p>
                <p className="text-[12px] text-t4">{l.topic} · {l.blocks_count} blocks</p>
              </div>
              {l.total_students > 0 && (
                <button onClick={() => setProgressFor(l)} title="See who completed this"
                  className="hidden sm:flex items-center gap-2 mr-1">
                  <div className="w-24 h-1.5 rounded-full surface-inset overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.round((l.completed / l.total_students) * 100)}%`, background: 'var(--brand-solid)' }} />
                  </div>
                  <span className="text-[12px] text-t3 tabular whitespace-nowrap">{l.completed}/{l.total_students}</span>
                </button>
              )}
              <button className="btn-secondary text-xs py-1 px-2.5" onClick={() => setProgressFor(l)}><Users size={12} /> Progress</button>
              <button className="btn-secondary text-xs py-1 px-2.5" onClick={() => setEditing(l)}><Pencil size={12} /> Edit</button>
              <button className="btn-ghost text-xs py-1 px-2" onClick={() => remove(l.id)}><Trash2 size={12} style={{ color: 'var(--err)' }} /></button>
            </div>
          ))}
        </div>
      )}

      <LessonEditor item={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />
      <LessonProgressModal lesson={progressFor} onClose={() => setProgressFor(null)} />
    </div>
  )
}

function LessonEditor({ item, onClose, onSaved }) {
  const [form, setForm] = useState(BLANK)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  useEffect(() => { if (item) setForm({ ...BLANK, ...item, blocks: item.blocks || [] }) }, [item])
  if (!item) return null

  const generate = async () => {
    if (!form.title.trim()) { toast.error('Enter a title first'); return }
    if (form.blocks.length && !window.confirm('Replace the current blocks with an AI-generated detailed lesson?')) return
    setGenerating(true)
    try {
      const { data } = await api.post('/learn/admin/lessons/generate', { title: form.title, topic: form.topic })
      setForm(f => ({ ...f, blocks: data.blocks || [] }))
      toast.success(`Generated ${data.blocks?.length || 0} blocks — review & save`)
    } catch (e) { toast.error(e.response?.data?.detail || 'Generation failed') }
    finally { setGenerating(false) }
  }

  const setBlock = (i, patch) => setForm(f => ({ ...f, blocks: f.blocks.map((b, j) => j === i ? { ...b, ...patch } : b) }))
  const addBlock = (type) => setForm(f => ({ ...f, blocks: [...f.blocks, NEW_BLOCK[type]()] }))
  const removeBlock = (i) => setForm(f => ({ ...f, blocks: f.blocks.filter((_, j) => j !== i) }))
  const move = (i, dir) => setForm(f => {
    const b = [...f.blocks]; const j = i + dir
    if (j < 0 || j >= b.length) return f
    ;[b[i], b[j]] = [b[j], b[i]]; return { ...f, blocks: b }
  })

  const save = async () => {
    if (!form.title.trim()) { toast.error('Title required'); return }
    setSaving(true)
    try {
      const payload = { title: form.title, topic: form.topic, order_index: Number(form.order_index) || 0, blocks: form.blocks, is_active: !!form.is_active }
      if (form.id) await api.put(`/learn/admin/lessons/${form.id}`, payload)
      else await api.post('/learn/admin/lessons', payload)
      toast.success('Saved'); onSaved()
    } catch { toast.error('Save failed') }
    finally { setSaving(false) }
  }

  return (
    <Modal open={!!item} onClose={onClose} title={form.id ? 'Edit lesson' : 'New lesson'} size="xl">
      <div className="space-y-4">
        <div className="grid sm:grid-cols-4 gap-3">
          <div className="sm:col-span-2">
            <label className="label">Title</label>
            <input className="input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Pointers: the basics" />
          </div>
          <div>
            <label className="label">Topic</label>
            <select className="input" value={form.topic} onChange={e => setForm(f => ({ ...f, topic: e.target.value }))}>
              {TOPICS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Order</label>
            <input type="number" className="input" value={form.order_index} onChange={e => setForm(f => ({ ...f, order_index: e.target.value }))} />
          </div>
        </div>

        {/* AI generation */}
        <div className="flex items-center gap-2 p-3 rounded-lg" style={{ background: 'var(--brandGhost)', border: '1px solid color-mix(in srgb, var(--brand) 25%, transparent)' }}>
          <Sparkles size={16} style={{ color: 'var(--brand)' }} className="flex-shrink-0" />
          <p className="text-[12.5px] text-t2 flex-1">Let AI draft a full, detailed lesson for this title — then review &amp; edit before saving.</p>
          <button className="btn-primary btn-sm" disabled={generating} onClick={generate}>
            {generating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} {generating ? 'Generating…' : 'Generate with AI'}
          </button>
        </div>

        {/* Blocks */}
        <div className="space-y-2">
          {form.blocks.map((b, i) => (
            <div key={i} className="rounded-lg border border-line p-3 surface-inset">
              <div className="flex items-center gap-2 mb-2">
                {b.type === 'concept' && <Type size={14} className="text-t3" />}
                {b.type === 'example' && <Play size={14} style={{ color: 'var(--brand)' }} />}
                {b.type === 'check' && <HelpCircle size={14} style={{ color: 'var(--warn)' }} />}
                {b.type === 'reference' && <Link2 size={14} className="text-t3" />}
                <span className="text-[12px] font-semibold text-t2 capitalize">{b.type}</span>
                <div className="ml-auto flex items-center gap-1">
                  <button className="p-1 text-t4 hover:text-t" onClick={() => move(i, -1)}><ChevronUp size={14} /></button>
                  <button className="p-1 text-t4 hover:text-t" onClick={() => move(i, 1)}><ChevronDown size={14} /></button>
                  <button className="p-1" onClick={() => removeBlock(i)}><Trash2 size={13} style={{ color: 'var(--err)' }} /></button>
                </div>
              </div>

              {b.type === 'concept' && (
                <textarea className="input text-[13px] resize-y" rows={4} value={b.body} onChange={e => setBlock(i, { body: e.target.value })}
                  placeholder="Markdown — ## headings, **bold**, `code`, ```fenced blocks```, lists…" />
              )}

              {b.type === 'example' && (
                <div className="space-y-2">
                  <input className="input text-[13px]" value={b.title} onChange={e => setBlock(i, { title: e.target.value })} placeholder="Block title (e.g. Run this)" />
                  <textarea className="input font-mono text-[13px] resize-y" rows={7} value={b.code} onChange={e => setBlock(i, { code: e.target.value })} placeholder="Python code the student can run & edit" />
                  <input className="input font-mono text-[13px]" value={b.stdin || ''} onChange={e => setBlock(i, { stdin: e.target.value })} placeholder="stdin (optional)" />
                </div>
              )}

              {b.type === 'check' && (
                <div className="space-y-2">
                  <div className="flex gap-2 items-center">
                    <select className="input max-w-[140px] text-[13px]" value={b.mode} onChange={e => setBlock(i, { mode: e.target.value })}>
                      <option value="mcq">Multiple choice</option>
                      <option value="output">Type the output</option>
                    </select>
                  </div>
                  <input className="input text-[13px]" value={b.question} onChange={e => setBlock(i, { question: e.target.value })} placeholder="Question" />
                  {b.mode === 'mcq' && (
                    <div className="space-y-1.5">
                      {(b.options || []).map((opt, oi) => (
                        <div key={oi} className="flex gap-2 items-center">
                          <input type="radio" className="accent-primary" checked={b.answer === opt && opt !== ''} onChange={() => setBlock(i, { answer: opt })} title="Mark correct" />
                          <input className="input text-[13px] font-mono" value={opt}
                            onChange={e => { const opts = [...b.options]; const old = opts[oi]; opts[oi] = e.target.value; const patch = { options: opts }; if (b.answer === old) patch.answer = e.target.value; setBlock(i, patch) }}
                            placeholder={`Option ${oi + 1}`} />
                          <button className="p-1" onClick={() => setBlock(i, { options: b.options.filter((_, k) => k !== oi) })}><Trash2 size={12} style={{ color: 'var(--err)' }} /></button>
                        </div>
                      ))}
                      <button className="btn-ghost text-xs" onClick={() => setBlock(i, { options: [...(b.options || []), ''] })}><Plus size={12} /> Option</button>
                      <p className="text-[11px] text-t4">Select the radio next to the correct option.</p>
                    </div>
                  )}
                  {b.mode === 'output' && (
                    <input className="input font-mono text-[13px]" value={b.answer} onChange={e => setBlock(i, { answer: e.target.value })} placeholder="Expected output (exact)" />
                  )}
                  <textarea className="input text-[13px] resize-none" rows={2} value={b.explanation} onChange={e => setBlock(i, { explanation: e.target.value })} placeholder="Explanation (shown after answering)" />
                </div>
              )}

              {b.type === 'reference' && (
                <div className="space-y-1.5">
                  {(b.items || []).map((it, ri) => (
                    <div key={ri} className="flex gap-2 items-center">
                      <input className="input text-[13px]" value={it.title}
                        onChange={e => { const items = [...b.items]; items[ri] = { ...items[ri], title: e.target.value }; setBlock(i, { items }) }}
                        placeholder="Link title" />
                      <input className="input text-[13px] font-mono" value={it.url}
                        onChange={e => { const items = [...b.items]; items[ri] = { ...items[ri], url: e.target.value }; setBlock(i, { items }) }}
                        placeholder="https://…" />
                      <button className="p-1" onClick={() => setBlock(i, { items: b.items.filter((_, k) => k !== ri) })}><Trash2 size={12} style={{ color: 'var(--err)' }} /></button>
                    </div>
                  ))}
                  <button className="btn-ghost text-xs" onClick={() => setBlock(i, { items: [...(b.items || []), { title: '', url: '' }] })}><Plus size={12} /> Link</button>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary btn-sm" onClick={() => addBlock('concept')}><Type size={13} /> Add concept</button>
          <button className="btn-secondary btn-sm" onClick={() => addBlock('example')}><Play size={13} /> Add example</button>
          <button className="btn-secondary btn-sm" onClick={() => addBlock('check')}><HelpCircle size={13} /> Add check</button>
          <button className="btn-secondary btn-sm" onClick={() => addBlock('reference')}><Link2 size={13} /> Add references</button>
        </div>

        <label className="flex items-center gap-2 text-[13px] text-t2">
          <input type="checkbox" className="accent-primary" checked={!!form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
          Active (visible to students)
        </label>

        <div className="flex gap-2 pt-1">
          <button className="btn-primary" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save lesson'}</button>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </Modal>
  )
}

function LessonProgressModal({ lesson, onClose }) {
  const [data, setData] = useState(null)
  const [filter, setFilter] = useState('all')   // all | done | not
  useEffect(() => {
    setData(null)
    if (lesson) api.get(`/learn/admin/lessons/${lesson.id}/progress`).then(r => setData(r.data))
  }, [lesson])
  if (!lesson) return null

  const pct = data && data.total ? Math.round(data.completed / data.total * 100) : 0
  const rows = (data?.students || []).filter(s => filter === 'all' || (filter === 'done' ? s.done : !s.done))

  return (
    <Modal open={!!lesson} onClose={onClose} title={`Progress · ${lesson.title}`} size="lg">
      {!data ? <PageLoader /> : (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex justify-between text-[12px] text-t3 mb-1.5">
                <span>{data.completed} of {data.total} students completed</span>
                <span className="tabular font-semibold" style={{ color: 'var(--brand)' }}>{pct}%</span>
              </div>
              <div className="h-2.5 rounded-full surface-inset overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--brand-solid)' }} />
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            {[['All', 'all', data.total], ['Completed', 'done', data.completed], ['Not yet', 'not', data.total - data.completed]].map(([l, v, n]) => (
              <button key={v} onClick={() => setFilter(v)} className={filter === v ? 'tab-active' : 'tab-inactive'}>{l} <span className="tabular opacity-70">{n}</span></button>
            ))}
          </div>

          <div className="space-y-1 max-h-[50vh] overflow-auto">
            {rows.length === 0 ? <p className="text-t4 text-[13px] py-6 text-center">No students here.</p> : rows.map(s => (
              <div key={s.id} className="flex items-center gap-3 p-2.5 rounded-lg surface-inset">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold font-serif flex-shrink-0"
                  style={{ background: s.avatar_color || 'var(--brand-solid)' }}>{(s.name || '?')[0].toUpperCase()}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-t truncate">{s.name}</p>
                  <p className="text-[11px] text-t4 truncate">{s.email}</p>
                </div>
                {s.done ? (
                  <span className="flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--ok)' }}>
                    <CheckCircle2 size={14} /> {s.completed_at ? formatDistanceToNow(new Date(s.completed_at), { addSuffix: true }) : 'done'}
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-[12px] text-t4"><Circle size={14} /> not yet</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  )
}
