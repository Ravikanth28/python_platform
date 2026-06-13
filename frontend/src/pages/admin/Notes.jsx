import { useCallback, useEffect, useRef, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import {
  Plus, Trash2, Search, Eye, Download, Youtube,
  FileText, Link2, CheckSquare, Square, Upload, X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import api, { getFileUrl } from '../../api/client'
import Modal           from '../../components/ui/Modal'
import { PageLoader }  from '../../components/ui/LoadingSpinner'
import CountBar        from '../../components/ui/CountBar'

const TYPE_ICONS = {
  pdf:     <FileText size={16} style={{ color: 'var(--err)' }} />,
  docx:    <FileText size={16} style={{ color: 'var(--info)' }} />,
  youtube: <Youtube  size={16} style={{ color: 'var(--err)' }} />,
  link:    <Link2    size={16} style={{ color: 'var(--info)' }} />,
}

const TYPE_COLORS = {
  pdf:     'badge-red',
  docx:    'badge-blue',
  youtube: 'badge-red',
  link:    'badge-cyan',
}

export default function AdminNotes() {
  const [notes, setNotes]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [selected, setSelected]   = useState(new Set())
  const [showModal, setShowModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState({
    title: '', description: '', upload_type: 'pdf',
    yt_link: '', external_link: '', is_for_all: true,
    assigned_user_ids: '',
  })
  const [file, setFile] = useState(null)

  const load = () => {
    setLoading(true)
    api.get('/notes').then((r) => setNotes(r.data)).finally(() => setLoading(false))
  }
  useEffect(load, [])

  const onDrop = useCallback((accepted) => {
    if (accepted[0]) setFile(accepted[0])
  }, [])
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: form.upload_type === 'pdf'
      ? { 'application/pdf': ['.pdf'] }
      : { 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'] },
    multiple: false,
  })

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }
  const toggleAll = () => {
    setSelected(selected.size === filtered.length ? new Set() : new Set(filtered.map((n) => n.id)))
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this note?')) return
    await api.delete(`/notes/${id}`)
    toast.success('Note deleted')
    load()
  }

  const handleBulkDelete = async () => {
    if (selected.size === 0) return
    if (!window.confirm(`Delete ${selected.size} notes?`)) return
    await api.post('/notes/bulk-delete', { ids: [...selected] })
    toast.success(`Deleted ${selected.size} notes`)
    setSelected(new Set())
    load()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append('title',        form.title)
      fd.append('description',  form.description)
      fd.append('upload_type',  form.upload_type)
      fd.append('is_for_all',   form.is_for_all)
      if (form.yt_link)          fd.append('yt_link',          form.yt_link)
      if (form.external_link)    fd.append('external_link',    form.external_link)
      if (form.assigned_user_ids) fd.append('assigned_user_ids', form.assigned_user_ids)
      if (file)                  fd.append('file', file)

      await api.post('/notes/', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      toast.success('Note uploaded!')
      setShowModal(false)
      setFile(null)
      setForm({ title:'', description:'', upload_type:'pdf', yt_link:'', external_link:'', is_for_all:true, assigned_user_ids:'' })
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload failed')
    } finally {
      setSubmitting(false)
    }
  }

  const filtered = notes.filter((n) =>
    n.title.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return <PageLoader />

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="h1">Notes</h1>
          <p className="section-sub mt-0.5">Manage study materials for students</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary">
          <Plus size={16} /> Upload Note
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-0 max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-t4" />
          <input
            className="input pl-8"
            placeholder="Search notes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {selected.size > 0 && (
          <button onClick={handleBulkDelete} className="btn-danger">
            <Trash2 size={14} /> Delete ({selected.size})
          </button>
        )}
        <CountBar stats={[
          { label: 'Total', count: notes.length },
          { label: 'PDF', count: notes.filter(n => n.upload_type === 'pdf').length },
          { label: 'Docs', count: notes.filter(n => n.upload_type === 'docx').length },
          { label: 'Video', count: notes.filter(n => n.upload_type === 'youtube').length },
          { label: 'Links', count: notes.filter(n => n.upload_type === 'link').length },
        ]} />
      </div>

      {/* Notes grid */}
      {filtered.length === 0 ? (
        <div className="card text-center py-16">
          <FileText size={40} className="mx-auto text-t4 mb-3" />
          <p className="text-t3">No notes yet. Upload your first note!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              selected={selected.has(note.id)}
              onToggle={() => toggleSelect(note.id)}
              onDelete={() => handleDelete(note.id)}
            />
          ))}
        </div>
      )}

      {/* Upload Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Upload Note" size="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Title *</label>
            <input className="input" required value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Note title" />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input resize-none" rows={3} value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Brief description…" />
          </div>

          <div>
            <label className="label">Upload Method *</label>
            <div className="grid grid-cols-4 gap-2">
              {['pdf', 'docx', 'youtube', 'link'].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm({ ...form, upload_type: t })}
                  className={`flex flex-col items-center gap-1.5 rounded-lg p-2.5 border text-xs font-medium transition-all ${
                    form.upload_type === t
                      ? 'border-line-strong text-brand'
                      : 'border-line text-t3 hover:border-line-strong'
                  }`}
                  style={form.upload_type === t ? { background: 'var(--brandGhost)' } : undefined}
                >
                  {TYPE_ICONS[t]}
                  {t.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {(form.upload_type === 'pdf' || form.upload_type === 'docx') && (
            <div>
              <label className="label">File *</label>
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                  isDragActive ? 'border-line-strong' : 'border-line hover:border-line-strong'
                }`}
                style={isDragActive ? { background: 'var(--brandGhost)' } : undefined}
              >
                <input {...getInputProps()} />
                {file ? (
                  <div className="flex items-center justify-center gap-2" style={{ color: 'var(--ok)' }}>
                    <FileText size={16} />
                    <span className="text-sm truncate">{file.name}</span>
                    <button type="button" onClick={(e) => { e.stopPropagation(); setFile(null) }}
                      className="text-t3 hover:text-t"><X size={14} /></button>
                  </div>
                ) : (
                  <div className="text-t3 text-sm">
                    <Upload size={24} className="mx-auto mb-2 opacity-50" />
                    Drag & drop or click to select {form.upload_type.toUpperCase()}
                  </div>
                )}
              </div>
            </div>
          )}

          {form.upload_type === 'youtube' && (
            <div>
              <label className="label">YouTube Link *</label>
              <input className="input" value={form.yt_link} required
                onChange={(e) => setForm({ ...form, yt_link: e.target.value })} placeholder="https://youtube.com/watch?v=…" />
            </div>
          )}

          {form.upload_type === 'link' && (
            <div>
              <label className="label">External Link *</label>
              <input className="input" value={form.external_link} required
                onChange={(e) => setForm({ ...form, external_link: e.target.value })} placeholder="https://…" />
            </div>
          )}

          <div>
            <label className="label">Assign To</label>
            <div className="flex gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={form.is_for_all} onChange={() => setForm({ ...form, is_for_all: true })}
                  className="accent-primary" /> All Students
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={!form.is_for_all} onChange={() => setForm({ ...form, is_for_all: false })}
                  className="accent-primary" /> Specific Students
              </label>
            </div>
            {!form.is_for_all && (
              <input className="input mt-2" value={form.assigned_user_ids}
                onChange={(e) => setForm({ ...form, assigned_user_ids: e.target.value })}
                placeholder="Enter student IDs separated by commas (e.g. 1,2,3)" />
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-primary flex-1">
              {submitting ? 'Uploading…' : 'Upload Note'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

function NoteCard({ note, selected, onToggle, onDelete }) {
  return (
    <div className={`card-hover relative ${selected ? 'border-line-strong' : ''}`}
      style={selected ? { background: 'var(--brandGhost)' } : undefined}>
      {/* Checkbox */}
      <button
        onClick={onToggle}
        className="absolute top-3 right-3 text-t4 hover:text-brand transition-colors"
      >
        {selected ? <CheckSquare size={16} className="text-brand" /> : <Square size={16} />}
      </button>

      {/* Type icon */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-9 h-9 rounded-lg bg-surface-h flex items-center justify-center">
          {TYPE_ICONS[note.upload_type] || <FileText size={16} className="text-t3" />}
        </div>
        <span className={`badge ${TYPE_COLORS[note.upload_type] || 'badge-blue'} text-[10px]`}>
          {note.upload_type?.toUpperCase()}
        </span>
      </div>

      <h3 className="h3 text-sm leading-snug mb-1 pr-6 line-clamp-2">{note.title}</h3>
      {note.description && (
        <p className="text-xs text-t3 line-clamp-2 mb-3">{note.description}</p>
      )}

      {/* Analytics */}
      <div className="flex items-center gap-4 text-xs text-t4 mb-3 tabular">
        <span className="flex items-center gap-1"><Eye size={12} /> {note.view_count}</span>
        <span className="flex items-center gap-1"><Download size={12} /> {note.download_count}</span>
        {note.is_for_all
          ? <span className="badge-green badge text-[10px]">All Students</span>
          : <span className="badge-blue badge text-[10px]">Assigned</span>
        }
      </div>

      <div className="flex gap-2">
        {note.file_url && (
          <a href={getFileUrl(note.file_url)} target="_blank" rel="noreferrer"
            className="btn-secondary btn-sm flex-1 justify-center">
            <Eye size={12} /> View
          </a>
        )}
        {note.yt_link && (
          <a href={note.yt_link} target="_blank" rel="noreferrer"
            className="btn-secondary btn-sm flex-1 justify-center">
            <Youtube size={12} /> Watch
          </a>
        )}
        <button onClick={onDelete} className="btn-ghost px-2" style={{ color: 'var(--err)' }}>
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}
