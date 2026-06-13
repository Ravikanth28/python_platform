import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Editor from '@monaco-editor/react'
import {
  Play, Send, ChevronLeft, ChevronRight, Clock, AlertTriangle,
  CheckCircle, XCircle, Terminal, Maximize2, Minimize2, ShieldCheck,
  Copy, Settings, Bookmark, BookmarkCheck, ThumbsUp, ThumbsDown,
  MessageSquare, Sparkles, ChevronDown, ChevronUp, X, Eye, HelpCircle,
  Pause, RotateCcw,
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../api/client'
import { StatusBadge } from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import LoadingSpinner, { PageLoader } from '../components/ui/LoadingSpinner'
import { formatDistanceToNow } from 'date-fns'
import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'
import { initVimMode } from 'monaco-vim'
import useInteractiveRun from '../hooks/useInteractiveRun'
import EditorTour from '../components/ui/EditorTour'
import Markdown from '../components/ui/Markdown'
import { enrichMessage } from '../utils/friendlyErrors'

const TOUR_KEY = 'cf_editor_tour_v1'
const PREFS_KEY = 'cf_editor_prefs'
const DEFAULT_PREFS = { fontSize: 14, tabSize: 4, relativeLines: false, wordWrap: true, vim: false }
const loadPrefs = () => {
  try { return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') } } catch { return { ...DEFAULT_PREFS } }
}
const fmtMem = (kb) => (kb == null ? '' : kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`)

const DEFAULT_PY = `# Write your solution here\n`

// Parse Python error text: syntax errors "SyntaxError: … (line N)" and tracebacks.
function parsePyErrors(text) {
  const out = []
  if (!text) return out
  // Syntax errors from the backend: "SyntaxError: <msg> (line N)"
  const synRe = /([A-Za-z]*(?:SyntaxError|IndentationError|TabError)):\s*([^\n(]*)\(line (\d+)\)/g
  let m
  while ((m = synRe.exec(text)) !== null) {
    out.push({ line: parseInt(m[3], 10), col: 1, severity: 'error', message: `${m[1]}: ${m[2].trim()}` })
  }
  // Runtime tracebacks: 'File "solution.py", line N' followed by the error on the last line.
  const tbRe = /File "[^"]*", line (\d+)/g
  let lastLine = null
  while ((m = tbRe.exec(text)) !== null) lastLine = parseInt(m[1], 10)
  if (lastLine !== null) {
    const errLine = (text.trim().split('\n').pop() || '').trim()
    out.push({ line: lastLine, col: 1, severity: 'error', message: errLine || 'Runtime error' })
  }
  return out
}

export default function CodingEnvironment() {
  const { problemId } = useParams()
  const [searchParams] = useSearchParams()
  const isTestMode = searchParams.get('mode') === 'test'
  const navigate = useNavigate()
  const { isDark } = useTheme()
  const { user } = useAuth()

  const [problem, setProblem]         = useState(null)
  const [allProblems, setAllProblems] = useState([])
  const [loading, setLoading]         = useState(true)
  const [code, setCode]               = useState(DEFAULT_PY)
  const [saveState, setSaveState]     = useState('saved') // 'saving' | 'saved'
  const [submitting, setSubmitting]   = useState(false)
  const [running, setRunning]         = useState(false)
  const [result, setResult]           = useState(null)
  const [activeTab, setActiveTab]     = useState('statement')
  const [timer, setTimer]             = useState(0)
  const [tabSwitches, setTabSwitches] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [customInputOpen, setCustomInputOpen] = useState(true)
  const [runMode, setRunMode]         = useState('samples') // 'samples' | 'console'
  const [sampleRun, setSampleRun]     = useState(null)
  const runner = useInteractiveRun()
  const [tourOpen, setTourOpen]       = useState(false)
  const [prefs, setPrefs]             = useState(loadPrefs)
  const [showSettings, setShowSettings] = useState(false)
  const [editorReady, setEditorReady] = useState(false)
  const vimRef       = useRef(null)
  const vimStatusRef = useRef(null)

  const closeTour = () => {
    setTourOpen(false)
    try { localStorage.setItem(TOUR_KEY, '1') } catch { /* ignore */ }
  }

  const tourSteps = [
    {
      title: 'Welcome to the workspace',
      body: 'A quick 60-second tour of how to read a problem, test your code, and submit. You can replay it anytime from the ? button in the editor toolbar.',
    },
    {
      selector: '[data-tour="statement"]',
      placement: 'right',
      title: 'Problem & samples',
      body: 'Read the task here. Each sample shows an Input and the Expected Output — use the copy icons to grab them. Scroll down for constraints and the time limit.',
      onEnter: () => { setActiveTab('statement'); setShowResult(false) },
    },
    {
      selector: '[data-tour="ai-tutor"]',
      placement: 'bottom',
      title: 'Stuck? Ask the AI Tutor',
      body: 'Switch to AI Tutor mode for hints and step-by-step guidance about the approach — without giving away the full answer.',
    },
    {
      selector: '[data-tour="editor"]',
      placement: 'left',
      title: 'Write your C code here',
      body: 'A full code editor with syntax highlighting, auto-indent and autocomplete. Write your solution using print() / input(). Your work auto-saves as you type, so a refresh never loses it.',
    },
    {
      selector: '[data-tour="editor-tools"]',
      placement: 'bottom',
      title: 'Editor tools',
      body: 'Copy your code, open editor settings, or go fullscreen for a distraction-free view.',
    },
    {
      selector: '[data-tour="sample-tests"]',
      placement: 'top',
      title: 'Sample Tests — check yourself',
      body: 'Press Run on this tab to test your code against the visible samples. You get a side-by-side Expected vs Your Output with ✓/✗ per case. This NEVER affects your score.',
      onEnter: () => { setRunMode('samples'); setCustomInputOpen(true) },
    },
    {
      selector: '[data-tour="console"]',
      placement: 'top',
      title: 'Console — run interactively',
      body: 'Run your program live, like a real terminal. When your code hits an input() it pauses and waits — type the value, press Enter, and it continues. Input is asked line-by-line, just like running Python in a terminal.',
      onEnter: () => { setRunMode('console'); setCustomInputOpen(true) },
    },
    {
      selector: '[data-tour="run"]',
      placement: 'top',
      title: 'Run',
      body: 'Runs the active tab — Sample Tests or Console. It is only a self-check: nothing is graded or saved.',
    },
    {
      selector: '[data-tour="submit"]',
      placement: 'top',
      title: 'Submit — graded',
      body: 'This grades your code against ALL test cases (including hidden ones), records your score, and finishes the problem. Use it once you are confident.',
    },
    {
      selector: '[data-tour="history"]',
      placement: 'right',
      title: 'History — your past attempts',
      body: 'Every submission is saved here with its verdict, score and time. Open one to view the code you submitted and load it back into the editor.',
      onEnter: () => { setActiveTab('history'); setShowResult(false) },
    },
    {
      selector: '[data-tour="timer"]',
      placement: 'bottom',
      title: 'Timer & navigation',
      body: 'Your elapsed time shows here (and the limit, if any). Use Prev / Next at the top to move between problems in this set.',
    },
    {
      title: 'Keyboard shortcuts',
      body: 'Ctrl/⌘ + Enter → Run · Ctrl/⌘ + Shift + Enter → Submit · Ctrl/⌘ + S → save draft. (Your code also auto-saves continuously.)',
    },
    {
      title: "You're all set",
      body: 'Read → write → Run to self-check → Submit to score. Tip: press the ? in the editor toolbar to replay this tour anytime. Happy coding!',
      onEnter: () => { setActiveTab('statement'); setShowResult(false) },
    },
  ]
  const [aiQuestion, setAiQuestion]   = useState('')
  const [aiLoading, setAiLoading]     = useState(false)
  const [showFullscreenOverlay, setShowFullscreenOverlay] = useState(false)
  const [aiMessages, setAiMessages]   = useState([])
  const [liked, setLiked]             = useState(null)
  const [bookmarked, setBookmarked]   = useState(false)
  const [showResult, setShowResult]   = useState(false)
  const [showVisualize, setShowVisualize] = useState(false)
  const [memcheck, setMemcheck] = useState(null)   // null | 'loading' | result object
  const [mobileView, setMobileView] = useState('problem')   // mobile-only: 'problem' | 'code'

  const timerRef     = useRef(null)
  const startTimeRef = useRef(Date.now())
  const autoSubmittedRef = useRef(false)
  const containerRef = useRef(null)
  const stateRef     = useRef({}) // latest values for global shortcuts
  const editorRef    = useRef(null)
  const monacoRef    = useRef(null)

  const clearMarkers = () => {
    try { monacoRef.current?.editor.setModelMarkers(editorRef.current.getModel(), 'python', []) } catch { /* ignore */ }
  }
  const showCompileErrors = (text) => {
    const m = monacoRef.current, ed = editorRef.current
    if (!m || !ed) return
    const model = ed.getModel()
    if (!model) return
    const sev = (s) => s === 'error' ? m.MarkerSeverity.Error : s === 'warning' ? m.MarkerSeverity.Warning : m.MarkerSeverity.Info
    const markers = parsePyErrors(text)
      .filter(e => e.line >= 1 && e.line <= model.getLineCount())
      .map(e => ({
        startLineNumber: e.line, startColumn: Math.max(1, e.col),
        endLineNumber: e.line, endColumn: model.getLineMaxColumn(e.line),
        message: enrichMessage(e.message), severity: sev(e.severity), source: 'python',
      }))
    m.editor.setModelMarkers(model, 'python', markers)
    if (markers.length) ed.revealLineInCenter(markers[0].startLineNumber)
  }

  // Console (WebSocket) compilation errors → editor squiggles too
  useEffect(() => {
    if (runner.compileError) showCompileErrors(runner.compileError)
  }, [runner.compileError]) // eslint-disable-line react-hooks/exhaustive-deps

  // On phones, a finished submission lives in the left "Result" tab — surface it.
  useEffect(() => { if (showResult) setMobileView('problem') }, [showResult])

  // While in a test, send a heartbeat (with violations + run count) so admins see live status.
  const runsRef = useRef(0)
  useEffect(() => {
    if (!problem || !isTestMode) return
    const ping = () => api.post(`/submissions/test-ping/${problemId}`, {
      tab_switches: tabSwitches, runs: runsRef.current,
    }).catch(() => {})
    ping()
    const id = setInterval(ping, 20000)
    return () => clearInterval(id)
  }, [problem, isTestMode, problemId, tabSwitches])

  // Persist + apply editor preferences live
  useEffect(() => {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)) } catch { /* ignore */ }
    const ed = editorRef.current
    if (ed) {
      ed.updateOptions({
        fontSize: prefs.fontSize,
        wordWrap: prefs.wordWrap ? 'on' : 'off',
        lineNumbers: prefs.relativeLines ? 'relative' : 'on',
        tabSize: prefs.tabSize,
      })
      ed.getModel()?.updateOptions({ tabSize: prefs.tabSize, insertSpaces: true })
    }
  }, [prefs, editorReady])

  // Vim mode on/off
  useEffect(() => {
    const ed = editorRef.current
    if (!ed) return
    if (prefs.vim && !vimRef.current) {
      try { vimRef.current = initVimMode(ed, vimStatusRef.current) } catch { /* ignore */ }
    } else if (!prefs.vim && vimRef.current) {
      try { vimRef.current.dispose() } catch { /* ignore */ }
      vimRef.current = null
    }
  }, [prefs.vim, editorReady])

  useEffect(() => () => { try { vimRef.current?.dispose() } catch { /* ignore */ } }, [])

  useEffect(() => {
    const mode = isTestMode ? 'test' : 'practice'
    Promise.all([
      api.get(`/problems/${problemId}`),
      api.get(`/problems?mode=${mode}`),
    ])
      .then(([pRes, listRes]) => {
        setProblem(pRes.data)
        setAllProblems(listRes.data)
        let saved = null
        try { saved = localStorage.getItem(`cf_code_${problemId}`) } catch { /* ignore */ }
        const starter = pRes.data.starter_code && pRes.data.starter_code.trim()
          ? pRes.data.starter_code : DEFAULT_PY
        setCode(saved && saved.trim() ? saved : starter)
      })
      .catch(() => { toast.error('Problem not found'); navigate(-1) })
      .finally(() => setLoading(false))
  }, [problemId])

  useEffect(() => {
    if (!problem) return
    timerRef.current = setInterval(() => {
      setTimer(Math.floor((Date.now() - startTimeRef.current) / 1000))
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [problem])

  // Timed test: persist the start so a refresh / disconnect resumes the SAME clock
  useEffect(() => {
    if (!problem || !isTestMode || !problem.duration) return
    const key = `cf_teststart_${problemId}`
    let start = null
    try { const s = localStorage.getItem(key); if (s) start = parseInt(s, 10) } catch { /* ignore */ }
    if (!start || Number.isNaN(start)) {
      start = Date.now()
      try { localStorage.setItem(key, String(start)) } catch { /* ignore */ }
    }
    startTimeRef.current = start
    setTimer(Math.floor((Date.now() - start) / 1000))
  }, [problem, isTestMode, problemId])

  // Auto-submit once the time limit is reached (fires once)
  useEffect(() => {
    if (!isTestMode || !problem?.duration || autoSubmittedRef.current) return
    if (timer >= problem.duration * 60) {
      autoSubmittedRef.current = true
      toast.error("Time's up — submitting your latest code.")
      handleSubmit(true)
    }
  }, [timer, isTestMode, problem])

  // First-time guided tour (practice mode only — don't distract during a timed test)
  useEffect(() => {
    if (!problem || isTestMode) return
    let seen = false
    try { seen = !!localStorage.getItem(TOUR_KEY) } catch { /* ignore */ }
    if (seen) return
    const t = setTimeout(() => setTourOpen(true), 600)
    return () => clearTimeout(t)
  }, [problem, isTestMode])

  // Auto-save the student's code per problem (debounced) so a refresh never loses work
  useEffect(() => {
    if (!problem) return
    setSaveState('saving')
    const id = setTimeout(() => {
      try { localStorage.setItem(`cf_code_${problemId}`, code) } catch { /* ignore */ }
      setSaveState('saved')
    }, 500)
    return () => clearTimeout(id)
  }, [code, problem, problemId])

  // Global keyboard shortcuts: Ctrl/Cmd+Enter = Run, +Shift = Submit, Ctrl/Cmd+S = save draft
  useEffect(() => {
    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return
      const s = stateRef.current
      if (e.key === 'Enter') {
        e.preventDefault()
        if (e.shiftKey) s.handleSubmit?.(true)
        else s.handleRun?.()
      } else if (e.key.toLowerCase() === 's') {
        e.preventDefault()
        try { localStorage.setItem(`cf_code_${s.problemId}`, s.code) } catch { /* ignore */ }
        setSaveState('saved')
        toast.success('Draft saved')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!isTestMode || !problem) return
    
    if (problem.fullscreen_required && !document.fullscreenElement) {
      setShowFullscreenOverlay(true)
    }
    
    const onFullscreenChange = () => {
      if (document.fullscreenElement) {
        setShowFullscreenOverlay(false)
        setIsFullscreen(true)
      } else if (problem.fullscreen_required) {
        setShowFullscreenOverlay(true)
        setIsFullscreen(false)
      } else {
        setIsFullscreen(false)
      }
    }
    
    document.addEventListener('fullscreenchange', onFullscreenChange)

    const cleanups = [() => document.removeEventListener('fullscreenchange', onFullscreenChange)]

    if (problem.tab_switch_detect) {
      const onVisibility = () => {
        if (document.hidden) {
          setTabSwitches(prev => {
            const next = prev + 1
            toast.error(`Tab switch detected! (${next})`, { duration: 4000 })
            return next
          })
        }
      }
      document.addEventListener('visibilitychange', onVisibility)
      cleanups.push(() => document.removeEventListener('visibilitychange', onVisibility))
    }

    if (problem.window_switch_detect) {
      // Window lost focus — student switched to another app/window (Alt-Tab,
      // clicked outside the browser). Delay the check so a plain tab switch
      // (already counted via visibilitychange) doesn't get counted twice.
      let blurTimer = null
      const onBlur = () => {
        blurTimer = setTimeout(() => {
          if (document.hidden) return  // it was a tab switch, not a window switch
          setTabSwitches(prev => {
            const next = prev + 1
            toast.error(`Window switch detected! (${next})`, { duration: 4000 })
            return next
          })
        }, 200)
      }
      const onFocus = () => { if (blurTimer) { clearTimeout(blurTimer); blurTimer = null } }
      window.addEventListener('blur', onBlur)
      window.addEventListener('focus', onFocus)
      cleanups.push(() => {
        window.removeEventListener('blur', onBlur)
        window.removeEventListener('focus', onFocus)
        if (blurTimer) clearTimeout(blurTimer)
      })
    }

    return () => cleanups.forEach(fn => fn())
  }, [problem, isTestMode])

  useEffect(() => {
    if (!isTestMode || !problem) return
    const onKeyDown = (e) => {
      if (problem.f12_disable && e.key === 'F12') {
        e.preventDefault()
        e.stopPropagation()
        toast.error('Developer tools are disabled during this test.')
      }
      const key = e.key.toLowerCase()
      if (problem.copy_paste_disable && (e.ctrlKey || e.metaKey) && key === 'c') {
        e.preventDefault()
        e.stopPropagation()
        toast.error('Copy-paste is disabled during this test.')
      }
      if ((problem.copy_paste_disable || problem.block_paste) && (e.ctrlKey || e.metaKey) && key === 'v') {
        e.preventDefault()
        e.stopPropagation()
        toast.error('Pasting is disabled during this test.')
      }
    }
    const onCopyPaste = (e) => {
      // 'copy' is blocked only by copy_paste_disable; 'paste' by either option.
      const blocked = e.type === 'paste'
        ? (problem.copy_paste_disable || problem.block_paste)
        : problem.copy_paste_disable
      if (blocked) {
        e.preventDefault()
        e.stopPropagation()
        toast.error(e.type === 'paste' ? 'Pasting is disabled during this test.' : 'Copy-paste is disabled during this test.')
      }
    }
    const onContext = (e) => { 
      if (problem.f12_disable) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    document.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('copy', onCopyPaste, true)
    document.addEventListener('paste', onCopyPaste, true)
    document.addEventListener('contextmenu', onContext, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      document.removeEventListener('copy', onCopyPaste, true)
      document.removeEventListener('paste', onCopyPaste, true)
      document.removeEventListener('contextmenu', onContext, true)
    }
  }, [problem, isTestMode])

  useEffect(() => {
    return () => {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {})
      }
    }
  }, [])

  const requestFullscreen = () => {
    if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen()
    setIsFullscreen(true)
  }
  const exitFullscreen = () => {
    if (document.exitFullscreen) document.exitFullscreen()
    setIsFullscreen(false)
  }

  const currentIndex = allProblems.findIndex(p => p.id === Number(problemId))
  const prevProblem  = currentIndex > 0 ? allProblems[currentIndex - 1] : null
  const nextProblem  = currentIndex < allProblems.length - 1 ? allProblems[currentIndex + 1] : null
  const goPrev = () => { if (prevProblem) navigate(`/code/${prevProblem.id}${isTestMode ? '?mode=test' : ''}`) }
  const goNext = () => { if (nextProblem) navigate(`/code/${nextProblem.id}${isTestMode ? '?mode=test' : ''}`) }

  const handleSubmit = async (isFinalSubmit = true) => {
    if (!code.trim()) { toast.error('Write some code first!'); return }
    setSubmitting(true)
    const timeTaken = Math.floor((Date.now() - startTimeRef.current) / 1000)
    try {
      const { data } = await api.post('/submissions', {
        problem_id: Number(problemId),
        code,
        language: 'python',
        time_taken: timeTaken,
        tab_switches: tabSwitches,
      })
      
      if (isFinalSubmit) {
        try { localStorage.removeItem(`cf_teststart_${problemId}`) } catch { /* ignore */ }
        toast.success('Successfully submitted!')
        navigate(`/${user?.role || 'student'}/reports`)
        return
      }

      setResult(data)
      setShowResult(true)
      setActiveTab('statement')
      if (data.status === 'Accepted') toast.success('All test cases passed!')
      else toast.error(`${data.status}: ${data.passed}/${data.total} passed`)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  const visibleSamples = problem?.test_cases?.filter(tc => !tc.is_hidden) || []

  // Run = student self-check. NEVER grades or stores a submission.
  const handleRun = async () => {
    if (!code.trim()) { toast.error('Write some code first!'); return }
    runsRef.current += 1
    setCustomInputOpen(true)

    if (runMode === 'console') {
      runner.start(code)   // live interactive console over WebSocket
      return
    }

    setRunning(true)
    try {
      setSampleRun(null)
      if (visibleSamples.length === 0) {
        toast('No sample cases — switch to the Console tab to test your own input.')
        setRunning(false)
        return
      }
      const cases = visibleSamples.map(tc => ({
        id: tc.id,
        input_data: tc.input_data || '',
        expected_output: tc.expected_output || '',
      }))
      const { data } = await api.post('/submissions/run-samples', { code, cases })
      setSampleRun(data)
      if (data.status === 'Compilation Error') {
        showCompileErrors(data.error)
        toast.error('Compilation failed — see the underlined lines')
      } else {
        if (data.warnings && data.warnings.trim()) showCompileErrors(data.warnings)
        else clearMarkers()
        const passed = data.results.filter(r => r.passed).length
        if (passed === data.results.length) toast.success(`All ${passed} sample${passed === 1 ? '' : 's'} passed`)
        else toast.error(`${passed}/${data.results.length} samples passed`)
      }
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Run failed'
      toast.error(msg)
      setSampleRun({ status: 'Error', error: msg, results: [] })
    } finally {
      setRunning(false)
    }
  }

  const handleCopyCode = () => { navigator.clipboard.writeText(code); toast.success('Code copied!') }

  const handleVisualize = () => setShowVisualize(true)
  const handleMemcheck = async () => {
    setMemcheck('loading')
    try {
      const { data } = await api.post('/submissions/memcheck', { code, custom_input: visibleSamples[0]?.input_data || '' })
      setMemcheck(data)
    } catch {
      setMemcheck({ status: 'Error', report: 'Code check failed — is the backend running?', findings: [], clean: false })
    }
  }

  // expose latest values to the global keyboard-shortcut handler
  stateRef.current = { code, problemId, handleRun, handleSubmit }

  const sendAiMessage = async () => {
    if (!aiQuestion.trim()) return
    const userMsg = aiQuestion.trim()
    setAiMessages(prev => [...prev, { role: 'user', text: userMsg }])
    setAiQuestion('')
    setAiLoading(true)
    try {
      const { data } = await api.post('/ai/tutor', {
        question: userMsg,
        problem_title: problem?.title || '',
        problem_description: problem?.description || '',
        code,
      })
      setAiMessages(prev => [...prev, { role: 'ai', text: data.answer || 'No response.' }])
    } catch (err) {
      const msg = err.response?.status === 502
        ? "The AI tutor isn't configured on the server yet (no API key). In the meantime: re-read the samples, note what input you read and what output is expected, and sketch pseudo-code before writing C."
        : (err.response?.data?.detail || 'Could not reach the AI tutor right now — please try again.')
      setAiMessages(prev => [...prev, { role: 'ai', text: msg }])
    } finally {
      setAiLoading(false)
    }
  }

  const fmtTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
  const progressPct = allProblems.length > 1 ? Math.round(((currentIndex + 1) / allProblems.length) * 100) : 0

  if (loading) return (
    <div className="flex h-screen bg-beige-pg items-center justify-center">
      <PageLoader />
    </div>
  )
  if (!problem) return null

  if (showFullscreenOverlay) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-beige-pg text-t z-[100] fixed inset-0 p-6 text-center">
        <div className="max-w-md w-full surface-inset border border-line rounded-xl p-8 space-y-6 shadow-xl">
          <Maximize2 size={40} className="mx-auto" style={{ color: 'var(--warn)' }} />
          <div>
            <h2 className="text-xl font-bold mb-2">Fullscreen Required</h2>
            <p className="text-t3 text-sm">
              This assessment requires you to be in fullscreen mode to continue. Exiting fullscreen will pause or invalidate your session.
            </p>
          </div>
          <button 
            className="btn-primary w-full justify-center h-11"
            onClick={() => {
              if (document.documentElement.requestFullscreen) {
                document.documentElement.requestFullscreen().then(() => {
                  setShowFullscreenOverlay(false)
                }).catch(err => {
                  toast.error("Failed to enter fullscreen.")
                })
              }
            }}
          >
            Enter Fullscreen to Start
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
    <EditorTour open={tourOpen} steps={tourSteps} onClose={closeTour} />
    <EditorSettingsModal open={showSettings} prefs={prefs} setPrefs={setPrefs} onClose={() => setShowSettings(false)} />
    {showVisualize && (
      <VisualizeModal code={code} defaultInput={visibleSamples[0]?.input_data || ''} onClose={() => setShowVisualize(false)} />
    )}

    {memcheck && (
      <MemCheckModal result={memcheck} onClose={() => setMemcheck(null)} onRerun={handleMemcheck} />
    )}
    <div ref={containerRef} className="flex flex-col h-screen bg-beige-pg text-t overflow-hidden">

      {/* TOP BAR */}
      <header className="flex items-center justify-between px-4 h-11 border-b border-line bg-surface-h flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-t3 hover:text-t transition-colors">
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => setBookmarked(b => !b)}
            className={`transition-colors ${bookmarked ? '' : 'text-t3 hover:text-t'}`}
            style={bookmarked ? { color: 'var(--warn)' } : undefined}
          >
            {bookmarked ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}
          </button>
          <div
            data-tour="timer"
            className="flex items-center gap-1.5 font-mono text-sm px-2 py-0.5 rounded border border-line surface-inset tabular"
            style={problem.duration && timer > problem.duration * 60 * 0.85 ? { color: 'var(--err)' } : { color: 'var(--t2)' }}
          >
            <Clock size={13} />
            {fmtTime(timer)}
            {problem.duration && <span className="text-t4">/{fmtTime(problem.duration * 60)}</span>}
          </div>
          {tabSwitches > 0 && (
            <span className="flex items-center gap-1 text-xs border border-line px-2 py-0.5 rounded tabular" style={{ color: 'var(--warn)', background: 'color-mix(in srgb, var(--warn) 12%, transparent)' }}>
              <AlertTriangle size={11} /> {tabSwitches} switches
            </span>
          )}
          {isTestMode && (
            <span className="flex items-center gap-1 text-[11px] border border-line px-2 py-0.5 rounded" style={{ color: 'var(--d-purple)', background: 'color-mix(in srgb, var(--d-purple) 12%, transparent)' }}>
              <ShieldCheck size={11} /> Proctored
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 flex-1 mx-6">
        </div>

        <div className="flex items-center gap-2">
          {isTestMode && (
            <button onClick={isFullscreen ? exitFullscreen : requestFullscreen} className="text-t3 hover:text-t transition-colors">
              {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>
          )}
        </div>
      </header>

      {/* Mobile panel switcher (phones/tablets) */}
      <div className="lg:hidden flex border-b border-line bg-surface-h flex-shrink-0">
        {[['problem', 'Problem'], ['code', 'Code & Run']].map(([v, label]) => (
          <button key={v} onClick={() => setMobileView(v)}
            className="flex-1 py-2.5 text-[13px] font-medium border-b-2 transition-colors"
            style={mobileView === v
              ? { color: 'var(--brand)', borderColor: 'var(--brand-solid)' }
              : { color: 'var(--t3)', borderColor: 'transparent' }}>
            {label}
          </button>
        ))}
      </div>

      {/* MAIN */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT PANEL */}
        <div data-tour="statement"
          className={`w-full lg:w-[44%] lg:min-w-[300px] lg:max-w-[560px] ${mobileView === 'problem' ? 'flex' : 'hidden'} lg:flex flex-col border-r border-line overflow-hidden`}>
          <div className="flex border-b border-line bg-surface-h flex-shrink-0">
            <TabBtn label="Statement" active={activeTab === 'statement' && !showResult} onClick={() => { setActiveTab('statement'); setShowResult(false) }} />
            <TabBtn label="AI Help"   active={activeTab === 'aihelp'   && !showResult} onClick={() => { setActiveTab('aihelp');   setShowResult(false) }} />
            <TabBtn dataTour="history" label="History" active={activeTab === 'history'  && !showResult} onClick={() => { setActiveTab('history');  setShowResult(false) }} />
            {showResult && <TabBtn label="Result" active={showResult} onClick={() => setShowResult(true)} variant="result" />}
          </div>

          <div className={`flex-1 overflow-hidden ${activeTab === 'aihelp' && !showResult ? 'flex flex-col' : 'overflow-y-auto'}`}>
            {activeTab === 'statement' && !showResult && (
              <div className="flex flex-col">
                <div className="px-4 pt-3 pb-2 border-b border-line">
                  <button
                    data-tour="ai-tutor"
                    onClick={() => setActiveTab('aihelp')}
                    className="flex items-center gap-2 text-sm text-brand hover:opacity-80 transition-colors group"
                  >
                    <Sparkles size={14} />
                    <span className="font-medium">Switch to AI Tutor Mode</span>
                    <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                    <span className="text-[10px] text-white px-1.5 py-0.5 rounded font-bold tracking-wide" style={{ background: 'var(--d-orange)' }}>NEW</span>
                  </button>
                </div>
                <ProblemStatement problem={problem} liked={liked} setLiked={setLiked} />
              </div>
            )}
            {showResult && result && (
              <div className="p-4"><SubmissionResult result={result} problem={problem} /></div>
            )}
            {activeTab === 'aihelp' && !showResult && (
              <AiHelpPanel
                problem={problem}
                messages={aiMessages}
                question={aiQuestion}
                setQuestion={setAiQuestion}
                onSend={sendAiMessage}
                loading={aiLoading}
              />
            )}
            {activeTab === 'history' && !showResult && (
              <SubmissionHistory
                problemId={Number(problemId)}
                onLoadCode={(c) => {
                  setCode(c)
                  setActiveTab('statement')
                  setShowResult(false)
                  toast.success('Loaded that submission into the editor')
                }}
              />
            )}
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className={`flex-1 ${mobileView === 'code' ? 'flex' : 'hidden'} lg:flex flex-col overflow-hidden min-w-0`}>
          <div className="flex items-center justify-between px-3 h-10 border-b border-line bg-surface-h flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-t2 cursor-default select-none font-medium">
                <span className="w-2 h-2 rounded-full inline-block" style={{ background: 'var(--info)' }} />
                Python
              </div>
              <span className="text-[11px] text-t4 hidden sm:inline tabular">
                {saveState === 'saving' ? 'Saving…' : '✓ Saved'}
              </span>
            </div>
            <div data-tour="editor-tools" className="flex items-center gap-1.5">
              <button
                onClick={() => setTourOpen(true)}
                title="Take a guided tour of the editor"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-line text-t3 hover:text-brand hover:border-line-strong transition-colors text-xs font-medium"
              >
                <HelpCircle size={13} /> <span className="hidden sm:inline">Guide</span>
              </button>
              <IconBtn icon={<Settings size={14} />} tooltip="Editor settings" onClick={() => setShowSettings(true)} />
              <IconBtn
                icon={isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                tooltip={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                onClick={isFullscreen ? exitFullscreen : requestFullscreen}
              />
              <div className="w-px h-4 bg-line mx-1" />
              <button
                data-tour="submit"
                onClick={() => handleSubmit(true)}
                disabled={submitting}
                className="btn-primary btn-sm ml-1"
              >
                {submitting
                  ? <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <Send size={12} />}
                {submitting ? 'Submitting…' : 'Submit'}
              </button>
            </div>
          </div>

          <div data-tour="editor" className="flex-1 overflow-hidden">
            <Editor
              height="100%"
              language="python"
              value={code}
              onChange={(v) => { setCode(v || ''); clearMarkers() }}
              theme={isDark ? 'vs-dark' : 'light'}
              onMount={(editor, monaco) => {
                editorRef.current = editor
                monacoRef.current = monaco
                setEditorReady(true)
                editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => stateRef.current.handleRun?.())
                editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Enter, () => stateRef.current.handleSubmit?.(true))
                editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
                  try { localStorage.setItem(`cf_code_${stateRef.current.problemId}`, stateRef.current.code) } catch { /* ignore */ }
                  setSaveState('saved'); toast.success('Draft saved')
                })
              }}
              options={{
                automaticLayout: true,   // keep the editor sized to its container (fixes mobile/remount width)
                fontSize: prefs.fontSize,
                tabSize: prefs.tabSize,
                fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                wordWrap: prefs.wordWrap ? 'on' : 'off',
                lineNumbers: prefs.relativeLines ? 'relative' : 'on',
                renderLineHighlight: 'line',
                suggestOnTriggerCharacters: true,
                padding: { top: 10, bottom: 10 },
                smoothScrolling: true,
              }}
            />
          </div>
          {prefs.vim && <div ref={vimStatusRef} className="px-3 py-0.5 text-[11px] font-mono text-t4 bg-surface-h border-t border-line flex-shrink-0" />}

          {/* Run / self-check panel — never grades */}
          <div className="border-t border-line bg-surface-h flex-shrink-0">
            <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 pl-2 pr-2 min-h-[2.75rem] py-1 border-b border-line">
              <div className="flex items-center gap-1 min-w-0">
                <RunSubTab dataTour="sample-tests" label="Sample Tests" active={runMode === 'samples'} onClick={() => setRunMode('samples')} />
                <RunSubTab dataTour="console" label="Console" active={runMode === 'console'} onClick={() => setRunMode('console')} />
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {runMode === 'samples' && sampleRun?.status === 'ok' && (
                  <span className="hidden sm:inline text-[11px] tabular font-medium"
                    style={{ color: sampleRun.results.every(r => r.passed) ? 'var(--ok)' : 'var(--err)' }}>
                    {sampleRun.results.filter(r => r.passed).length}/{sampleRun.results.length} passed
                  </span>
                )}
                <button onClick={handleVisualize} className="btn-secondary btn-sm" title="Visualize code execution">
                  <Eye size={12} /> <span className="hidden sm:inline">Visualize</span>
                </button>
                <button onClick={handleMemcheck} disabled={memcheck === 'loading'} className="btn-secondary btn-sm" title="Check your code for common mistakes — undefined names, unused variables, and runtime errors">
                  <ShieldCheck size={12} /> <span className="hidden sm:inline">{memcheck === 'loading' ? 'Checking…' : 'Code check'}</span>
                </button>
                {(() => {
                  const busy = runMode === 'console' ? runner.status === 'compiling' : running
                  const label = runMode === 'console'
                    ? (busy ? 'Compiling…' : (runner.status === 'running' ? 'Restart' : 'Run'))
                    : (busy ? 'Running…' : 'Run')
                  return (
                    <button data-tour="run" onClick={handleRun} disabled={busy} className="btn-primary btn-sm">
                      {busy
                        ? <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        : <Play size={12} fill="currentColor" />}
                      {label}
                    </button>
                  )
                })()}
                <button
                  onClick={() => setCustomInputOpen(o => !o)}
                  className="text-t4 hover:text-t3 transition-colors p-1 ml-0.5"
                  title={customInputOpen ? 'Collapse panel' : 'Expand panel'}
                >
                  {customInputOpen ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                </button>
              </div>
            </div>

            {customInputOpen && (
              <div className="px-3 py-3">
                {runMode === 'console' ? (
                  <InteractiveConsole
                    status={runner.status}
                    output={runner.output}
                    exitCode={runner.exitCode}
                    onRun={() => { if (code.trim()) runner.start(code); else toast.error('Write some code first!') }}
                    onStop={runner.stop}
                    onSend={runner.sendInput}
                  />
                ) : (
                  <div className="max-h-[34vh] overflow-y-auto">
                    <SampleTestsPanel run={sampleRun} samples={visibleSamples} />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    </>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function TabBtn({ label, active, onClick, variant, dataTour }) {
  const activeStyle = variant === 'result'
    ? { color: 'var(--ok)', borderColor: 'var(--ok)' }
    : { color: 'var(--t)', borderColor: 'var(--brand)' }
  return (
    <button
      data-tour={dataTour}
      onClick={onClick}
      className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
        active ? '' : 'border-transparent text-t4 hover:text-t2'
      }`}
      style={active ? activeStyle : undefined}
    >
      {label}
    </button>
  )
}

function IconBtn({ icon, tooltip, onClick }) {
  return (
    <button
      onClick={onClick}
      title={tooltip}
      className="p-1.5 text-t3 hover:text-t hover:bg-surface-h rounded transition-colors"
    >
      {icon}
    </button>
  )
}

function EditorSettingsModal({ open, prefs, setPrefs, onClose }) {
  if (!open) return null
  const upd = (k, v) => setPrefs(p => ({ ...p, [k]: v }))
  const Toggle = ({ k, label, desc }) => (
    <label className="flex items-center justify-between gap-3 rounded-lg border border-line surface-inset px-3 py-2.5 cursor-pointer">
      <span><span className="text-[13px] text-t font-medium">{label}</span>{desc && <span className="block text-[11px] text-t4">{desc}</span>}</span>
      <input type="checkbox" checked={prefs[k]} onChange={e => upd(k, e.target.checked)} className="accent-[color:var(--brand)] w-4 h-4" />
    </label>
  )
  return (
    <Modal open onClose={onClose} title="Editor settings" size="sm">
      <div className="space-y-4">
        <div>
          <label className="label">Font size · {prefs.fontSize}px</label>
          <input type="range" min={11} max={22} value={prefs.fontSize} onChange={e => upd('fontSize', Number(e.target.value))} className="w-full accent-[color:var(--brand)]" />
        </div>
        <div>
          <label className="label">Tab width</label>
          <div className="flex gap-2">
            {[2, 4, 8].map(n => (
              <button key={n} onClick={() => upd('tabSize', n)} className={prefs.tabSize === n ? 'tab-active' : 'tab-inactive'}>{n} spaces</button>
            ))}
          </div>
        </div>
        <Toggle k="relativeLines" label="Relative line numbers" desc="Show line distances from the cursor" />
        <Toggle k="wordWrap" label="Word wrap" />
        <Toggle k="vim" label="Vim mode" desc="Modal editing with a status bar" />
        <div className="flex justify-between pt-1">
          <button className="btn-ghost btn-sm" onClick={() => setPrefs({ ...DEFAULT_PREFS })}>Reset to defaults</button>
          <button className="btn-primary btn-sm" onClick={onClose}>Done</button>
        </div>
      </div>
    </Modal>
  )
}

// ── Submission history ──────────────────────────────────────────────────────────

function SubmissionHistory({ problemId, onLoadCode }) {
  const [list, setList] = useState(null)
  const [openId, setOpenId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  useEffect(() => {
    let alive = true
    api.get(`/submissions?problem_id=${problemId}`)
      .then(r => { if (alive) setList(r.data) })
      .catch(() => { if (alive) setList([]) })
    return () => { alive = false }
  }, [problemId])

  const toggle = async (id) => {
    if (openId === id) { setOpenId(null); return }
    setOpenId(id); setDetail(null); setLoadingDetail(true)
    try { const { data } = await api.get(`/submissions/${id}`); setDetail(data) }
    catch { setDetail(null) }
    finally { setLoadingDetail(false) }
  }

  const scoreColor = (n) => (n >= 100 ? 'var(--ok)' : n > 0 ? 'var(--warn)' : 'var(--err)')

  if (list === null) return <div className="p-6"><LoadingSpinner size="sm" text="Loading attempts…" /></div>
  if (list.length === 0) {
    return (
      <div className="p-6 text-center text-t4 text-[13px]">
        No submissions yet. Press <span className="text-t3 font-semibold">Submit</span> to record your first attempt — they'll show up here.
      </div>
    )
  }

  return (
    <div className="p-4 space-y-2">
      <p className="text-[11px] text-t4 mb-1">{list.length} attempt{list.length === 1 ? '' : 's'} · newest first</p>
      {list.map((s) => (
        <div key={s.id} className="rounded-lg border border-line surface-inset overflow-hidden">
          <button
            onClick={() => toggle(s.id)}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-surface-h transition-colors"
          >
            <StatusBadge status={s.status} />
            <span className="text-xs font-semibold tabular" style={{ color: scoreColor(s.score) }}>{s.score}%</span>
            <span className="text-[11px] text-t4 tabular">{s.test_cases_passed}/{s.test_cases_total}</span>
            <span className="ml-auto text-[11px] text-t4 tabular">
              {formatDistanceToNow(new Date(s.submitted_at), { addSuffix: true })}
            </span>
            <ChevronDown size={13} className={`text-t4 transition-transform ${openId === s.id ? 'rotate-180' : ''}`} />
          </button>

          {openId === s.id && (
            <div className="border-t border-line p-3 space-y-2">
              {loadingDetail ? (
                <LoadingSpinner size="sm" />
              ) : detail ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-wider text-t4 font-semibold">Submitted code</span>
                    <button onClick={() => onLoadCode(detail.code)} className="btn-secondary btn-sm">
                      <Copy size={12} /> Load into editor
                    </button>
                  </div>
                  <pre className="font-mono text-xs text-t2 bg-surface-h border border-line rounded p-2 max-h-64 overflow-auto whitespace-pre">
                    {detail.code}
                  </pre>
                </>
              ) : (
                <p className="text-xs text-t4">Could not load this submission.</p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Run panel (self-check, never grades) ────────────────────────────────────────

function RunSubTab({ label, active, onClick, dataTour }) {
  return (
    <button
      data-tour={dataTour}
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
        active ? 'text-t' : 'border-transparent text-t4 hover:text-t2'
      }`}
      style={active ? { borderColor: 'var(--brand)' } : undefined}
    >
      {label}
    </button>
  )
}

function InteractiveConsole({ status, output, exitCode, onRun, onStop, onSend }) {
  const [draft, setDraft] = useState('')
  const scrollRef = useRef(null)
  const inputRef  = useRef(null)

  const running   = status === 'running'
  const compiling = status === 'compiling'
  const idle      = status === 'idle'

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [output, status])

  useEffect(() => {
    if (running && inputRef.current) inputRef.current.focus()
  }, [running])

  const submitLine = () => {
    if (!running) return
    onSend(draft + '\n')   // PTY echoes the typed text back into the stream
    setDraft('')
  }

  return (
    <div className="space-y-2">
      {/* status row */}
      <div className="flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-2">
          {idle && <span className="text-t4">Console ready — press Run. Input is asked line-by-line, like a terminal.</span>}
          {compiling && <span className="text-t4">Starting…</span>}
          {running && (
            <span className="flex items-center gap-1.5" style={{ color: 'var(--ok)' }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--ok)' }} />
              running
            </span>
          )}
          {status === 'exited' && (
            <span style={{ color: exitCode === 0 ? 'var(--ok)' : 'var(--err)' }}>
              {exitCode === 0 ? '✓ exited (code 0)' : `✗ exited (code ${exitCode ?? '?'})`}
            </span>
          )}
          {status === 'error' && <span style={{ color: 'var(--err)' }}>✗ error</span>}
        </div>
        <div className="flex items-center gap-2">
          {running ? (
            <button onClick={onStop} className="px-2 py-0.5 rounded border border-line font-medium" style={{ color: 'var(--err)' }}>
              ■ Stop
            </button>
          ) : (
            <button onClick={onRun} disabled={compiling} className="px-2 py-0.5 rounded border border-line text-t3 hover:text-t hover:border-line-strong transition-colors disabled:opacity-40">
              ▶ {idle ? 'Run' : 'Run again'}
            </button>
          )}
        </div>
      </div>

      {/* terminal */}
      <div
        ref={scrollRef}
        onClick={() => inputRef.current?.focus()}
        className="h-52 overflow-auto surface-inset border border-line rounded px-3 py-2 font-mono text-xs leading-relaxed cursor-text"
      >
        {output
          ? <pre className="whitespace-pre-wrap break-words text-t2 m-0">{output}</pre>
          : (idle || compiling) && <span className="text-t4">{compiling ? 'Compiling your program…' : 'Program output will appear here.'}</span>}

        {running && (
          <div className="flex items-center gap-1.5 mt-0.5">
            <span style={{ color: 'var(--brand)' }}>›</span>
            <input
              ref={inputRef}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submitLine() } }}
              placeholder="type input + Enter"
              className="flex-1 bg-transparent outline-none border-0 p-0 text-t placeholder-t4 font-mono text-xs"
              autoComplete="off"
              spellCheck="false"
            />
          </div>
        )}
      </div>
    </div>
  )
}

function SampleTestsPanel({ run, samples }) {
  if (!run) {
    return (
      <div className="text-center py-6 text-xs text-t4">
        {samples.length === 0
          ? 'No sample cases for this problem — switch to the Console tab.'
          : <>Press <span className="text-t3 font-semibold">Run</span> to check against {samples.length} sample case{samples.length === 1 ? '' : 's'} (not graded).</>}
      </div>
    )
  }
  if (run.status === 'Compilation Error') {
    return (
      <pre
        className="text-xs font-mono border rounded-lg p-3 overflow-x-auto whitespace-pre-wrap"
        style={{ color: 'var(--err)', background: 'color-mix(in srgb, var(--err) 5%, transparent)', borderColor: 'color-mix(in srgb, var(--err) 20%, transparent)' }}
      >
        {run.error || 'Compilation failed'}
      </pre>
    )
  }
  if (run.status === 'Error') {
    return <p className="text-xs" style={{ color: 'var(--err)' }}>{run.error}</p>
  }
  const passedCount = run.results.filter(r => r.passed).length
  const allPass = passedCount === run.results.length
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2 text-xs">
        <span className="font-semibold" style={{ color: allPass ? 'var(--ok)' : 'var(--err)' }}>
          {allPass ? '✓ All samples passed' : `${passedCount}/${run.results.length} samples passed`}
        </span>
        <span className="text-t4">· not graded — press Submit to score</span>
      </div>
      {run.results.map((r, i) => <SampleCaseRow key={r.id ?? i} r={r} index={i} />)}
    </div>
  )
}

// Compare expected vs actual line/char-by-char; highlight where "yours" diverges.
function buildDiff(expected, actual) {
  const e = (expected ?? '').split('\n')
  const a = (actual ?? '').split('\n')
  const rows = []
  let firstDiff = null
  const max = Math.max(e.length, a.length)
  for (let li = 0; li < max; li++) {
    const el = e[li]
    const al = a[li]
    if (al === undefined) { rows.push({ type: 'missing', text: el }); if (!firstDiff) firstDiff = { line: li + 1, col: 1 }; continue }
    if (el === undefined) { rows.push({ type: 'line', segs: [{ t: al, bad: true }] }); if (!firstDiff) firstDiff = { line: li + 1, col: 1 }; continue }
    if (el === al) { rows.push({ type: 'line', segs: [{ t: al, bad: false }] }); continue }
    const segs = []
    for (let ci = 0; ci < al.length; ci++) {
      const bad = el[ci] !== al[ci]
      if (bad && !firstDiff) firstDiff = { line: li + 1, col: ci + 1 }
      const last = segs[segs.length - 1]
      if (last && last.bad === bad) last.t += al[ci]
      else segs.push({ t: al[ci], bad })
    }
    if (al.length < el.length && !firstDiff) firstDiff = { line: li + 1, col: al.length + 1 }
    rows.push({ type: 'line', segs })
  }
  return { rows, firstDiff }
}

function DiffActual({ expected, actual, accent }) {
  const { rows, firstDiff } = buildDiff(expected, actual)
  const badStyle = { background: 'color-mix(in srgb, var(--err) 38%, transparent)', borderRadius: 2 }
  return (
    <>
      {firstDiff && (
        <div className="text-[10px] mb-1" style={{ color: accent }}>
          first difference at line {firstDiff.line}, col {firstDiff.col}
        </div>
      )}
      <pre
        className="font-mono text-xs text-t2 rounded px-2 py-1.5 whitespace-pre-wrap break-words max-h-32 overflow-auto border"
        style={{ borderColor: `color-mix(in srgb, ${accent} 25%, transparent)`, background: `color-mix(in srgb, ${accent} 6%, transparent)` }}
      >
        {rows.length === 0 || (rows.length === 1 && !rows[0].segs?.[0]?.t)
          ? <span className="text-t4">(no output)</span>
          : rows.map((row, ri) => (
              <span key={ri}>
                {row.type === 'missing'
                  ? <span className="opacity-60 italic">{row.text || ' '}  ← missing line</span>
                  : row.segs.map((s, si) => (
                      <span key={si} style={s.bad ? badStyle : undefined}>{s.t}</span>
                    ))}
                {ri < rows.length - 1 ? '\n' : ''}
              </span>
            ))}
      </pre>
    </>
  )
}

function SampleCaseRow({ r, index }) {
  const runFailed = r.run_status !== 'ok'
  const ok = r.passed
  const accent = ok ? 'var(--ok)' : 'var(--err)'
  const showDiff = !ok && !runFailed   // ran fine but wrong answer → highlight the diff
  return (
    <div
      className="rounded-lg border overflow-hidden"
      style={{ borderColor: `color-mix(in srgb, ${accent} 22%, transparent)`, background: `color-mix(in srgb, ${accent} 4%, transparent)` }}
    >
      <div className="flex items-center gap-2 px-3 py-1.5 border-b" style={{ borderColor: `color-mix(in srgb, ${accent} 15%, transparent)` }}>
        {ok ? <CheckCircle size={13} style={{ color: accent }} /> : <XCircle size={13} style={{ color: accent }} />}
        <span className="text-[11px] font-semibold text-t3">Sample {index + 1}</span>
        <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: accent }}>
          {runFailed ? r.run_status : (ok ? 'Passed' : 'Failed')}
        </span>
        <span className="ml-auto text-[10px] text-t4 tabular">
          {r.time_ms != null && `${r.time_ms.toFixed(1)} ms`}{r.mem_kb != null && ` · ${fmtMem(r.mem_kb)}`}
        </span>
      </div>

      <div className="px-3 pt-2">
        <div className="text-[10px] text-t4 font-semibold uppercase tracking-wider mb-1">Input</div>
        <pre className="font-mono text-xs text-t2 surface-inset border border-line rounded px-2 py-1.5 whitespace-pre-wrap break-words max-h-24 overflow-auto">
          {r.input || '(none)'}
        </pre>
      </div>

      <div className="grid grid-cols-2 gap-2 p-3 pt-2">
        <div>
          <div className="text-[10px] text-t4 font-semibold uppercase tracking-wider mb-1">Expected Output</div>
          <pre className="font-mono text-xs text-t2 surface-inset border border-line rounded px-2 py-1.5 whitespace-pre-wrap break-words max-h-32 overflow-auto">
            {r.expected || '(empty)'}
          </pre>
        </div>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: accent }}>Your Output</div>
          {showDiff ? (
            <DiffActual expected={r.expected} actual={r.actual} accent={accent} />
          ) : (
            <pre
              className="font-mono text-xs rounded px-2 py-1.5 whitespace-pre-wrap break-words max-h-32 overflow-auto border"
              style={{ color: accent, borderColor: `color-mix(in srgb, ${accent} 25%, transparent)`, background: `color-mix(in srgb, ${accent} 6%, transparent)` }}
            >
              {runFailed ? (r.run_status + (r.actual ? '\n' + r.actual : '')) : (r.actual || '(no output)')}
            </pre>
          )}
        </div>
      </div>
    </div>
  )
}

function ProblemStatement({ problem: p, liked, setLiked }) {
  const visibleTCs = p.test_cases?.filter(tc => !tc.is_hidden) || []
  const copyText   = (text) => { navigator.clipboard.writeText(text); toast.success('Copied!') }

  return (
    <div className="px-4 py-4 space-y-5">
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className="text-[11px] font-semibold px-2 py-0.5 rounded border border-line"
          style={p.difficulty === 'easy'
            ? { color: 'var(--ok)', background: 'color-mix(in srgb, var(--ok) 12%, transparent)' }
            : p.difficulty === 'hard'
            ? { color: 'var(--err)', background: 'color-mix(in srgb, var(--err) 12%, transparent)' }
            : { color: 'var(--warn)', background: 'color-mix(in srgb, var(--warn) 12%, transparent)' }}
        >
          {p.difficulty?.charAt(0).toUpperCase() + p.difficulty?.slice(1)}
        </span>
        {p.topics && (
          <span className="text-[11px] border border-line px-2 py-0.5 rounded" style={{ color: 'var(--info)', background: 'color-mix(in srgb, var(--info) 12%, transparent)' }}>
            {p.topics}
          </span>
        )}
        {p.duration && (
          <span className="text-[11px] border border-line px-2 py-0.5 rounded flex items-center gap-1" style={{ color: 'var(--info)', background: 'color-mix(in srgb, var(--info) 12%, transparent)' }}>
            <Clock size={10} /> {p.duration} min
          </span>
        )}
      </div>

      <div>
        <h2 className="h3 mb-3">{p.title}</h2>
        <p className="text-sm text-t2 whitespace-pre-wrap leading-relaxed">{p.description}</p>
      </div>

      {visibleTCs.length > 0 && (
        <div className="space-y-3">
          {visibleTCs.map((tc, i) => (
            <div key={tc.id} className="rounded-lg border border-line surface-inset overflow-hidden">
              <div className="px-3 py-1.5 text-[11px] font-semibold text-t3 border-b border-line">
                Sample {i + 1}:
              </div>
              <div className="grid grid-cols-2 divide-x divide-[var(--b)]">
                <div className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] text-t4 font-medium">Input</span>
                    <button onClick={() => copyText(tc.input_data || '')} className="text-t4 hover:text-t3 transition-colors">
                      <Copy size={11} />
                    </button>
                  </div>
                  <pre className="text-sm text-t2 font-mono leading-relaxed">{tc.input_data || '(none)'}</pre>
                </div>
                <div className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] text-t4 font-medium">Output</span>
                    <button onClick={() => copyText(tc.expected_output)} className="text-t4 hover:text-t3 transition-colors">
                      <Copy size={11} />
                    </button>
                  </div>
                  <pre className="text-sm text-t2 font-mono leading-relaxed">{tc.expected_output}</pre>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-lg surface-inset border border-line p-3 text-xs text-t3 space-y-1">
        <p>• Write your solution in Python using <code className="text-brand">print()</code> / <code className="text-brand">input()</code></p>
        <p>• Time limit: 5 seconds per test case</p>
        {p.test_cases_count > 0 && <p>• {p.test_cases_count} total test cases (some may be hidden)</p>}
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-line">
        <span className="text-xs text-t4">Did you like the problem?</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setLiked(liked === 'up' ? null : 'up')}
            className={`p-1.5 rounded transition-colors ${liked === 'up' ? '' : 'text-t4 hover:text-t2'}`}
            style={liked === 'up' ? { color: 'var(--ok)', background: 'color-mix(in srgb, var(--ok) 12%, transparent)' } : undefined}
          >
            <ThumbsUp size={14} />
          </button>
          <button
            onClick={() => setLiked(liked === 'down' ? null : 'down')}
            className={`p-1.5 rounded transition-colors ${liked === 'down' ? '' : 'text-t4 hover:text-t2'}`}
            style={liked === 'down' ? { color: 'var(--err)', background: 'color-mix(in srgb, var(--err) 12%, transparent)' } : undefined}
          >
            <ThumbsDown size={14} />
          </button>
          <button
            onClick={() => toast('Comments coming soon!')}
            className="p-1.5 rounded text-t4 hover:text-t2 transition-colors"
          >
            <MessageSquare size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

function AiHelpPanel({ messages, question, setQuestion, onSend, loading }) {
  const bottomRef = useRef(null)
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="px-4 py-3 border-b border-line flex items-center gap-2 flex-shrink-0">
        <Sparkles size={15} className="text-brand" />
        <div>
          <p className="text-sm font-semibold text-t">AI Tutor</p>
          <p className="text-[11px] text-t4">Ask questions about this problem</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-8 space-y-2">
            <Sparkles size={28} className="text-brand/40 mx-auto" />
            <p className="text-sm text-t4">Need a hint? Ask the AI tutor!</p>
            <div className="flex flex-col gap-1.5 mt-3">
              {['Give me a hint for this problem', 'What data structure should I use?', 'Explain the approach step by step'].map(q => (
                <button
                  key={q}
                  onClick={() => setQuestion(q)}
                  className="text-xs text-brand hover:opacity-80 border border-line hover:border-line-strong rounded px-3 py-1.5 transition-colors text-left"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                m.role === 'user'
                  ? 'text-white rounded-br-sm'
                  : 'surface-inset text-t2 border border-line rounded-bl-sm'
              }`}
              style={m.role === 'user' ? { background: 'var(--brand-solid)' } : undefined}
            >
              {m.role === 'ai' && (
                <div className="flex items-center gap-1 mb-1">
                  <Sparkles size={11} className="text-brand" />
                  <span className="text-[10px] text-brand font-semibold">AI Tutor</span>
                </div>
              )}
              {m.role === 'ai' ? <Markdown text={m.text} /> : m.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="surface-inset border border-line rounded-xl rounded-bl-sm px-3 py-2">
              <div className="flex gap-1 items-center">
                <span className="w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:0ms]" style={{ background: 'var(--brand)' }} />
                <span className="w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:150ms]" style={{ background: 'var(--brand)' }} />
                <span className="w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:300ms]" style={{ background: 'var(--brand)' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="px-3 pb-3 border-t border-line pt-2 flex-shrink-0">
        <div className="flex gap-2">
          <input
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend() } }}
            placeholder="Ask a question about this problem..."
            className="flex-1 surface-inset border border-line rounded-lg px-3 py-2 text-sm text-t2 placeholder-t4 focus:outline-none focus:border-line-strong"
          />
          <button
            onClick={onSend}
            disabled={loading || !question.trim()}
            className="btn-primary px-3 py-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

function SubmissionResult({ result, problem }) {
  const [expanded, setExpanded] = useState({})
  const toggle = (i) => setExpanded(p => ({ ...p, [i]: !p[i] }))

  const pct = result.total ? Math.round((result.passed / result.total) * 100) : 0
  return (
    <div className="space-y-4">
      <div
        className="rounded-xl border p-4"
        style={result.status === 'Accepted'
          ? { borderColor: 'color-mix(in srgb, var(--ok) 30%, transparent)', background: 'color-mix(in srgb, var(--ok) 8%, transparent)' }
          : { borderColor: 'color-mix(in srgb, var(--err) 30%, transparent)', background: 'color-mix(in srgb, var(--err) 8%, transparent)' }}
      >
        <div className="flex items-center gap-2 mb-1">
          {result.status === 'Accepted'
            ? <CheckCircle size={18} style={{ color: 'var(--ok)' }} />
            : <XCircle    size={18} style={{ color: 'var(--err)' }} />}
          <span className="font-bold text-base" style={{ color: result.status === 'Accepted' ? 'var(--ok)' : 'var(--err)' }}>
            {result.status}
          </span>
        </div>
        <p className="text-xs text-t3 tabular">{result.passed}/{result.total} test cases passed · Score: {result.score}%</p>
      </div>
      <div>
        <div className="flex justify-between text-xs text-t3 mb-1.5 tabular"><span>Test Cases</span><span>{pct}%</span></div>
        <div className="h-1.5 rounded-full surface-inset overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700" style={{
            width: `${pct}%`,
            background: pct === 100 ? 'var(--ok)' : pct > 50 ? 'var(--warn)' : 'var(--err)',
          }} />
        </div>
      </div>
      {result.error && (
        <pre
          className="text-xs font-mono border rounded-lg p-3 overflow-x-auto whitespace-pre-wrap"
          style={{ color: 'var(--err)', background: 'color-mix(in srgb, var(--err) 5%, transparent)', borderColor: 'color-mix(in srgb, var(--err) 20%, transparent)' }}
        >
          {result.error}
        </pre>
      )}
      <div className="space-y-1.5">
        {result.results?.map((r, i) => {
          const tc = problem?.test_cases?.find(t => t.id === r.test_case_id)
          const canExpand = !r.is_hidden && tc
          const isExpanded = expanded[i]

          return (
            <div
              key={i}
              className="rounded-lg border overflow-hidden transition-colors"
              style={{
                borderColor: r.status === 'Passed'
                  ? 'color-mix(in srgb, var(--ok) 15%, transparent)'
                  : 'color-mix(in srgb, var(--err) 15%, transparent)',
                background: r.status === 'Passed'
                  ? 'color-mix(in srgb, var(--ok) 5%, transparent)'
                  : 'color-mix(in srgb, var(--err) 5%, transparent)'
              }}
            >
              <div
                className={`flex items-center gap-3 p-2.5 ${canExpand ? 'cursor-pointer hover:bg-black/5 dark:hover:bg-white/5' : ''}`}
                onClick={() => canExpand && toggle(i)}
              >
                {r.status === 'Passed'
                  ? <CheckCircle size={13} className="flex-shrink-0" style={{ color: 'var(--ok)' }} />
                  : <XCircle    size={13} className="flex-shrink-0" style={{ color: 'var(--err)' }} />}
                <span className="text-xs text-t3 tabular flex-1">Case #{i + 1}{r.is_hidden ? ' (hidden)' : ''}</span>
                <StatusBadge status={r.status} />
                {r.execution_time != null && (
                  <span className="text-xs text-t4 w-12 text-right tabular">{r.execution_time.toFixed(1)}ms</span>
                )}
                {canExpand && (
                  <ChevronDown size={14} className={`text-t4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                )}
              </div>
              
              {canExpand && isExpanded && (
                <div className="p-3 border-t text-xs grid gap-3" style={{ background: 'var(--bg)', borderColor: 'inherit' }}>
                  <div>
                    <div className="text-[10px] text-t4 font-semibold uppercase tracking-wider mb-1">Input</div>
                    <pre className="font-mono text-t2 bg-surface-h border border-line rounded px-2 py-1.5 whitespace-pre-wrap">{tc.input_data}</pre>
                  </div>
                  <div>
                    <div className="text-[10px] text-t4 font-semibold uppercase tracking-wider mb-1">Expected Output</div>
                    <pre className="font-mono text-t2 bg-surface-h border border-line rounded px-2 py-1.5 whitespace-pre-wrap">{tc.expected_output}</pre>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: r.status === 'Passed' ? 'var(--ok)' : 'var(--err)' }}>Actual Output</div>
                    <pre className="font-mono rounded px-2 py-1.5 whitespace-pre-wrap border" style={{ color: r.status === 'Passed' ? 'var(--ok)' : 'var(--err)', borderColor: r.status === 'Passed' ? 'color-mix(in srgb, var(--ok) 30%, transparent)' : 'color-mix(in srgb, var(--err) 30%, transparent)' }}>{r.actual_output || '(no output)'}</pre>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Visualize Code Modal — step-through execution debugger ──────────────────────
const PRINT_RE = /\bprint\s*\(/

// Plain-English description of what a source line does + which variables changed.
function explainStep(step, prevLocals, srcLine) {
  const src = (srcLine || '').trim()
  let what = 'Runs this statement.'
  if (/^for\b/.test(src)) what = 'for-loop header — iterates over each item in the sequence.'
  else if (/^while\b/.test(src)) what = 'while-loop — keeps repeating while the condition is true.'
  else if (/^elif\b/.test(src)) what = 'elif — tests another condition.'
  else if (/^if\b/.test(src)) what = 'if statement — evaluates a condition to choose a branch.'
  else if (/^else\b/.test(src)) what = 'else branch — runs because the earlier condition was false.'
  else if (/^def\b/.test(src)) what = 'Defines a function.'
  else if (/^class\b/.test(src)) what = 'Defines a class.'
  else if (/^(import|from)\b/.test(src)) what = 'Imports a module.'
  else if (/\binput\s*\(/.test(src)) what = 'Reads a line of input from stdin.'
  else if (PRINT_RE.test(src)) what = 'Prints text to the program output.'
  else if (/^return\b/.test(src)) what = 'Returns a value and exits the function.'
  else if (/[^=!<>+\-*/%]=[^=]/.test(src)) what = 'Assignment — stores a value into a variable.'
  else if (/\w+\s*\(.*\)\s*$/.test(src)) what = 'Calls a function.'
  const changes = []
  const locals = step?.locals || {}
  for (const k of Object.keys(locals)) {
    if (!(k in prevLocals)) changes.push(`${k} = ${locals[k]}`)
    else if (String(prevLocals[k]) !== String(locals[k])) changes.push(`${k}: ${prevLocals[k]} → ${locals[k]}`)
  }
  return { what, changes }
}

// Python's repr prints lists as "[1, 2, 3]" (and nested lists as "[[..], [..]]")
const isArrayVal = (v) => typeof v === 'string' && v.trim().startsWith('[') && v.trim().endsWith(']')

function parseCells(str) {
  const inner = String(str).trim().slice(1, -1)
  const parts = []
  let depth = 0, buf = ''
  for (const ch of inner) {
    if (ch === '[') { depth++; buf += ch }
    else if (ch === ']') { depth--; buf += ch }
    else if (ch === ',' && depth === 0) { parts.push(buf.trim()); buf = '' }
    else buf += ch
  }
  if (buf.trim() !== '') parts.push(buf.trim())
  const out = []
  for (const p of parts) {
    const m = p.match(/^(.*?)\s*<repeats (\d+) times>$/)
    if (m) { const n = Math.min(parseInt(m[2], 10), 100); for (let k = 0; k < n; k++) out.push(m[1]) }
    else out.push(p)
    if (out.length > 256) break
  }
  if (out.length && out[out.length - 1] === '') out.pop()  // drop trailing comma artifact
  return out
}

// Which indices of array `name` are touched by the current source line (A[i], A[3], A[i+1])
function accessedIndices(srcLine, name, locals) {
  const set = new Set()
  try {
    const re = new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\[([^\\]]+)\\]', 'g')
    let m
    while ((m = re.exec(srcLine)) !== null) {
      const e = m[1].trim()
      let val = null
      if (/^\d+$/.test(e)) val = parseInt(e, 10)
      else if (locals[e] != null && /^-?\d+$/.test(String(locals[e]).trim())) val = parseInt(locals[e], 10)
      else {
        const mm = e.match(/^([A-Za-z_]\w*)\s*([+\-])\s*(\d+)$/)
        if (mm && locals[mm[1]] != null && /^-?\d+$/.test(String(locals[mm[1]]).trim()))
          val = parseInt(locals[mm[1]], 10) + (mm[2] === '+' ? 1 : -1) * parseInt(mm[3], 10)
      }
      if (val != null && val >= 0) set.add(val)
    }
  } catch { /* ignore */ }
  return set
}

function ArrayCells({ value, prevValue, accessed }) {
  const cells = parseCells(value)
  const is2D = cells.length > 0 && cells.every(c => c.trim().startsWith('['))
  const prevCells = isArrayVal(prevValue || '') ? parseCells(prevValue) : []

  const Cell = ({ v, i, changed, acc }) => (
    <div className="flex flex-col items-center flex-shrink-0">
      <div className="rounded-md border min-w-[32px] px-2 py-1 text-center font-mono text-[13px] transition-colors"
        style={acc
          ? { borderColor: 'var(--brand)', background: 'var(--brandGhost)', color: 'var(--brand)', fontWeight: 700 }
          : changed
            ? { borderColor: 'color-mix(in srgb, var(--ok) 50%, transparent)', background: 'color-mix(in srgb, var(--ok) 14%, transparent)', color: 'var(--ok)', fontWeight: 600 }
            : { borderColor: 'var(--b)', background: 'var(--beige-pill)', color: 'var(--t)' }}>
        {v}
      </div>
      {i != null && <span className="text-[9px] text-t4 mt-0.5 tabular">{i}</span>}
    </div>
  )

  if (is2D) {
    return (
      <div className="space-y-1.5">
        {cells.map((row, r) => (
          <div key={r} className="flex items-center gap-1">
            <span className="text-[9px] text-t4 w-4 tabular">{r}</span>
            <div className="flex flex-wrap gap-1">
              {parseCells(row).map((v, c) => <Cell key={c} v={v} i={null} />)}
            </div>
          </div>
        ))}
      </div>
    )
  }
  return (
    <div className="flex flex-wrap gap-1">
      {cells.map((v, i) => (
        <Cell key={i} v={v} i={i} acc={accessed.has(i)} changed={prevCells.length > 0 && String(prevCells[i]) !== String(v)} />
      ))}
    </div>
  )
}

function MemCheckModal({ result, onClose, onRerun }) {
  const loading = result === 'loading'
  const r = loading ? null : result
  const findingColor = (t) => t === 'lint' ? 'var(--warn)' : 'var(--err)'

  return (
    <Modal open onClose={onClose} title="Code check" size="lg">
      {loading ? (
        <div className="py-10 flex items-center justify-center gap-2 text-t3">
          <span className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--brand)', borderTopColor: 'transparent' }} />
          Checking your code…
        </div>
      ) : r.status === 'Compilation Error' ? (
        <div className="space-y-3">
          <p className="text-[13px]" style={{ color: 'var(--err)' }}>{r.note || "Your code didn't compile, so it couldn't be checked."}</p>
          <pre className="surface-inset border border-line rounded-lg p-3 text-[12px] font-mono whitespace-pre-wrap break-words max-h-72 overflow-auto" style={{ color: 'var(--err)' }}>{r.report}</pre>
        </div>
      ) : r.status !== 'ok' ? (
        <p className="text-[13px] text-t3">{r.report || r.status}</p>
      ) : r.clean ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2.5 p-3.5 rounded-xl" style={{ background: 'color-mix(in srgb, var(--ok) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--ok) 35%, transparent)' }}>
            <ShieldCheck size={20} style={{ color: 'var(--ok)' }} />
            <div>
              <p className="text-[14px] font-semibold" style={{ color: 'var(--ok)' }}>No issues found</p>
              <p className="text-[12px] text-t3">No undefined names, unused variables, or runtime errors on this input. Nice and clean. 👏</p>
            </div>
          </div>
          {r.output && (
            <div>
              <p className="label">Program output</p>
              <pre className="surface-inset border border-line rounded-lg p-3 text-[12.5px] font-mono whitespace-pre-wrap" style={{ color: 'var(--ok)' }}>{r.output}</pre>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-[13px] text-t2">{r.findings.length} issue{r.findings.length === 1 ? '' : 's'} found — fix these to clean up your code:</p>
          <div className="space-y-2">
            {r.findings.map((f, i) => (
              <div key={i} className="rounded-lg border p-3" style={{ borderColor: `color-mix(in srgb, ${findingColor(f.type)} 40%, transparent)`, background: `color-mix(in srgb, ${findingColor(f.type)} 9%, transparent)` }}>
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle size={14} style={{ color: findingColor(f.type) }} />
                  <span className="text-[13px] font-semibold capitalize" style={{ color: findingColor(f.type) }}>{f.title}</span>
                  {f.line && <span className="text-[11px] text-t4 ml-auto font-mono">line {f.line}</span>}
                </div>
                <p className="text-[12.5px] text-t2 leading-relaxed">{f.help}</p>
              </div>
            ))}
          </div>
          <details className="text-[12px]">
            <summary className="cursor-pointer text-t4 hover:text-t3">Raw pyflakes report</summary>
            <pre className="surface-inset border border-line rounded-lg p-3 mt-2 text-[11.5px] font-mono whitespace-pre-wrap break-words max-h-60 overflow-auto text-t3">{r.report}</pre>
          </details>
        </div>
      )}

      {!loading && (
        <div className="flex gap-2 mt-4">
          <button className="btn-primary btn-sm" onClick={onRerun}><ShieldCheck size={13} /> Re-check</button>
          <button className="btn-secondary btn-sm" onClick={onClose}>Close</button>
        </div>
      )}
    </Modal>
  )
}

function VisualizeModal({ code: initialCode, defaultInput = '', onClose }) {
  const [input, setInput]   = useState(defaultInput)
  const [loading, setLoading] = useState(false)
  const [trace, setTrace]   = useState(null) // { status, steps, output, error }
  const [idx, setIdx]       = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed]   = useState(900)
  const activeRef = useRef(null)
  const outRef = useRef(null)
  const logRef = useRef(null)
  const lines = initialCode.split('\n')

  const steps = trace?.steps || []
  const cur = steps[idx] || null
  const nextStep = steps[idx + 1] || null
  const prevLocals = idx > 0 ? (steps[idx - 1].locals || {}) : {}

  const run = async () => {
    setLoading(true); setPlaying(false); setTrace(null); setIdx(0)
    try {
      const { data } = await api.post('/submissions/visualize', { code: initialCode, custom_input: input })
      setTrace(data); setIdx(0)
    } catch (err) {
      setTrace({ status: 'Error', steps: [], output: '', error: err.response?.data?.detail || 'Request failed — is the backend running?' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!playing) return
    if (idx >= steps.length - 1) { setPlaying(false); return }
    const t = setTimeout(() => setIdx(i => Math.min(i + 1, steps.length - 1)), speed)
    return () => clearTimeout(t)
  }, [playing, idx, steps.length, speed])

  useEffect(() => { activeRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }) }, [idx, trace])
  useEffect(() => { if (outRef.current) outRef.current.scrollTop = outRef.current.scrollHeight }, [idx])
  useEffect(() => { logRef.current?.querySelector('[data-active]')?.scrollIntoView({ block: 'nearest' }) }, [idx, trace])

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose()
      else if (steps.length) {
        if (e.key === 'ArrowRight') { setPlaying(false); setIdx(i => Math.min(i + 1, steps.length - 1)) }
        else if (e.key === 'ArrowLeft') { setPlaying(false); setIdx(i => Math.max(0, i - 1)) }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, steps.length])

  const revealed = steps.slice(0, idx + 1).filter(s => PRINT_RE.test(lines[s.line - 1] || '')).length
  const outLines = (trace?.output || '').length ? trace.output.split('\n') : []
  const shownOutput = outLines.slice(0, revealed).join('\n')

  const atEnd = idx >= steps.length - 1
  const hasSteps = steps.length > 0
  const isErr = trace && ['Compilation Error', 'NoGDB', 'Error', 'Timeout'].includes(trace.status)
  const stack = cur?.stack ? [...cur.stack].reverse() : []  // outermost (main) first
  const exp = cur ? explainStep(cur, prevLocals, lines[cur.line - 1]) : null
  // Accumulated, line-by-line story of the run up to the current step.
  const log = hasSteps
    ? steps.slice(0, idx + 1).map((s, j) => ({
        n: j, line: s.line,
        exp: explainStep(s, j > 0 ? (steps[j - 1].locals || {}) : {}, lines[s.line - 1]),
      }))
    : []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-[95vw] max-w-7xl h-[92vh] bg-beige-pg border border-line rounded-2xl flex flex-col shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-line bg-surface-h flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-2"><Eye size={16} className="text-brand" /><span className="font-semibold text-t text-sm">Code Visualizer</span></span>
            <span className="hidden sm:flex items-center gap-3 text-[11px] text-t4 ml-2">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: 'var(--brand)' }} /> Current line</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: 'var(--warn)' }} /> Next line</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={run} disabled={loading} className="btn-primary btn-sm disabled:opacity-50">
              {loading ? <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Play size={12} fill="currentColor" />}
              {loading ? 'Tracing…' : (hasSteps ? 'Re-run' : 'Run')}
            </button>
            <button onClick={onClose} className="text-t3 hover:text-t transition-colors p-1 rounded hover:bg-surface-h"><X size={18} /></button>
          </div>
        </div>

        {/* Playback controls */}
        {hasSteps && (
          <div className="flex items-center gap-3 px-5 py-2 border-b border-line bg-beige-pg flex-shrink-0 flex-wrap">
            <div className="flex items-center gap-1">
              <button onClick={() => { setPlaying(false); setIdx(0) }} disabled={idx === 0} title="Start" className="btn-secondary btn-sm">Start</button>
              <button onClick={() => { setPlaying(false); setIdx(i => Math.max(0, i - 1)) }} disabled={idx === 0} title="Previous (←)" className="p-1.5 rounded-lg text-t3 hover:text-t hover:bg-surface-h disabled:opacity-30 transition-colors"><ChevronLeft size={16} /></button>
              <button onClick={() => { if (atEnd) setIdx(0); setPlaying(p => !p) }} className="btn-primary btn-sm w-[88px] justify-center">
                {playing ? <><Pause size={13} /> Pause</> : <><Play size={12} fill="currentColor" /> {atEnd ? 'Replay' : 'Play'}</>}
              </button>
              <button onClick={() => { setPlaying(false); setIdx(i => Math.min(steps.length - 1, i + 1)) }} disabled={atEnd} title="Next (→)" className="p-1.5 rounded-lg text-t3 hover:text-t hover:bg-surface-h disabled:opacity-30 transition-colors"><ChevronRight size={16} /></button>
              <button onClick={() => { setPlaying(false); setIdx(steps.length - 1) }} disabled={atEnd} title="End" className="btn-secondary btn-sm">End</button>
            </div>

            <input type="range" min={0} max={steps.length - 1} value={idx}
              onChange={e => { setPlaying(false); setIdx(Number(e.target.value)) }}
              className="flex-1 min-w-[120px] accent-[color:var(--brand)]" />

            <span className="text-[12px] text-t3 tabular whitespace-nowrap">Step {idx + 1}/{steps.length}</span>

            <div className="flex items-center gap-1 text-[11px]">
              {[['0.5×', 1500], ['1×', 900], ['2×', 400]].map(([l, v]) => (
                <button key={v} onClick={() => setSpeed(v)} className="px-1.5 py-0.5 rounded" style={speed === v ? { background: 'var(--brandL)', color: 'var(--brand)' } : { color: 'var(--t4)' }}>{l}</button>
              ))}
            </div>
          </div>
        )}

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">

          {/* Left column: code (scrolls) on top, output filling the space below */}
          <div className="w-[54%] flex flex-col border-r border-line overflow-hidden">

            {/* Code pane (scrollable) */}
            <div className="flex-1 min-h-0 overflow-auto bg-beige-pg">
              <div className="min-h-full py-3">
                {lines.map((line, i) => {
                  const lineNo = i + 1
                  const isCur = cur && cur.line === lineNo
                  const isNext = !isCur && nextStep && nextStep.line === lineNo
                  const bg = isCur ? 'var(--brandGhost)' : isNext ? 'color-mix(in srgb, var(--warn) 14%, transparent)' : 'transparent'
                  const bc = isCur ? 'var(--brand)' : isNext ? 'var(--warn)' : 'transparent'
                  return (
                    <div key={i} ref={isCur ? activeRef : null} className="flex items-stretch border-l-2 transition-colors" style={{ background: bg, borderColor: bc }}>
                      <span className="select-none text-right pr-4 pl-4 min-w-[3.5rem] text-[11px] leading-6 flex-shrink-0 font-mono"
                        style={isCur ? { color: 'var(--brand)', fontWeight: 700 } : isNext ? { color: 'var(--warn)', fontWeight: 600 } : { color: 'var(--t4)' }}>
                        {lineNo}
                      </span>
                      <pre className="leading-6 whitespace-pre flex-1 font-mono text-sm pr-6" style={{ color: (isCur || isNext) ? 'var(--t)' : 'var(--t2)' }}>
                        {line || ' '}
                      </pre>
                      {isCur && <span className="mr-3 self-center text-[10px] font-sans font-semibold flex-shrink-0" style={{ color: 'var(--brand)' }}>▶ now</span>}
                      {isNext && <span className="mr-3 self-center text-[10px] font-sans font-semibold flex-shrink-0" style={{ color: 'var(--warn)' }}>next</span>}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Output — fills the space under the code, shows input → output, scrolls */}
            <div className="h-[42%] min-h-0 flex flex-col border-t border-line overflow-hidden">
              <div className="px-4 py-2 bg-surface-h border-b border-line flex items-center justify-between flex-shrink-0 gap-2">
                <span className="text-[11px] font-semibold text-t3 uppercase tracking-wide flex items-center gap-2"><Terminal size={12} style={{ color: 'var(--ok)' }} /> Output</span>
                <div className="flex items-center gap-3 min-w-0">
                  {input.trim() && (
                    <span className="text-[11px] text-t4 truncate max-w-[180px]">input: <span className="font-mono text-t3">{input.trim().replace(/\s+/g, ' ')}</span></span>
                  )}
                  <span className="text-[11px] text-t4 tabular flex-shrink-0">{outLines.slice(0, revealed).filter(Boolean).length} line{revealed === 1 ? '' : 's'}</span>
                  {atEnd && trace?.output && (
                    <button onClick={() => navigator.clipboard.writeText(trace.output)} className="flex items-center gap-1 text-[11px] text-t4 hover:text-t3 transition-colors flex-shrink-0"><Copy size={10} /> Copy</button>
                  )}
                </div>
              </div>
              <div ref={outRef} className="flex-1 min-h-0 overflow-auto px-3 py-2 font-mono text-sm">
                {isErr ? (
                  <pre className="text-xs whitespace-pre-wrap break-words" style={{ color: 'var(--err)' }}>
                    {trace.status === 'Timeout' ? 'The program ran too long to trace (an infinite loop?). Simplify it and retry.' : (trace.error || trace.status)}
                  </pre>
                ) : !hasSteps ? (
                  trace?.output ? (
                    <div>
                      {trace.note && <p className="text-[12px] text-t4 font-sans mb-2">{trace.note}</p>}
                      <pre className="whitespace-pre-wrap break-words" style={{ color: 'var(--ok)' }}>{trace.output}</pre>
                    </div>
                  ) : (
                    <p className="text-[13px] text-t4 font-sans">{loading ? 'Tracing…' : 'Output appears here as each print() runs.'}</p>
                  )
                ) : (
                  <div className="leading-relaxed">
                    {/* input → output summary once the run finishes (the "maths" view) */}
                    {atEnd && trace?.output && (
                      <div className="mb-2 px-2.5 py-1.5 rounded-lg font-mono text-[12.5px] whitespace-pre-wrap break-words"
                        style={{ background: 'var(--brandGhost)', color: 'var(--brand)', border: '1px solid color-mix(in srgb, var(--brand) 30%, transparent)' }}>
                        {input.trim() && <span className="text-t3">{input.trim().replace(/\s+/g, ' ')}{'  →  '}</span>}
                        {(trace.output || '').trim().replace(/\s+/g, ' ')}
                      </div>
                    )}
                    {outLines.slice(0, revealed).map((ln, i, arr) => {
                      const fresh = i === arr.length - 1 && cur && PRINT_RE.test(lines[cur.line - 1] || '')
                      return (
                        <div key={i} className="px-2 py-0.5 rounded whitespace-pre-wrap break-words transition-colors"
                          style={fresh ? { background: 'color-mix(in srgb, var(--ok) 20%, transparent)', color: 'var(--ok)', fontWeight: 600 } : { color: 'var(--ok)' }}>
                          {ln === '' ? ' ' : ln}
                        </div>
                      )
                    })}
                    {!atEnd && <span className="animate-pulse px-2" style={{ color: 'var(--brand)' }}>▋</span>}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right column: stdin + explanation + call stack / variables */}
          <div className="w-[46%] flex flex-col overflow-hidden bg-beige-pg">

            {/* stdin */}
            <div className="flex-shrink-0 border-b border-line">
              <div className="px-4 py-1.5 bg-surface-h flex items-center gap-2">
                <Terminal size={12} className="text-t4" />
                <span className="text-[11px] font-semibold text-t3 uppercase tracking-wide">stdin (input)</span>
                <span className="text-[10px] text-t4 ml-auto">auto-filled from sample · edit &amp; Re-run</span>
              </div>
              <textarea value={input} onChange={e => setInput(e.target.value)} placeholder="Program input…"
                className="w-full h-12 bg-beige-pg px-4 py-1.5 text-sm text-t2 font-mono resize-none focus:outline-none placeholder-t4 border-0" />
            </div>

            {/* Execution log — accumulates every step so the whole run reads top-to-bottom */}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden border-b border-line">
              <div className="px-4 py-2 bg-surface-h border-b border-line flex items-center justify-between flex-shrink-0">
                <span className="text-[11px] font-semibold text-t3 uppercase tracking-wide">Execution log</span>
                {hasSteps && <span className="text-[10px] text-t4 tabular">step {idx + 1}/{steps.length}</span>}
              </div>
              <div ref={logRef} className="flex-1 min-h-0 overflow-auto p-2 space-y-1">
                {!hasSteps ? (
                  <p className="text-[13px] text-t4 px-1">{loading ? 'Tracing…' : 'Press Run, then Play — every step is logged here so you can read the whole program line by line. Click any line to jump to it.'}</p>
                ) : log.map((row) => {
                  const active = row.n === idx
                  return (
                    <button key={row.n} data-active={active || undefined}
                      onClick={() => { setPlaying(false); setIdx(row.n) }}
                      className="w-full text-left rounded-lg border px-2.5 py-1.5 transition-colors"
                      style={active
                        ? { borderColor: 'color-mix(in srgb, var(--brand) 45%, transparent)', background: 'var(--brandGhost)' }
                        : { borderColor: 'transparent', background: 'transparent' }}>
                      <div className="flex items-baseline gap-2">
                        <span className="font-mono text-[10px] tabular flex-shrink-0 px-1 rounded"
                          style={{ color: active ? 'var(--brand)' : 'var(--t4)', background: active ? 'color-mix(in srgb, var(--brand) 15%, transparent)' : 'var(--beige-pill)' }}>L{row.line}</span>
                        <span className="text-[12.5px] leading-snug" style={{ color: active ? 'var(--t)' : 'var(--t3)' }}>{row.exp.what}</span>
                      </div>
                      {row.exp.changes.length > 0 && (
                        <div className="font-mono text-[11.5px] mt-0.5 pl-7" style={{ color: 'var(--brand)' }}>→ {row.exp.changes.join(' · ')}</div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Live state: Call stack + Variables (current step) */}
            <div className="h-[42%] min-h-0 flex overflow-hidden">
              {/* Call stack */}
              <div className="w-[38%] flex flex-col overflow-hidden border-r border-line">
                <div className="px-3 py-2 bg-surface-h border-b border-line flex-shrink-0">
                  <span className="text-[11px] font-semibold text-t3 uppercase tracking-wide">Call stack</span>
                </div>
                <div className="flex-1 overflow-auto p-2 space-y-1">
                  {!hasSteps ? <p className="text-[12px] text-t4 px-1">—</p> : stack.map((f, i) => {
                    const innermost = i === stack.length - 1
                    return (
                      <div key={i} className="rounded-lg border px-2.5 py-1.5"
                        style={innermost ? { borderColor: 'color-mix(in srgb, var(--brand) 40%, transparent)', background: 'var(--brandGhost)' } : { borderColor: 'var(--b)', background: 'var(--beige-pill)' }}>
                        <p className="font-mono text-[12px] font-semibold truncate" style={{ color: innermost ? 'var(--brand)' : 'var(--t2)' }}>{f.func}()</p>
                        <p className="text-[10px] text-t4 tabular">line {f.line}</p>
                      </div>
                    )
                  })}
                </div>
              </div>
              {/* Variables */}
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="px-3 py-2 bg-surface-h border-b border-line flex-shrink-0 flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-t3 uppercase tracking-wide">Variables</span>
                  {cur && <span className="text-[10px] text-t4 ml-auto font-mono">{cur.func}()</span>}
                </div>
                <div className="flex-1 overflow-auto p-2">
                  {!hasSteps ? (
                    <p className="text-[13px] text-t4 px-1">{loading ? 'Tracing…' : (trace?.note || 'Press Run to watch variables change line-by-line.')}</p>
                  ) : Object.keys(cur?.locals || {}).length === 0 ? (
                    <p className="text-[13px] text-t4 px-1">No variables in scope yet.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {Object.entries(cur.locals).map(([k, v]) => {
                        if (isArrayVal(v)) {
                          const acc = accessedIndices(lines[cur.line - 1] || '', k, cur.locals)
                          return (
                            <div key={k} className="rounded-lg border border-line bg-beige-pill px-2.5 py-2">
                              <div className="flex items-center gap-2 mb-1.5">
                                <span className="font-mono text-[13px] font-semibold text-brand">{k}</span>
                                <span className="text-[10px] text-t4 border border-line rounded px-1">array</span>
                                {acc.size > 0 && <span className="text-[10px] ml-auto" style={{ color: 'var(--brand)' }}>accessing [{[...acc].join(', ')}]</span>}
                              </div>
                              <ArrayCells value={v} prevValue={prevLocals[k]} accessed={acc} />
                            </div>
                          )
                        }
                        const changed = String(prevLocals[k]) !== String(v)
                        return (
                          <div key={k} className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5 transition-colors"
                            style={changed ? { borderColor: 'color-mix(in srgb, var(--brand) 45%, transparent)', background: 'var(--brandGhost)' } : { borderColor: 'var(--b)', background: 'var(--beige-pill)' }}>
                            <span className="font-mono text-[13px] font-semibold" style={{ color: changed ? 'var(--brand)' : 'var(--t2)' }}>{k}</span>
                            <span className="text-t4 text-xs">=</span>
                            <span className="font-mono text-[13px] text-t tabular ml-auto break-all text-right">{v}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
