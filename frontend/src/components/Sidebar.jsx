import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  LayoutDashboard, BookOpen, Code2, FlaskConical,
  BarChart3, LogOut, X, GraduationCap, LineChart, Activity, Puzzle, BookMarked, Users, Radio,
} from 'lucide-react'
import toast from 'react-hot-toast'
import Logo from './ui/Logo'

const adminNav = [
  { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin/lessons',   icon: BookMarked,      label: 'Lessons' },
  { to: '/admin/notes',     icon: BookOpen,        label: 'Notes' },
  { to: '/admin/classroom', icon: GraduationCap,   label: 'Classroom' },
  { to: '/admin/students',  icon: Users,           label: 'Students' },
  { to: '/admin/challenges', icon: Puzzle,         label: 'Challenges' },
  { to: '/admin/practice',  icon: Code2,           label: 'Practice Mode' },
  { to: '/admin/tests',     icon: FlaskConical,    label: 'Test Mode' },
  { to: '/admin/live',      icon: Radio,           label: 'Live Tests' },
  { to: '/admin/reports',   icon: BarChart3,       label: 'Reports' },
  { to: '/admin/analytics', icon: LineChart,       label: 'Analytics' },
  { to: '/admin/system',    icon: Activity,        label: 'System' },
]

const studentNav = [
  { to: '/student/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/student/lessons',   icon: BookMarked,      label: 'Lessons' },
  { to: '/student/notes',     icon: BookOpen,        label: 'Notes' },
  { to: '/student/classroom', icon: GraduationCap,   label: 'Classroom' },
  { to: '/student/challenges', icon: Puzzle,         label: 'Challenges' },
  { to: '/student/practice',  icon: Code2,           label: 'Practice' },
  { to: '/student/tests',     icon: FlaskConical,    label: 'Tests' },
  { to: '/student/reports',   icon: BarChart3,       label: 'Reports' },
  { to: '/student/analytics', icon: LineChart,       label: 'Analytics' },
]

export default function Sidebar({ open, onClose }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const nav = user?.role === 'admin' ? adminNav : studentNav
  const initial = (user?.full_name || user?.username || '?')[0].toUpperCase()

  const handleLogout = () => {
    logout()
    toast.success('Signed out')
    navigate('/login')
  }

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden" onClick={onClose} />
      )}

      <aside
        className={`
          fixed lg:relative z-40 flex flex-col h-full
          bg-beige border-r border-beige-b
          transition-[width,transform] duration-300 ease-katonic
          ${open ? 'w-60 translate-x-0' : 'w-0 lg:w-16 -translate-x-full lg:translate-x-0'}
          overflow-hidden
        `}
      >
        {/* Brand */}
        <div className="flex items-center gap-2.5 h-12 px-3.5 flex-shrink-0 border-b border-line">
          <Logo size={32} radius={10} className="flex-shrink-0" />
          {open && (
            <div className="min-w-0 leading-tight">
              <p className="font-sans font-bold text-t text-[15px] tracking-tight">CodeForge</p>
              <p className="h-section mt-0.5">{user?.role === 'admin' ? 'Admin Portal' : 'Student Portal'}</p>
            </div>
          )}
          <button onClick={onClose} className="ml-auto text-t4 hover:text-t transition-colors lg:hidden">
            <X size={16} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-2.5 overflow-y-auto overflow-x-hidden">
          {open && <p className="h-section px-2.5 mb-2">Platform</p>}
          <div className="space-y-1">
            {nav.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                data-tour={`nav-${to.split('/').pop()}`}
                onClick={() => { if (typeof window !== 'undefined' && window.innerWidth < 1024) onClose() }}
                className={({ isActive }) => (isActive ? 'sidebar-item-active' : 'sidebar-item-inactive')}
                title={!open ? label : undefined}
              >
                <Icon size={17} className="flex-shrink-0" />
                {open && <span className="truncate">{label}</span>}
              </NavLink>
            ))}
          </div>
        </nav>

        {/* User */}
        <div className="px-2.5 py-3 flex-shrink-0 border-t border-beige-b">
          {open && user && (
            <NavLink
              to={`/${user.role}/profile`}
              data-tour="nav-profile"
              onClick={() => { if (typeof window !== 'undefined' && window.innerWidth < 1024) onClose() }}
              className="flex items-center gap-2.5 px-2 py-2 mb-1 rounded-lg bg-beige-pill hover:shadow-katonic-sm transition-shadow"
              title="Edit profile"
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 font-serif"
                style={{ background: user.avatar_color || 'var(--brand-solid)' }}
              >
                {initial}
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-t truncate">{user.full_name || user.username}</p>
                <p className="text-[11px] text-t4 truncate">{user.email}</p>
              </div>
            </NavLink>
          )}
          <button onClick={handleLogout} className="sidebar-item-inactive w-full" title={!open ? 'Sign out' : undefined}>
            <LogOut size={17} className="flex-shrink-0" />
            {open && <span>Sign out</span>}
          </button>
        </div>
      </aside>
    </>
  )
}
