import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'

export default function ThemeToggle({ className = '' }) {
  const { isDark, toggleTheme } = useTheme()
  return (
    <button
      onClick={toggleTheme}
      title={isDark ? 'Switch to light' : 'Switch to dark'}
      aria-label="Toggle theme"
      className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-t3 hover:text-brand hover:bg-brand-ghost transition-colors ${className}`}
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  )
}
