import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, UserPlus } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import AuthShell from '../../components/ui/AuthShell'

export default function Register() {
  const { login } = useAuth()
  const navigate   = useNavigate()
  const [form, setForm] = useState({
    username: '', email: '', full_name: '', password: '', confirm: '', role: 'student',
  })
  const [showPw, setShowPw]   = useState(false)
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (form.password !== form.confirm) { toast.error('Passwords do not match'); return }
    if (form.password.length < 6)       { toast.error('Password must be at least 6 characters'); return }
    setLoading(true)
    try {
      const { data } = await api.post('/auth/register', {
        username: form.username,
        email:    form.email,
        full_name: form.full_name,
        password: form.password,
        role:     form.role,
      })
      login(data.access_token, data.user)
      toast.success('Account created')
      navigate(data.user.role === 'admin' ? '/admin/dashboard' : '/student/dashboard', { replace: true })
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  return (
    <AuthShell>
      <div className="card">
        <h2 className="h2">Create account</h2>
        <p className="section-sub mb-6 mt-0.5">Join the platform today</p>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Username *</label>
              <input className="input" placeholder="username" value={form.username} onChange={set('username')} required />
            </div>
            <div>
              <label className="label">Full name</label>
              <input className="input" placeholder="John Doe" value={form.full_name} onChange={set('full_name')} />
            </div>
          </div>

          <div>
            <label className="label">Email *</label>
            <input className="input" type="email" placeholder="you@email.com" value={form.email} onChange={set('email')} required />
          </div>

          <div>
            <label className="label">Role</label>
            <select className="input" value={form.role} onChange={set('role')}>
              <option value="student">Student</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Password *</label>
              <div className="relative">
                <input
                  className="input pr-10"
                  type={showPw ? 'text' : 'password'}
                  placeholder="Min 6 chars"
                  value={form.password}
                  onChange={set('password')}
                  required
                />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-t4 hover:text-t transition-colors">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label className="label">Confirm *</label>
              <input className="input" type="password" placeholder="Re-enter" value={form.confirm} onChange={set('confirm')} required />
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full mt-1 h-11">
            <UserPlus size={16} />
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="text-center text-[13px] text-t3 mt-5">
          Already have an account?{' '}
          <Link to="/login" className="text-brand font-medium hover:opacity-80 transition-opacity">
            Sign in
          </Link>
        </p>
      </div>
    </AuthShell>
  )
}
