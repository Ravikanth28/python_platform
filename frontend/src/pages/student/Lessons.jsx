import { useEffect, useState } from 'react'
import Editor from '@monaco-editor/react'
import {
  GraduationCap, CheckCircle2, Circle, ArrowLeft, ArrowRight, Play, Loader2,
  Lightbulb, BookOpen, Type, HelpCircle, Link2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../api/client'
import { PageLoader } from '../../components/ui/LoadingSpinner'
import Markdown from '../../components/ui/Markdown'
import { useTheme } from '../../context/ThemeContext'

export default function Lessons() {
  const [list, setList] = useState(null)
  const [activeId, setActiveId] = useState(null)
  const [done, setDone] = useState(new Set())

  useEffect(() => {
    api.get('/learn/lessons').then(r => setList(r.data))
    api.get('/learn/my-progress').then(r => setDone(new Set(r.data.completed || []))).catch(() => {})
  }, [])

  if (!list) return <PageLoader />

  if (activeId != null) {
    const idx = list.findIndex(l => l.id === activeId)
    const next = list[idx + 1]
    return (
      <LessonView
        id={activeId}
        onBack={() => setActiveId(null)}
        nextTitle={next?.title}
        onComplete={async () => {
          try { await api.post(`/learn/lessons/${activeId}/complete`) } catch { /* ignore */ }
          setDone(d => new Set(d).add(activeId))
          if (next) setActiveId(next.id); else { toast.success('Curriculum complete! 🎓'); setActiveId(null) }
        }}
      />
    )
  }

  const total = list.length
  const completed = list.filter(l => done.has(l.id)).length
  const pct = total ? Math.round(completed / total * 100) : 0

  return (
    <div className="space-y-5 animate-fade-in max-w-5xl">
      <div>
        <h1 className="h1">Lessons</h1>
        <p className="section-sub mt-0.5">Learn Python step by step — read a concept, run real code, check yourself.</p>
      </div>

      <div className="card flex items-center gap-4">
        <div className="flex-1">
          <div className="flex justify-between text-[12px] text-t3 mb-1.5">
            <span>Course progress</span><span className="tabular">{completed}/{total} lessons</span>
          </div>
          <div className="h-2.5 rounded-full surface-inset overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: 'var(--brand-solid)' }} />
          </div>
        </div>
        <span className="font-serif font-bold text-[22px] text-t tabular leading-none">{pct}%</span>
      </div>

      <div className="space-y-2">
        {list.map((l, i) => {
          const isDone = done.has(l.id)
          return (
            <button key={l.id} onClick={() => setActiveId(l.id)}
              className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-line surface hover:shadow-katonic-sm transition-all text-left">
              <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 font-serif font-bold text-[13px]"
                style={isDone ? { background: 'var(--ok)', color: '#fff' } : { background: 'var(--beige-pill)', color: 'var(--t3)' }}>
                {isDone ? <CheckCircle2 size={16} /> : i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold text-t">{l.title}</p>
                <p className="text-[12px] text-t4">{l.topic} · {l.blocks_count} steps</p>
              </div>
              <ArrowRight size={16} className="text-t4 flex-shrink-0" />
            </button>
          )
        })}
      </div>
    </div>
  )
}

const BLOCK_LABEL = { concept: 'Concept', example: 'Example', check: 'Check', reference: 'References' }
const BLOCK_ICON = { concept: Type, example: Play, check: HelpCircle, reference: Link2 }

function LessonView({ id, onBack, onComplete, nextTitle }) {
  const [lesson, setLesson] = useState(null)
  const [step, setStep] = useState(0)
  useEffect(() => { setLesson(null); setStep(0); api.get(`/learn/lessons/${id}`).then(r => setLesson(r.data)) }, [id])
  if (!lesson) return <PageLoader />

  const blocks = lesson.blocks || []
  const total = blocks.length
  const last = step >= total - 1
  const pct = total ? Math.round((step + 1) / total * 100) : 0

  return (
    <div className="space-y-4 animate-fade-in">
      <button onClick={onBack} className="btn-ghost text-[13px] flex items-center gap-1.5"><ArrowLeft size={15} /> All lessons</button>

      <div className="flex items-center gap-2">
        <BookOpen size={18} style={{ color: 'var(--brand)' }} />
        <h1 className="h2">{lesson.title}</h1>
        <span className="badge badge-gray ml-1">{lesson.topic}</span>
      </div>

      <div className="grid lg:grid-cols-[230px_minmax(0,1fr)] gap-6 items-start">
        {/* Step navigator (uses the horizontal space + lets you jump) */}
        <aside className="hidden lg:block lg:sticky lg:top-2 space-y-2">
          <div className="h-1.5 rounded-full surface-inset overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: 'var(--brand-solid)' }} />
          </div>
          <p className="text-[11px] text-t4 tabular">{step + 1} / {total} steps</p>
          <div className="space-y-1">
            {blocks.map((b, i) => {
              const Icon = BLOCK_ICON[b.type] || Type
              const active = i === step
              const visited = i < step
              return (
                <button key={i} onClick={() => setStep(i)}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-[12.5px] transition-colors border"
                  style={active ? { borderColor: 'color-mix(in srgb, var(--brand) 45%, transparent)', background: 'var(--brandGhost)', color: 'var(--brand)' }
                    : { borderColor: 'transparent', color: visited ? 'var(--t3)' : 'var(--t4)' }}>
                  <Icon size={13} className="flex-shrink-0" />
                  <span className="truncate">{BLOCK_LABEL[b.type] || 'Step'}</span>
                  {visited && <CheckCircle2 size={12} className="ml-auto flex-shrink-0" style={{ color: 'var(--ok)' }} />}
                </button>
              )
            })}
          </div>
        </aside>

        {/* Main content — fills the width & height */}
        <div className="min-w-0 space-y-4 flex flex-col min-h-[72vh]">
          {/* mobile progress */}
          <div className="lg:hidden flex items-center gap-3">
            <div className="flex-1 h-1.5 rounded-full surface-inset overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--brand-solid)' }} />
            </div>
            <span className="text-[12px] text-t4 tabular">{step + 1}/{total}</span>
          </div>

          {blocks.map((b, i) => (
            <div key={i} className={i === step ? 'flex-1 flex flex-col' : 'hidden'}>
              {b.type === 'concept' && <ConceptBlock body={b.body} />}
              {b.type === 'example' && <ExampleBlock block={b} />}
              {b.type === 'check' && <CheckBlock block={b} />}
              {b.type === 'reference' && <ReferenceBlock items={b.items} />}
            </div>
          ))}

          <div className="flex items-center gap-2 pt-1">
            <button onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0}
              className="btn-secondary btn-sm disabled:opacity-40"><ArrowLeft size={14} /> Back</button>
            {last ? (
              <button onClick={onComplete} className="btn-primary">
                <CheckCircle2 size={15} /> {nextTitle ? 'Complete & next lesson' : 'Finish course'}
              </button>
            ) : (
              <button onClick={() => setStep(s => Math.min(total - 1, s + 1))} className="btn-primary">
                Next <ArrowRight size={15} />
              </button>
            )}
            {last && nextTitle && <span className="text-[12px] text-t4">Next: {nextTitle}</span>}
          </div>
        </div>
      </div>
    </div>
  )
}

function ReferenceBlock({ items = [] }) {
  return (
    <div className="card">
      <p className="text-[12px] font-semibold uppercase tracking-wide mb-2 flex items-center gap-1.5 text-t3"><Link2 size={13} /> References &amp; further reading</p>
      <div className="space-y-1.5">
        {items.map((it, i) => (
          <a key={i} href={it.url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 text-[13.5px] p-2 rounded-lg hover:bg-surface-h transition-colors" style={{ color: 'var(--brand)' }}>
            <Link2 size={13} className="flex-shrink-0" />
            <span className="underline-offset-2 hover:underline">{it.title}</span>
          </a>
        ))}
      </div>
    </div>
  )
}

function ConceptBlock({ body }) {
  return (
    <div className="card flex-1 overflow-auto">
      <div className="text-[14.5px] text-t2 leading-[1.75] max-w-3xl"><Markdown text={body} /></div>
    </div>
  )
}

function ExampleBlock({ block }) {
  const { isDark } = useTheme()
  const [code, setCode] = useState(block.code || '')
  const [out, setOut] = useState(null)
  const [busy, setBusy] = useState(false)

  const run = async () => {
    setBusy(true); setOut(null)
    try {
      const { data } = await api.post('/submissions/run', { code, custom_input: block.stdin || '' })
      setOut(data)
    } catch { toast.error('Run failed') }
    finally { setBusy(false) }
  }

  const ok = out && out.status === 'ok'
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[12px] font-semibold text-t3 uppercase tracking-wide flex items-center gap-1.5"><Play size={12} style={{ color: 'var(--brand)' }} /> {block.title || 'Example'}</span>
        <button className="btn-primary btn-sm" disabled={busy} onClick={run}>
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />} Run
        </button>
      </div>
      <div className="rounded-lg overflow-hidden border border-line">
        <Editor height="200px" defaultLanguage="python" theme={isDark ? 'vs-dark' : 'light'}
          value={code} onChange={(v) => setCode(v || '')}
          options={{ fontSize: 13, minimap: { enabled: false }, scrollBeyondLastLine: false, tabSize: 4 }} />
      </div>
      {block.stdin?.trim() && (
        <p className="text-[11px] text-t4 mt-1.5">input: <span className="font-mono text-t3">{block.stdin.trim()}</span></p>
      )}
      {out && (
        <div className="mt-2">
          <p className="text-[11px] text-t4 mb-0.5">Output</p>
          <pre className="surface-inset border border-line rounded-lg p-2.5 text-[12.5px] font-mono whitespace-pre-wrap break-words"
            style={{ color: ok ? 'var(--ok)' : 'var(--err)' }}>{ok ? (out.output || '(no output)') : (out.output || out.error || out.status)}</pre>
        </div>
      )}
    </div>
  )
}

function CheckBlock({ block }) {
  const [answer, setAnswer] = useState('')
  const [result, setResult] = useState(null)   // null | 'correct' | 'wrong'

  const norm = (s) => (s || '').trim().replace(/\s+/g, ' ').toLowerCase()
  const submit = (val) => {
    const a = val ?? answer
    const correct = norm(a) === norm(block.answer)
    setResult(correct ? 'correct' : 'wrong')
  }

  return (
    <div className="card" style={{ borderColor: 'color-mix(in srgb, var(--warn) 30%, transparent)' }}>
      <p className="text-[12px] font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--warn)' }}>Quick check</p>
      <p className="text-[14px] text-t mb-3">{block.question}</p>

      {block.mode === 'mcq' ? (
        <div className="space-y-1.5">
          {(block.options || []).map((opt) => {
            const chosen = answer === opt
            const isAns = result && opt === block.answer
            const isWrongPick = result === 'wrong' && chosen && opt !== block.answer
            return (
              <button key={opt} disabled={!!result}
                onClick={() => { setAnswer(opt); submit(opt) }}
                className="w-full text-left px-3 py-2 rounded-lg border text-[13px] font-mono transition-colors"
                style={isAns ? { borderColor: 'var(--ok)', background: 'color-mix(in srgb, var(--ok) 12%, transparent)', color: 'var(--ok)' }
                  : isWrongPick ? { borderColor: 'var(--err)', background: 'color-mix(in srgb, var(--err) 12%, transparent)', color: 'var(--err)' }
                  : { borderColor: chosen ? 'var(--brand-solid)' : 'var(--line)', color: 'var(--t2)' }}>
                {opt}
              </button>
            )
          })}
        </div>
      ) : (
        <div className="flex gap-2">
          <input className="input font-mono text-[13px]" placeholder="Type the output…" value={answer}
            disabled={!!result} onChange={e => setAnswer(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit() }} />
          <button className="btn-primary btn-sm" disabled={!!result} onClick={() => submit()}>Check</button>
        </div>
      )}

      {result && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2 text-[13px] font-semibold" style={{ color: result === 'correct' ? 'var(--ok)' : 'var(--err)' }}>
            {result === 'correct' ? <CheckCircle2 size={15} /> : <Circle size={15} />}
            {result === 'correct' ? 'Correct!' : `Not quite — answer: ${block.answer}`}
          </div>
          {block.explanation && (
            <div className="flex gap-2 p-2.5 rounded-lg" style={{ background: 'var(--brandGhost)' }}>
              <Lightbulb size={15} style={{ color: 'var(--brand)' }} className="flex-shrink-0 mt-0.5" />
              <p className="text-[12.5px] text-t2 leading-relaxed">{block.explanation}</p>
            </div>
          )}
          {result === 'wrong' && (
            <button className="btn-secondary btn-sm" onClick={() => { setResult(null); setAnswer('') }}>Try again</button>
          )}
        </div>
      )}
    </div>
  )
}
