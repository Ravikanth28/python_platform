import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { X, ArrowRight, ArrowLeft, Sparkles } from 'lucide-react'

const SPOT_PAD = 8
const GAP = 14
const CARD_W = 340
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

/**
 * Lightweight guided tour with a spotlight on the target element and a
 * step card. Steps: { selector?, title, body, placement?, onEnter? }.
 * A step without a selector is shown centered (welcome / finish).
 */
export default function EditorTour({ open, steps, onClose }) {
  const [i, setI] = useState(0)
  const [rect, setRect] = useState(null)
  const [cardH, setCardH] = useState(180)
  const cardRef = useRef(null)

  const step = steps[i]
  const isCenter = !step?.selector
  const last = i === steps.length - 1

  useEffect(() => { if (open) setI(0) }, [open])

  // run any side-effect the step wants (e.g. switch a tab) before measuring
  useEffect(() => {
    if (open && step?.onEnter) step.onEnter()
  }, [open, i]) // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    if (!open) return
    const measure = () => {
      if (isCenter) { setRect(null); return }
      const el = document.querySelector(step.selector)
      if (!el) { setRect(null); return }
      const r = el.getBoundingClientRect()
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
    }
    const id = requestAnimationFrame(measure)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      cancelAnimationFrame(id)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [open, i, isCenter, step])

  useLayoutEffect(() => {
    if (cardRef.current) setCardH(cardRef.current.getBoundingClientRect().height)
  }, [i, open, rect])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') setI((p) => (p === steps.length - 1 ? p : p + 1))
      else if (e.key === 'ArrowLeft') setI((p) => Math.max(0, p - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, steps.length, onClose])

  if (!open || !step) return null

  const next = () => (last ? onClose() : setI(i + 1))
  const prev = () => setI(Math.max(0, i - 1))

  const vw = window.innerWidth
  const vh = window.innerHeight

  // card position
  let top, left
  if (isCenter || !rect) {
    top = vh / 2 - cardH / 2
    left = vw / 2 - CARD_W / 2
  } else {
    const spaceBottom = vh - (rect.top + rect.height)
    const spaceTop = rect.top
    const spaceRight = vw - (rect.left + rect.width)
    const place = step.placement || (
      spaceBottom > cardH + GAP + 20 ? 'bottom'
      : spaceTop > cardH + GAP + 20 ? 'top'
      : spaceRight > rect.left ? 'right' : 'left'
    )
    if (place === 'right') { left = rect.left + rect.width + GAP; top = rect.top + rect.height / 2 - cardH / 2 }
    else if (place === 'left') { left = rect.left - CARD_W - GAP; top = rect.top + rect.height / 2 - cardH / 2 }
    else if (place === 'top') { top = rect.top - cardH - GAP; left = rect.left + rect.width / 2 - CARD_W / 2 }
    else { top = rect.top + rect.height + GAP; left = rect.left + rect.width / 2 - CARD_W / 2 }
    left = clamp(left, 12, vw - CARD_W - 12)
    top = clamp(top, 12, vh - cardH - 12)
  }

  return (
    <div className="fixed inset-0 z-[200]" role="dialog" aria-modal="true">
      {/* click catcher (blocks interaction with the app during the tour) */}
      <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} />

      {/* spotlight (or full dim for centered steps) */}
      {rect && !isCenter ? (
        <div
          className="pointer-events-none"
          style={{
            position: 'fixed',
            top: rect.top - SPOT_PAD,
            left: rect.left - SPOT_PAD,
            width: rect.width + SPOT_PAD * 2,
            height: rect.height + SPOT_PAD * 2,
            borderRadius: 10,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.62)',
            outline: '2px solid var(--brand)',
            transition: 'top .22s ease, left .22s ease, width .22s ease, height .22s ease',
          }}
        />
      ) : (
        <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.62)' }} />
      )}

      {/* step card */}
      <div
        ref={cardRef}
        className="fixed rounded-xl border border-line bg-surface shadow-lg p-4 animate-fade-in"
        style={{ top, left, width: CARD_W, transition: 'top .2s ease, left .2s ease' }}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: 'var(--brand)' }}>
            <Sparkles size={13} /> Guided tour
          </span>
          <button onClick={onClose} className="text-t4 hover:text-t transition-colors" title="Skip tour" aria-label="Skip tour">
            <X size={15} />
          </button>
        </div>

        <h3 className="font-serif font-semibold text-t text-[16px] leading-snug mb-1.5">{step.title}</h3>
        <p className="text-[13px] text-t2 leading-relaxed">{step.body}</p>

        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-1.5">
            {steps.map((_, idx) => (
              <span
                key={idx}
                className="rounded-full transition-all"
                style={{
                  width: idx === i ? 16 : 6, height: 6,
                  background: idx === i ? 'var(--brand)' : 'var(--bd)',
                }}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {i > 0 && (
              <button onClick={prev} className="btn-secondary btn-sm">
                <ArrowLeft size={13} /> Back
              </button>
            )}
            <button onClick={next} className="btn-primary btn-sm">
              {last ? 'Got it' : 'Next'} {!last && <ArrowRight size={13} />}
            </button>
          </div>
        </div>

        {!last && (
          <button onClick={onClose} className="mt-2 w-full text-center text-[11px] text-t4 hover:text-t3 transition-colors">
            Skip tour
          </button>
        )}
      </div>
    </div>
  )
}
