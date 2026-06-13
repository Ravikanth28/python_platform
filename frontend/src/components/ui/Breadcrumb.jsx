import { Link, useLocation } from 'react-router-dom'
import {
  ChevronRight, Home, LayoutDashboard, BookMarked, BookOpen, GraduationCap,
  Puzzle, Code2, FlaskConical, BarChart3, LineChart, Activity, Users, UserCircle,
} from 'lucide-react'

const META = {
  dashboard:  { label: 'Dashboard',  icon: LayoutDashboard },
  lessons:    { label: 'Lessons',    icon: BookMarked },
  notes:      { label: 'Notes',      icon: BookOpen },
  classroom:  { label: 'Classroom',  icon: GraduationCap },
  challenges: { label: 'Challenges', icon: Puzzle },
  practice:   { label: 'Practice',   icon: Code2 },
  tests:      { label: 'Tests',      icon: FlaskConical },
  reports:    { label: 'Reports',    icon: BarChart3 },
  analytics:  { label: 'Analytics',  icon: LineChart },
  system:     { label: 'System',     icon: Activity },
  students:   { label: 'Students',   icon: Users },
  profile:    { label: 'Profile',    icon: UserCircle },
}

// Badge-style breadcrumb shown at the top of every portal page:  [Home] › [Page]
export default function Breadcrumb() {
  const { pathname } = useLocation()
  const parts = pathname.split('/').filter(Boolean)   // e.g. ['admin','practice']
  if (parts.length < 1) return null

  const role = parts[0]                               // 'admin' | 'student'
  const isAdmin = role === 'admin'
  const seg = parts[1] || 'dashboard'
  const meta = META[seg] || { label: seg.charAt(0).toUpperCase() + seg.slice(1), icon: ChevronRight }
  let label = meta.label
  if (isAdmin && seg === 'practice') label = 'Practice Mode'
  if (isAdmin && seg === 'tests') label = 'Test Mode'
  const Icon = meta.icon
  const onHome = seg === 'dashboard'

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-2 min-w-0">
      <Link
        to={`/${role}/dashboard`}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-line bg-surface text-[12px] font-medium text-t3 hover:text-t hover:border-line-strong hover:shadow-katonic-sm transition-all"
      >
        <Home size={13} /> Home
      </Link>

      {!onHome && (
        <>
          <ChevronRight size={14} className="text-t4 flex-shrink-0" />
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[12px] font-semibold"
            style={{
              color: 'var(--brand)',
              background: 'var(--brandGhost)',
              border: '1px solid color-mix(in srgb, var(--brand) 30%, transparent)',
            }}
          >
            <Icon size={13} /> {label}
          </span>
        </>
      )}
    </nav>
  )
}
