import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, LogIn } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import AuthShell from '../../components/ui/AuthShell'

export default function Login() {
  const { login } = useAuth()
  const navigate   = useNavigate()
  const [form, setForm]       = useState({ username: '', password: '' })
  const [showPw, setShowPw]   = useState(false)
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data } = await api.post('/auth/login', form)
      login(data.access_token, data.user)
      toast.success(`Welcome back, ${data.user.full_name || data.user.username}`)
      navigate(data.user.role === 'admin' ? '/admin/dashboard' : '/student/dashboard', { replace: true })
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell>
      <div className="card">
        <h2 className="h2">Sign in</h2>
        <p className="section-sub mb-6 mt-0.5">Enter your credentials to continue</p>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Username</label>
            <input
              className="input"
              placeholder="your_username"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
              autoFocus
            />
          </div>

          <div>
            <label className="label">Password</label>
            <div className="relative">
              <input
                className="input pr-10"
                type={showPw ? 'text' : 'password'}
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-t4 hover:text-t transition-colors"
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full mt-1 h-11">
            <LogIn size={16} />
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="text-center text-[13px] text-t3 mt-5">
          Don't have an account?{' '}
          <Link to="/register" className="text-brand font-medium hover:opacity-80 transition-opacity">
            Register
          </Link>
        </p>
      </div>
    </AuthShell>
  )
}
