import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'

import Login    from './pages/auth/Login'
import Register from './pages/auth/Register'
import Layout   from './components/Layout'

import AdminDashboard  from './pages/admin/Dashboard'
import AdminNotes      from './pages/admin/Notes'
import AdminPractice   from './pages/admin/PracticeMode'
import AdminTest       from './pages/admin/TestMode'
import AdminReports    from './pages/admin/Reports'
import AdminSystem     from './pages/admin/System'
import AdminChallenges from './pages/admin/Challenges'
import AdminLessons    from './pages/admin/Lessons'
import AdminStudents   from './pages/admin/Students'
import AdminLiveTests  from './pages/admin/LiveTests'
import Classroom       from './pages/Classroom'
import Analytics       from './pages/Analytics'
import Profile         from './pages/Profile'

import StudentDashboard from './pages/student/Dashboard'
import StudentNotes     from './pages/student/Notes'
import StudentPractice  from './pages/student/Practice'
import StudentTest      from './pages/student/TestMode'
import StudentReports   from './pages/student/Reports'
import Challenges       from './pages/student/Challenges'
import Lessons          from './pages/student/Lessons'

import CodingEnvironment from './pages/CodingEnvironment'

function RequireAuth({ children, role }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex h-screen items-center justify-center bg-beige-pg text-t3">Loading…</div>
  if (!user) return <Navigate to="/login" replace />
  if (role && user.role !== role) return <Navigate to={user.role === 'admin' ? '/admin/dashboard' : '/student/dashboard'} replace />
  return children
}

export default function App() {
  const { user } = useAuth()

  return (
    <Routes>
      {/* Public */}
      <Route path="/login"    element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Admin */}
      <Route path="/admin" element={<RequireAuth role="admin"><Layout /></RequireAuth>}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="notes"     element={<AdminNotes />} />
        <Route path="practice"  element={<AdminPractice />} />
        <Route path="tests"     element={<AdminTest />} />
        <Route path="live"      element={<AdminLiveTests />} />
        <Route path="classroom" element={<Classroom />} />
        <Route path="challenges" element={<AdminChallenges />} />
        <Route path="lessons"   element={<AdminLessons />} />
        <Route path="students"  element={<AdminStudents />} />
        <Route path="profile"   element={<Profile />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="reports"   element={<AdminReports />} />
        <Route path="system"    element={<AdminSystem />} />
      </Route>

      {/* Student */}
      <Route path="/student" element={<RequireAuth role="student"><Layout /></RequireAuth>}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<StudentDashboard />} />
        <Route path="lessons"   element={<Lessons />} />
        <Route path="notes"     element={<StudentNotes />} />
        <Route path="practice"  element={<StudentPractice />} />
        <Route path="challenges" element={<Challenges />} />
        <Route path="profile"   element={<Profile />} />
        <Route path="tests"     element={<StudentTest />} />
        <Route path="classroom" element={<Classroom />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="reports"   element={<StudentReports />} />
      </Route>

      {/* Coding environment */}
      <Route path="/code/:problemId" element={<RequireAuth><CodingEnvironment /></RequireAuth>} />

      {/* Default redirect */}
      <Route path="/" element={
        user ? (
          <Navigate to={user.role === 'admin' ? '/admin/dashboard' : '/student/dashboard'} replace />
        ) : (
          <Navigate to="/login" replace />
        )
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
