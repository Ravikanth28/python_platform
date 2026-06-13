import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar  from './Topbar'
import PlatformTour from './ui/PlatformTour'
import { useAuth } from '../context/AuthContext'

export default function Layout() {
  const { user } = useAuth()
  // Open by default on desktop; collapsed (drawer) by default on phones/tablets.
  const [sidebarOpen, setSidebarOpen] = useState(
    () => (typeof window !== 'undefined' ? window.innerWidth >= 1024 : true)
  )
  const [tourOpen, setTourOpen] = useState(false)

  // First-login walkthrough (per role, once) — desktop only, where the sidebar is visible.
  useEffect(() => {
    if (!user) return
    const key = `cf_tour_${user.role}_v1`
    if (!localStorage.getItem(key) && window.innerWidth >= 1024) {
      const t = setTimeout(() => setTourOpen(true), 700)
      return () => clearTimeout(t)
    }
  }, [user])

  const closeTour = () => {
    if (user) { try { localStorage.setItem(`cf_tour_${user.role}_v1`, '1') } catch { /* ignore */ } }
    setTourOpen(false)
  }

  return (
    <div className="flex h-screen overflow-hidden bg-beige-pg text-t">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar onMenuClick={() => setSidebarOpen(!sidebarOpen)} onTour={() => { setSidebarOpen(true); setTourOpen(true) }} />
        <main className="flex-1 overflow-y-auto px-6 py-6 lg:px-8 animate-fade-in">
          <Outlet />
        </main>
      </div>

      <PlatformTour open={tourOpen} onClose={closeTour} />
    </div>
  )
}
