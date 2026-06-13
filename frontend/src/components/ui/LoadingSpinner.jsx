export default function LoadingSpinner({ size = 'md', text }) {
  const sz = { sm: 'h-4 w-4', md: 'h-8 w-8', lg: 'h-10 w-10' }[size] || 'h-8 w-8'
  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <div
        className={`${sz} rounded-full animate-spin`}
        style={{ border: '2px solid var(--b)', borderTopColor: 'var(--brand)' }}
      />
      {text && <p className="text-[13px] text-t3">{text}</p>}
    </div>
  )
}

export function PageLoader() {
  return (
    <div className="flex h-full min-h-[300px] items-center justify-center">
      <LoadingSpinner size="lg" text="Loading…" />
    </div>
  )
}
