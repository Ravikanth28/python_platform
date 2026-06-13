import { PanelLeft, HelpCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import ThemeToggle from './ui/ThemeToggle'
import Breadcrumb from './ui/Breadcrumb'

export default function Topbar({ onMenuClick, onTour }) {
  const { user } = useAuth()
  const initial = (user?.full_name || user?.username || '?')[0].toUpperCase()

  return (
    <header className="flex items-center justify-between gap-3 h-12 px-4 lg:px-6 flex-shrink-0 bg-surface border-b border-line">
      {/* Left: collapse + breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onMenuClick}
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-t3 hover:text-t hover:bg-surface-h transition-colors flex-shrink-0"
          aria-label="Toggle sidebar"
        >
          <PanelLeft size={17} />
        </button>
        <Breadcrumb />
      </div>

      {/* Right: tour + theme + user */}
      <div className="flex items-center gap-2">
        {onTour && (
          <button onClick={onTour} title="Take a guided tour"
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-t3 hover:text-brand hover:bg-surface-h transition-colors">
            <HelpCircle size={17} />
          </button>
        )}
        <ThemeToggle />

        {user && (
          <div className="flex items-center gap-2 pl-1">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-semibold font-serif"
              style={{ background: user.avatar_color || 'var(--brand-solid)' }}
            >
              {initial}
            </div>
            <div className="hidden md:block leading-tight">
              <p className="text-[12px] font-semibold text-t">{user.full_name || user.username}</p>
              <p className="text-[10px] text-t4 capitalize">{user.role}</p>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
