import { useState } from 'react'
import { User, Mail, Phone, Lock, Save, Loader2, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'

export default function Profile() {
  const { user, updateUser } = useAuth()
  const [form, setForm] = useState({
    full_name: user?.full_name || '',
    email: user?.email || '',
    phone: user?.phone || '',
  })
  const [savingProfile, setSavingProfile] = useState(false)

  const [pw, setPw] = useState({ current_password: '', new_password: '', confirm: '' })
  const [savingPw, setSavingPw] = useState(false)

  const saveProfile = async () => {
    if (!form.email.trim()) { toast.error('Email is required'); return }
    setSavingProfile(true)
    try {
      const { data } = await api.put('/auth/profile', form)
      updateUser(data)
      toast.success('Profile updated')
    } catch (e) { toast.error(e.response?.data?.detail || 'Update failed') }
    finally { setSavingProfile(false) }
  }

  const changePw = async () => {
    if (pw.new_password.length < 6) { toast.error('New password must be at least 6 characters'); return }
    if (pw.new_password !== pw.confirm) { toast.error('New passwords do not match'); return }
    setSavingPw(true)
    try {
      await api.post('/auth/change-password', { current_password: pw.current_password, new_password: pw.new_password })
      toast.success('Password changed')
      setPw({ current_password: '', new_password: '', confirm: '' })
    } catch (e) { toast.error(e.response?.data?.detail || 'Could not change password') }
    finally { setSavingPw(false) }
  }

  const initial = (user?.full_name || user?.username || '?')[0].toUpperCase()

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div>
        <h1 className="h1">My Profile</h1>
        <p className="section-sub mt-0.5">Manage your account details and password</p>
      </div>

      {/* Identity */}
      <div className="card flex items-center gap-4">
        <div className="w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-bold font-serif flex-shrink-0"
          style={{ background: user?.avatar_color || 'var(--brand-solid)' }}>{initial}</div>
        <div className="min-w-0">
          <p className="text-[16px] font-semibold text-t">{user?.full_name || user?.username}</p>
          <p className="text-[13px] text-t4">@{user?.username} · <span className="capitalize">{user?.role}</span></p>
        </div>
      </div>

      {/* Profile details */}
      <div className="card space-y-3">
        <h3 className="h3 flex items-center gap-2"><User size={16} style={{ color: 'var(--brand)' }} /> Profile details</h3>
        <div>
          <label className="label">Full name</label>
          <input className="input" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Your name" />
        </div>
        <div>
          <label className="label flex items-center gap-1.5"><Mail size={13} /> Email</label>
          <input className="input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="you@example.com" />
        </div>
        <div>
          <label className="label flex items-center gap-1.5"><Phone size={13} /> Phone <span className="text-t4 font-normal">(optional)</span></label>
          <input className="input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="e.g. +91 98765 43210" />
        </div>
        <p className="text-[12px] text-t4">Username (@{user?.username}) can't be changed.</p>
        <button className="btn-primary" disabled={savingProfile} onClick={saveProfile}>
          {savingProfile ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save changes
        </button>
      </div>

      {/* Change password */}
      <div className="card space-y-3">
        <h3 className="h3 flex items-center gap-2"><Lock size={16} style={{ color: 'var(--brand)' }} /> Change password</h3>
        <div>
          <label className="label">Current password</label>
          <input className="input" type="password" value={pw.current_password} onChange={e => setPw(p => ({ ...p, current_password: e.target.value }))} placeholder="••••••••" />
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="label">New password</label>
            <input className="input" type="password" value={pw.new_password} onChange={e => setPw(p => ({ ...p, new_password: e.target.value }))} placeholder="At least 6 characters" />
          </div>
          <div>
            <label className="label">Confirm new password</label>
            <input className="input" type="password" value={pw.confirm} onChange={e => setPw(p => ({ ...p, confirm: e.target.value }))} placeholder="Repeat new password" />
          </div>
        </div>
        <button className="btn-primary" disabled={savingPw || !pw.current_password} onClick={changePw}>
          {savingPw ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />} Update password
        </button>
      </div>
    </div>
  )
}
