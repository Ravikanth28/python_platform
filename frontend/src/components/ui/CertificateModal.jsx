import { useRef } from 'react'
import { jsPDF } from 'jspdf'
import { X, Download, FileText } from 'lucide-react'
import toast from 'react-hot-toast'

const W = 1000, H = 700

// Render the live SVG node to a high-res canvas (2x) on a white background.
async function renderCanvas(svgEl, scale = 2) {
  const xml = new XMLSerializer().serializeToString(svgEl)
  const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml)
  const img = new Image()
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url })
  const canvas = document.createElement('canvas')
  canvas.width = W * scale
  canvas.height = H * scale
  const ctx = canvas.getContext('2d')
  ctx.setTransform(scale, 0, 0, scale, 0, 0)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)
  ctx.drawImage(img, 0, 0, W, H)
  return canvas
}

export default function CertificateModal({ open, onClose, name, solved, avgScore }) {
  const svgRef = useRef(null)
  if (!open) return null

  const date = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
  const safeName = (name || 'Student').slice(0, 40)
  const fileBase = `CodeForge_Certificate_${safeName.replace(/\s+/g, '_')}`

  const downloadPNG = async () => {
    try {
      const canvas = await renderCanvas(svgRef.current, 2)
      canvas.toBlob((blob) => {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `${fileBase}.png`
        a.click()
        URL.revokeObjectURL(a.href)
      }, 'image/png')
    } catch { toast.error('Could not generate PNG') }
  }

  const downloadPDF = async () => {
    try {
      const canvas = await renderCanvas(svgRef.current, 2)
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [W, H] })
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, W, H)
      pdf.save(`${fileBase}.pdf`)
    } catch { toast.error('Could not generate PDF') }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div className="w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-white font-serif text-lg font-semibold">Your certificate</h2>
          <div className="flex items-center gap-2">
            <button onClick={downloadPNG} className="btn-secondary btn-sm"><Download size={13} /> PNG</button>
            <button onClick={downloadPDF} className="btn-primary btn-sm"><FileText size={13} /> PDF</button>
            <button onClick={onClose} className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"><X size={18} /></button>
          </div>
        </div>

        <div className="rounded-xl overflow-hidden shadow-lg" style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
          <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width="100%" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
            <rect width={W} height={H} fill="#ffffff" />
            {/* borders */}
            <rect x="24" y="24" width={W - 48} height={H - 48} rx="14" fill="none" stroke="#5C31FF" strokeWidth="5" />
            <rect x="40" y="40" width={W - 80} height={H - 80} rx="8" fill="none" stroke="#C9B8FF" strokeWidth="1.5" />
            {/* corner diamonds */}
            {[[40, 40], [W - 40, 40], [40, H - 40], [W - 40, H - 40]].map(([x, y], i) => (
              <rect key={i} x={x - 6} y={y - 6} width="12" height="12" fill="#5C31FF" transform={`rotate(45 ${x} ${y})`} />
            ))}

            {/* monogram */}
            <rect x={W / 2 - 30} y="74" width="60" height="60" rx="14" fill="#5C31FF" />
            <text x={W / 2} y="114" textAnchor="middle" fontFamily="monospace" fontSize="28" fill="#ffffff">&gt;_</text>

            <text x={W / 2} y="178" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="13" letterSpacing="4" fill="#76726B">CODEFORGE · CERTIFICATE OF ACHIEVEMENT</text>
            <text x={W / 2} y="236" textAnchor="middle" fontFamily="Georgia, serif" fontWeight="700" fontSize="46" fill="#171716">Certificate of Completion</text>

            {/* divider */}
            <line x1={W / 2 - 90} y1="258" x2={W / 2 - 12} y2="258" stroke="#C9B8FF" strokeWidth="1.5" />
            <line x1={W / 2 + 12} y1="258" x2={W / 2 + 90} y2="258" stroke="#C9B8FF" strokeWidth="1.5" />
            <rect x={W / 2 - 5} y="253" width="10" height="10" fill="#5C31FF" transform={`rotate(45 ${W / 2} 258)`} />

            <text x={W / 2} y="308" textAnchor="middle" fontFamily="Georgia, serif" fontStyle="italic" fontSize="17" fill="#3D3B38">This certifies that</text>
            <text x={W / 2} y="362" textAnchor="middle" fontFamily="Georgia, serif" fontWeight="600" fontSize="40" fill="#5C31FF">{safeName}</text>
            <line x1={W / 2 - 180} y1="384" x2={W / 2 + 180} y2="384" stroke="#EAE3D4" strokeWidth="1.5" />
            <text x={W / 2} y="420" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="15" fill="#3D3B38">has successfully demonstrated proficiency in Python programming on the CodeForge platform.</text>

            {/* stats */}
            <text x={W / 2 - 130} y="510" textAnchor="middle" fontFamily="Georgia, serif" fontWeight="700" fontSize="36" fill="#171716">{solved}</text>
            <text x={W / 2 - 130} y="534" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="11" letterSpacing="1.5" fill="#76726B">PROBLEMS SOLVED</text>
            <text x={W / 2 + 130} y="510" textAnchor="middle" fontFamily="Georgia, serif" fontWeight="700" fontSize="36" fill="#171716">{avgScore}%</text>
            <text x={W / 2 + 130} y="534" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="11" letterSpacing="1.5" fill="#76726B">AVERAGE SCORE</text>
            <line x1={W / 2} y1="492" x2={W / 2} y2="540" stroke="#EAE3D4" strokeWidth="1.5" />

            {/* seal */}
            <g transform={`translate(${W - 150}, 600)`}>
              <circle r="40" fill="none" stroke="#5C31FF" strokeWidth="2" />
              <circle r="33" fill="none" stroke="#C9B8FF" strokeWidth="1" strokeDasharray="3 3" />
              <text x="0" y="-3" textAnchor="middle" fontSize="22" fill="#5C31FF">★</text>
              <text x="0" y="16" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="8" letterSpacing="1.5" fill="#5C31FF">VERIFIED</text>
            </g>

            {/* signature + date */}
            <line x1="110" y1="612" x2="300" y2="612" stroke="#171716" strokeWidth="1" />
            <text x="205" y="606" textAnchor="middle" fontFamily="Georgia, serif" fontStyle="italic" fontSize="18" fill="#171716">CodeForge</text>
            <text x="205" y="632" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="10" letterSpacing="1" fill="#76726B">AUTHORIZED PLATFORM</text>
            <text x={W / 2} y="636" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="13" fill="#76726B">Issued on {date}</text>
          </svg>
        </div>
      </div>
    </div>
  )
}
