import { createContext, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext(null)

const STORAGE_KEY = 'theme'

function getInitialTheme() {
  try {
    const t = localStorage.getItem(STORAGE_KEY)
    if (t === 'light' || t === 'dark') return t
  } catch { /* ignore */ }
  return 'dark' // default is dark
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme)

  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-theme', theme)
    try { localStorage.setItem(STORAGE_KEY, theme) } catch { /* ignore */ }
  }, [theme])

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, isDark: theme === 'dark' }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
