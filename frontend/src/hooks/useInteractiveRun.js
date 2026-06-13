import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Drives the terminal-style interactive console over a WebSocket.
 *
 * status: 'idle' | 'compiling' | 'running' | 'exited' | 'error'
 * output: the live program stream (program output + echoed input)
 */

// Build the WebSocket URL from the SAME base axios uses (VITE_API_URL),
// so it works whether the frontend is same-origin with the backend or a
// separate static site pointing at a remote API.
function wsEndpoint() {
  const apiBase = import.meta.env.VITE_API_URL || '/api'
  if (/^https?:\/\//i.test(apiBase)) {
    // absolute, e.g. https://my-api.onrender.com/api  ->  wss://my-api.onrender.com/api
    return apiBase.replace(/^http/i, 'ws').replace(/\/$/, '') + '/submissions/run-interactive'
  }
  // relative, e.g. /api  ->  wss://<this-host>/api
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
  const rel = apiBase.startsWith('/') ? apiBase : `/${apiBase}`
  return `${proto}://${window.location.host}${rel}`.replace(/\/$/, '') + '/submissions/run-interactive'
}

export default function useInteractiveRun() {
  const [output, setOutput]   = useState('')
  const [status, setStatus]   = useState('idle')
  const [exitCode, setExitCode] = useState(null)
  const [compileError, setCompileError] = useState(null)
  const wsRef = useRef(null)
  const modeRef = useRef('pty')      // 'pipe' has no terminal echo → echo locally
  const startedRef = useRef(false)   // did we ever receive 'started'?

  const closeWs = () => {
    const ws = wsRef.current
    if (ws) {
      try { ws.onclose = null; ws.close() } catch { /* ignore */ }
      wsRef.current = null
    }
  }

  const start = useCallback((code) => {
    closeWs()
    setOutput('')
    setExitCode(null)
    setCompileError(null)
    setStatus('compiling')
    startedRef.current = false

    const token = localStorage.getItem('token') || ''
    const endpoint = wsEndpoint()
    const url = `${endpoint}?token=${encodeURIComponent(token)}`

    let ws
    try {
      ws = new WebSocket(url)
    } catch (e) {
      setStatus('error')
      setOutput(`Could not open the interactive connection.\n${endpoint}\n${e}`)
      return
    }
    wsRef.current = ws

    ws.onopen = () => ws.send(JSON.stringify({ type: 'start', code }))

    ws.onmessage = (ev) => {
      let msg
      try { msg = JSON.parse(ev.data) } catch { return }
      switch (msg.type) {
        case 'started':
          startedRef.current = true
          modeRef.current = msg.mode || 'pty'
          setStatus('running'); break
        case 'info':
          setOutput((o) => o + (msg.data || '')); break
        case 'stdout':
          setOutput((o) => o + msg.data); setStatus('running'); break
        case 'compile_error':
          setOutput(msg.data || 'Compilation failed'); setCompileError(msg.data || ''); setStatus('error'); break
        case 'error':
          setOutput((o) => (o ? o + '\n' : '') + (msg.data || 'Runtime error')); setStatus('error'); break
        case 'exit':
          setExitCode(msg.code ?? null)
          setStatus((s) => (s === 'error' ? 'error' : 'exited'))
          break
        default: break
      }
    }

    ws.onerror = () => {
      if (!startedRef.current) {
        setOutput(
          'Could not reach the interactive server (WebSocket failed).\n' +
          `Tried: ${endpoint}\n\n` +
          'On a hosted deploy this usually means one of:\n' +
          '  • the frontend and backend are on different domains — build the\n' +
          '    frontend with VITE_API_URL set to the backend URL ending in /api\n' +
          '  • the host/proxy is not forwarding WebSocket upgrades\n' +
          '  • the backend is not running.'
        )
        setStatus('error')
      }
    }
    ws.onclose = (ev) => {
      if (!startedRef.current) {
        if (ev.code === 4401) {
          setOutput('Authentication failed for the interactive run — try signing in again.')
        } else if (status !== 'error') {
          setOutput((o) => o || `Interactive connection closed before starting (code ${ev.code}).\nTried: ${endpoint}`)
        }
        setStatus((s) => (s === 'compiling' ? 'error' : s))
      } else {
        setStatus((s) => (s === 'running' ? 'exited' : s))
      }
    }
  }, [status])

  const sendInput = useCallback((text) => {
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'stdin', data: text }))
      if (modeRef.current === 'pipe') setOutput((o) => o + text)
    }
  }, [])

  const stop = useCallback(() => {
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'stop' }))
    }
  }, [])

  const reset = useCallback(() => {
    closeWs()
    setOutput('')
    setExitCode(null)
    setStatus('idle')
  }, [])

  useEffect(() => closeWs, [])

  return { output, status, exitCode, compileError, start, sendInput, stop, reset }
}
