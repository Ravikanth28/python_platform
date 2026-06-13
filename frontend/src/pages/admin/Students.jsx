import { useEffect, useState } from 'react'
import { Users, Search, KeyRound, Trash2, Loader2, Copy } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import toast from 'react-hot-toast'
import api from '../../api/client'
import { PageLoader } from '../../components/ui/LoadingSpinner'
import Modal from '../../components/ui/Modal'

export default function AdminStudents() {
  const [students, setStudents] = useState(null)
  const [search, setSearch] = useState('')
  const [resetFor, setResetFor] = useState(null)

  const load = () => api.get('/admin/students').then(r => setStudents(r.data))
  useEffect(() => { load() }, [])

  const remove = async (s) => {
    if (!window.confirm(`Delete ${s.full_name || s.username}? This removes their account and submissions.`)) return
    try { await api.delete(`/admin/students/${s.id}`); toast.success('Student deleted'); load() }
    catch { toast.error('Delete failed') }
  }

  if (!students) return <PageLoader />
  const q = search.trim().toLowerCase()
  const shown = students.filter(s =>
    !q || (s.full_name || '').toLowerCase().includes(q) || s.username.toLowerCase().includes(q) || (s.email || '').toLowerCase().includes(q))

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="h1">Students</h1>
          <p className="section-sub mt-0.5">All registered students — details and account management.</p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-line text-[12px] bg-surface">
          <Users size={13} className="text-t4" /><span className="text-t3">Total</span>
          <span className="tabular font-semibold">{students.length}</span>
        </span>
      </div>

      <div className="relative max-w-xs">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-t4" />
        <input className="input pl-8" placeholder="Search name, username, email…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {shown.length === 0 ? (
        <div className="card text-center py-16">
          <Users size={40} className="mx-auto text-t4 mb-3" />
          <p className="text-t3">No students found.</p>
        </div>
      ) : (
        <div className="table-container">
          <div className="overflow-x-auto">
            <table className="w-full text-left whitespace-nowrap">
              <thead>
                <tr className="table-header">
                  <th className="table-cell">#</th>
                  <th className="table-cell">Name</th>
                  <th className="table-cell">Username</th>
                  <th className="table-cell">Email</th>
                  <th className="table-cell">Phone</th>
                  <th className="table-cell">Joined</th>
                  <th className="table-cell text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((s, i) => (
                  <tr key={s.id} className="table-row">
                    <td className="table-cell text-t4 tabular">{i + 1}</td>
                    <td className="table-cell">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-semibold font-serif flex-shrink-0"
                          style={{ background: s.avatar_color || 'var(--brand-solid)' }}>{(s.full_name || s.username || '?')[0].toUpperCase()}</div>
                        <span className="text-t font-medium">{s.full_name || '—'}</span>
                      </div>
                    </td>
                    <td className="table-cell text-t3">@{s.username}</td>
                    <td className="table-cell text-t3">{s.email}</td>
                    <td className="table-cell text-t3">{s.phone || '—'}</td>
                    <td className="table-cell text-t4 text-xs tabular">
                      {s.created_at ? formatDistanceToNow(new Date(s.created_at), { addSuffix: true }) : '—'}
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-1.5 justify-end">
                        <button className="btn-secondary text-xs py-1 px-2.5" onClick={() => setResetFor(s)}>
                          <KeyRound size={12} /> Reset password
                        </button>
                        <button className="btn-ghost text-xs py-1 px-2" onClick={() => remove(s)} title="Delete student">
                          <Trash2 size={12} style={{ color: 'var(--err)' }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ResetPasswordModal student={resetFor} onClose={() => setResetFor(null)} />
    </div>
  )
}

function ResetPasswordModal({ student, onClose }) {
  const [pw, setPw] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => { setPw('') }, [student])
  if (!student) return null

  const gen = () => {
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789'
    let s = ''
    for (let i = 0; i < 10; i++) s += chars[Math.floor(Math.random() * chars.length)]
    setPw(s)
  }

  const submit = async () => {
    if (pw.length < 6) { toast.error('Password must be at least 6 characters'); return }
    setSaving(true)
    try {
      await api.post(`/admin/students/${student.id}/reset-password`, { new_password: pw })
      toast.success(`Password reset for ${student.full_name || student.username}`)
      onClose()
    } catch (e) { toast.error(e.response?.data?.detail || 'Reset failed') }
    finally { setSaving(false) }
  }

  return (
    <Modal open={!!student} onClose={onClose} title={`Reset password · ${student.full_name || student.username}`} size="sm">
      <div className="space-y-3">
        <p className="text-[13px] text-t3">Set a new password for <b>@{student.username}</b>, then share it with them. They can change it later from their profile.</p>
        <div>
          <label className="label">New password</label>
          <div className="flex gap-2">
            <input className="input font-mono" value={pw} onChange={e => setPw(e.target.value)} placeholder="At least 6 characters" />
            <button className="btn-secondary btn-sm flex-shrink-0" onClick={gen} title="Generate">Generate</button>
          </div>
        </div>
        {pw && (
          <button className="text-[12px] text-t4 hover:text-t3 inline-flex items-center gap-1"
            onClick={() => { navigator.clipboard.writeText(pw); toast.success('Copied') }}>
            <Copy size={12} /> Copy password
          </button>
        )}
        <div className="flex gap-2 pt-1">
          <button className="btn-primary" disabled={saving || pw.length < 6} onClick={submit}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />} Set password
          </button>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </Modal>
  )
}
