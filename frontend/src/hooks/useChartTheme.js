import { useEffect, useState } from 'react'
import { useTheme } from '../context/ThemeContext'

/**
 * Reads the live Katonic CSS variables so Recharts (which needs concrete
 * color strings, not CSS vars) stays in sync with the active theme.
 */
function readTokens() {
  const s = getComputedStyle(document.documentElement)
  const v = (name, fallback) => (s.getPropertyValue(name).trim() || fallback)
  return {
    brand:   v('--brand', '#5C31FF'),
    grid:    v('--b', '#e8e6e3'),
    axis:    v('--t4', '#a09b91'),
    text:    v('--t2', '#3d3b38'),
    surface: v('--s', '#fff'),
    border:  v('--b', '#e8e6e3'),
    ok:      v('--ok', '#117a45'),
    warn:    v('--warn', '#b58300'),
    err:     v('--err', '#a23e2e'),
    info:    v('--info', '#3b82f6'),
    // decorative series palette (charts/categories only)
    series: [
      v('--brand', '#5C31FF'),
      v('--d-cyan', '#06b6d4'),
      v('--ok', '#117a45'),
      v('--d-orange', '#f97316'),
      v('--d-purple', '#8b5cf6'),
      v('--d-rose', '#f43f5e'),
    ],
    tooltip: {
      contentStyle: {
        background: v('--s', '#fff'),
        border: `1px solid ${v('--b', '#e8e6e3')}`,
        borderRadius: 8,
        fontSize: 12,
        color: v('--t', '#171716'),
        boxShadow: '0 6px 20px rgba(0,0,0,0.12)',
      },
      labelStyle: { color: v('--t', '#171716'), fontWeight: 600 },
      itemStyle: { color: v('--t2', '#3d3b38') },
    },
  }
}

export default function useChartTheme() {
  const { theme } = useTheme()
  const [tokens, setTokens] = useState(readTokens)

  useEffect(() => {
    // wait a frame so the data-theme swap has applied
    const id = requestAnimationFrame(() => setTokens(readTokens()))
    return () => cancelAnimationFrame(id)
  }, [theme])

  return tokens
}
