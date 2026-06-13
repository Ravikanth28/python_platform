import { useEffect, useState } from 'react'
import Editor from '@monaco-editor/react'
import {
  Eye, Bug, CheckCircle2, XCircle, Play, Lightbulb, RotateCcw, Send, Loader2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../api/client'
import { PageLoader } from '../../components/ui/LoadingSpinner'
import { DifficultyBadge } from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import { useTheme } from '../../context/ThemeContext'
import { friendlyHint } from '../../utils/friendlyErrors'

export default function Challenges() {
  const [tab, setTab] = useState('predict')   // predict | fixbug

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="h1">Challenges</h1>
        <p className="section-sub mt-0.5">Quick brain-teasers to sharpen your C instincts — no grading, just learning.</p>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setTab('predict')} className={tab === 'predict' ? 'tab-active' : 'tab-inactive'}>
          <Eye size={14} /> Predict the Output
        </button>
        <button onClick={() => setTab('fixbug')} className={tab === 'fixbug' ? 'tab-active' : 'tab-inactive'}>
          <Bug size={14} /> Fix the Bug
        </button>
      </div>

      {tab === 'predict' ? <PredictTab /> : <FixBugTab />}
    </div>
  )
}

/* ─────────────────────────── Predict the Output ────────────────────────── */

function PredictTab() {
  const [items, setItems] = useState(null)
  const [active, setActive] = useState(null)   // challenge being predicted

  useEffect(() => {
    api.get('/learn/challenges?kind=predict').then(r => setItems(r.data))
  }, [])

  if (!items) return <PageLoader />
  if (items.length === 0) return <Empty icon={Eye} text="No predict-the-output challenges yet." />

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map(c => (
          <div key={c.id} className="card-hover flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h3 className="h3 line-clamp-1 pr-2">{c.title}</h3>
              <Eye size={16} style={{ color: 'var(--brand)' }} className="flex-shrink-0" />
            </div>
            <div className="flex items-center gap-1.5 mb-3">
              <span className="badge badge-gray">{c.topic}</span>
              <DifficultyBadge level={c.difficulty} />
            </div>
            <p className="text-[12px] text-t4 mb-3 flex-1">Read the snippet and predict exactly what it prints, then check your answer.</p>
            <button className="btn-primary justify-center" onClick={() => setActive(c)}>
              <Eye size={14} /> Predict output
            </button>
          </div>
        ))}
      </div>

      <PredictModal challenge={active} onClose={() => setActive(null)} />
    </>
  )
}

function PredictModal({ challenge, onClose }) {
  const [answer, setAnswer] = useState('')
  const [res, setRes] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => { setAnswer(''); setRes(null) }, [challenge])

  if (!challenge) return null

  const check = async () => {
    setBusy(true)
    try {
      const { data } = await api.post(`/learn/challenges/${challenge.id}/check`, { answer })
      setRes(data)
      data.correct ? toast.success('Correct! 🎉') : toast('Not quite — see the answer', { icon: '🤔' })
    } catch { toast.error('Could not check answer') }
    finally { setBusy(false) }
  }

  return (
    <Modal open={!!challenge} onClose={onClose} title={`Predict the Output · ${challenge.title}`} size="lg">
      <div className="space-y-3">
        <div>
          <p className="text-[12px] text-t4 mb-1.5">What does this print?</p>
          <pre className="surface-inset border border-line rounded-lg p-3 text-[12.5px] font-mono text-t2 overflow-x-auto whitespace-pre">{challenge.snippet}</pre>
        </div>

        <div>
          <label className="label">Your predicted output</label>
          <textarea
            className="input font-mono text-[13px] resize-none"
            rows={3}
            placeholder="Type exactly what the program prints…"
            value={answer}
            onChange={e => setAnswer(e.target.value)}
            disabled={!!res}
          />
        </div>

        {res && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[13px] font-semibold"
              style={{ color: res.correct ? 'var(--ok)' : 'var(--err)' }}>
              {res.correct ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
              {res.correct ? 'Correct!' : 'Not quite'}
            </div>
            {!res.correct && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[11px] text-t4 mb-0.5">Your answer</p>
                  <pre className="surface-inset border border-line rounded-lg p-2.5 text-[12.5px] font-mono whitespace-pre" style={{ color: 'var(--err)' }}>{answer || '(empty)'}</pre>
                </div>
                <div>
                  <p className="text-[11px] text-t4 mb-0.5">Correct output</p>
                  <pre className="surface-inset border border-line rounded-lg p-2.5 text-[12.5px] font-mono whitespace-pre" style={{ color: 'var(--ok)' }}>{res.expected_output}</pre>
                </div>
              </div>
            )}
            {res.explanation && (
              <div className="flex gap-2 p-2.5 rounded-lg" style={{ background: 'var(--brandGhost)' }}>
                <Lightbulb size={15} style={{ color: 'var(--brand)' }} className="flex-shrink-0 mt-0.5" />
                <p className="text-[12.5px] text-t2 leading-relaxed">{res.explanation}</p>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-2">
          {res ? (
            <button className="btn-secondary" onClick={() => { setRes(null); setAnswer('') }}>
              <RotateCcw size={14} /> Try again
            </button>
          ) : (
            <button className="btn-primary" disabled={busy} onClick={check}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Check answer
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}

/* ─────────────────────────── Fix the Bug ───────────────────────────────── */

function FixBugTab() {
  const [items, setItems] = useState(null)
  const [active, setActive] = useState(null)   // challenge being solved

  useEffect(() => {
    api.get('/learn/challenges?kind=fixbug').then(r => setItems(r.data))
  }, [])

  if (!items) return <PageLoader />
  if (items.length === 0) return <Empty icon={Bug} text="No fix-the-bug challenges yet." />

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map(c => (
          <div key={c.id} className="card-hover flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h3 className="h3 line-clamp-1 pr-2">{c.title}</h3>
              <Bug size={16} style={{ color: 'var(--warn)' }} className="flex-shrink-0" />
            </div>
            <div className="flex items-center gap-1.5 mb-3">
              <span className="badge badge-gray">{c.topic}</span>
              <DifficultyBadge level={c.difficulty} />
            </div>
            <p className="text-[12px] text-t4 mb-3 flex-1">This program has a bug. Find it and make it produce the correct output.</p>
            <button className="btn-primary justify-center" onClick={() => setActive(c)}>
              <Bug size={14} /> Fix it
            </button>
          </div>
        ))}
      </div>

      <FixModal challenge={active} onClose={() => setActive(null)} />
    </>
  )
}

function FixModal({ challenge, onClose }) {
  const { isDark } = useTheme()
  const [code, setCode] = useState('')
  const [res, setRes] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setCode(challenge?.snippet || '')
    setRes(null)
  }, [challenge])

  if (!challenge) return null

  const check = async () => {
    setBusy(true); setRes(null)
    try {
      const { data } = await api.post(`/learn/challenges/${challenge.id}/check`, { code })
      setRes(data)
      data.correct ? toast.success('Fixed it! 🎉') : toast('Still not right — keep going', { icon: '🐛' })
    } catch { toast.error('Could not run your code') }
    finally { setBusy(false) }
  }

  const hint = res && !res.correct && res.status === 'Compilation Error'
    ? friendlyHint(res.error) : null

  return (
    <Modal open={!!challenge} onClose={onClose} title={`Fix the Bug · ${challenge.title}`} size="xl">
      <div className="space-y-3">
        <div className="grid lg:grid-cols-2 gap-3">
          <div>
            <label className="label">Code (edit to fix the bug)</label>
            <div className="rounded-lg overflow-hidden border border-line" style={{ height: 320 }}>
              <Editor
                height="320px"
                defaultLanguage="python"
                theme={isDark ? 'vs-dark' : 'light'}
                value={code}
                onChange={(v) => setCode(v || '')}
                options={{ fontSize: 13, minimap: { enabled: false }, scrollBeyondLastLine: false, tabSize: 4 }}
              />
            </div>
          </div>
          <div className="space-y-3">
            {challenge.test_input?.trim() && (
              <div>
                <label className="label">Program input (stdin)</label>
                <pre className="surface-inset border border-line rounded-lg p-2.5 text-[12.5px] font-mono whitespace-pre-wrap text-t2">{challenge.test_input}</pre>
              </div>
            )}

            {res && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[13px] font-semibold"
                  style={{ color: res.correct ? 'var(--ok)' : 'var(--err)' }}>
                  {res.correct ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
                  {res.correct ? 'Correct — bug fixed!' : (res.status === 'Compilation Error' ? "Won't compile yet" : 'Output is wrong')}
                </div>

                {res.status === 'Compilation Error' ? (
                  <>
                    <pre className="surface-inset border border-line rounded-lg p-2.5 text-[11.5px] font-mono whitespace-pre-wrap" style={{ color: 'var(--err)', maxHeight: 140, overflow: 'auto' }}>{res.error}</pre>
                    {hint && (
                      <div className="flex gap-2 p-2.5 rounded-lg" style={{ background: 'var(--brandGhost)' }}>
                        <Lightbulb size={15} style={{ color: 'var(--brand)' }} className="flex-shrink-0 mt-0.5" />
                        <p className="text-[12.5px] text-t2 leading-relaxed">{hint}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[11px] text-t4 mb-0.5">Your output</p>
                      <pre className="surface-inset border border-line rounded-lg p-2.5 text-[12.5px] font-mono whitespace-pre-wrap" style={{ color: res.correct ? 'var(--ok)' : 'var(--err)' }}>{res.output || '(empty)'}</pre>
                    </div>
                    <div>
                      <p className="text-[11px] text-t4 mb-0.5">Expected</p>
                      <pre className="surface-inset border border-line rounded-lg p-2.5 text-[12.5px] font-mono whitespace-pre-wrap text-t2">{res.expected_output}</pre>
                    </div>
                  </div>
                )}

                {res.correct && res.explanation && (
                  <div className="flex gap-2 p-2.5 rounded-lg" style={{ background: 'var(--brandGhost)' }}>
                    <Lightbulb size={15} style={{ color: 'var(--brand)' }} className="flex-shrink-0 mt-0.5" />
                    <p className="text-[12.5px] text-t2 leading-relaxed">{res.explanation}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button className="btn-primary" disabled={busy} onClick={check}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />} Run &amp; check
          </button>
          <button className="btn-secondary" onClick={() => { setCode(challenge.snippet); setRes(null) }}>
            <RotateCcw size={14} /> Reset code
          </button>
        </div>
      </div>
    </Modal>
  )
}

function Empty({ icon: Icon, text }) {
  return (
    <div className="card text-center py-16">
      <Icon size={40} className="mx-auto text-t4 mb-3" />
      <p className="text-t3">{text}</p>
    </div>
  )
}
