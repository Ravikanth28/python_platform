/**
 * CodeForge brand mark — a custom terminal-prompt glyph (chevron + cursor),
 * drawn crisp at any size. Flat white-on-brand, no gradients (per the system).
 *
 * <Logo />              → glyph only (inherits white), drop inside a brand tile
 * <Logo tile />         → glyph on the sacred-purple rounded tile
 * <Logo tile size={48}/>→ larger lockup
 */
export function LogoMark({ size = 22, className = '', strokeWidth = 2.4 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {/* prompt chevron › */}
      <path
        d="M7 7.5 L12.5 12 L7 16.5"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* cursor underscore _ */}
      <path
        d="M13.5 16.5 L18 16.5"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </svg>
  )
}

export default function Logo({ size = 32, radius, tile = true, className = '' }) {
  const r = radius ?? Math.round(size * 0.28)
  if (!tile) return <LogoMark size={Math.round(size * 0.62)} className={className} />
  return (
    <span
      className={`inline-flex items-center justify-center bg-brand-solid text-white shadow-xs ${className}`}
      style={{ width: size, height: size, borderRadius: r }}
    >
      <LogoMark size={Math.round(size * 0.62)} />
    </span>
  )
}
