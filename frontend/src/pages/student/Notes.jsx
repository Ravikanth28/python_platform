import { useEffect, useState } from 'react'
import { Eye, Download, Youtube, FileText, Link2, Search, BookOpen } from 'lucide-react'
import api, { getFileUrl } from '../../api/client'
import { PageLoader } from '../../components/ui/LoadingSpinner'

const TYPE_ICONS = {
  pdf:     <FileText size={20} style={{ color: 'var(--err)' }} />,
  docx:    <FileText size={20} style={{ color: 'var(--info)' }} />,
  youtube: <Youtube  size={20} style={{ color: 'var(--err)' }} />,
  link:    <Link2    size={20} style={{ color: 'var(--info)' }} />,
}

const TYPE_COLORS = {
  pdf: 'badge-red', docx: 'badge-blue', youtube: 'badge-red', link: 'badge-cyan',
}

export default function StudentNotes() {
  const [notes, setNotes]     = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  useEffect(() => {
    api.get('/notes').then((r) => setNotes(r.data)).finally(() => setLoading(false))
  }, [])

  const handleView = async (note) => {
    await api.post(`/notes/${note.id}/view`).catch(() => {})
    if (note.file_url)      window.open(getFileUrl(note.file_url), '_blank')
    else if (note.yt_link)  window.open(note.yt_link, '_blank')
    else if (note.external_link) window.open(note.external_link, '_blank')
  }

  const handleDownload = async (note) => {
    await api.post(`/notes/${note.id}/download`).catch(() => {})
    if (note.file_url) {
      const a = document.createElement('a')
      a.href = getFileUrl(note.file_url); a.download = note.title
      a.click()
    }
  }

  const filtered = notes.filter((n) => {
    const q = search.toLowerCase()
    return (
      n.title.toLowerCase().includes(q) &&
      (typeFilter ? n.upload_type === typeFilter : true)
    )
  })

  if (loading) return <PageLoader />

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="h1">Study Notes</h1>
        <p className="section-sub mt-0.5">Learning materials shared by your instructor</p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-0 max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-t4" />
          <input className="input pl-8" placeholder="Search notes…" value={search}
            onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2 flex-wrap">
          {[['All', ''], ['PDF', 'pdf'], ['DOCX', 'docx'], ['YouTube', 'youtube'], ['Link', 'link']].map(([label, val]) => {
            const n = val ? notes.filter(x => x.upload_type === val).length : notes.length
            return (
              <button key={val} onClick={() => setTypeFilter(val)}
                className={typeFilter === val ? 'tab-active' : 'tab-inactive'}>{label} <span className="tabular opacity-70">{n}</span></button>
            )
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card text-center py-16">
          <BookOpen size={40} className="mx-auto text-t4 mb-3" />
          <p className="text-t3">No notes available yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((note) => (
            <div key={note.id} className="card-hover">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl surface-inset flex items-center justify-center flex-shrink-0">
                  {TYPE_ICONS[note.upload_type]}
                </div>
                <span className={`badge ${TYPE_COLORS[note.upload_type] || 'badge-blue'} text-[10px]`}>
                  {note.upload_type?.toUpperCase()}
                </span>
              </div>
              <h3 className="h3 mb-1 line-clamp-2">{note.title}</h3>
              {note.description && (
                <p className="text-xs text-t3 line-clamp-2 mb-3">{note.description}</p>
              )}
              <div className="flex gap-2 mt-auto pt-2">
                <button onClick={() => handleView(note)} className="btn-primary flex-1 justify-center text-xs py-1.5">
                  <Eye size={12} /> View
                </button>
                {(note.file_url) && (
                  <button onClick={() => handleDownload(note)} className="btn-secondary px-3">
                    <Download size={13} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
