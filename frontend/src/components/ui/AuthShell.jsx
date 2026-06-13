import { CheckCircle2 } from 'lucide-react'
import { LogoMark } from './Logo'
import ThemeToggle from './ThemeToggle'

const FEATURES = [
  'Write, run & submit Python right in the browser',
  'Instant test-case feedback with expected vs your output',
  'Step-by-step code visualizer — watch variables change',
  'AI tutor for hints when you get stuck',
]

export default function AuthShell({ children }) {
  return (
    <div className="min-h-screen flex bg-beige-pg">
      {/* Brand panel */}
      <div
        className="hidden lg:flex lg:w-[45%] xl:w-[42%] relative flex-col justify-between p-12 overflow-hidden"
        style={{ background: 'var(--brand-solid)' }}
      >
        {/* soft decorative shapes */}
        <div className="pointer-events-none absolute -top-24 -left-24 w-80 h-80 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }} />
        <div className="pointer-events-none absolute -bottom-32 -right-16 w-96 h-96 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }} />

        <div className="relative flex items-center gap-2.5">
          <span className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center text-white"><LogoMark size={22} /></span>
          <span className="text-white font-bold text-lg tracking-tight">CodeForge</span>
        </div>

        <div className="relative max-w-md">
          <h1 className="text-white font-serif font-semibold text-[34px] leading-[1.15] tracking-tight">
            Master Python, one problem at a time.
          </h1>
          <p className="text-white/80 mt-4 text-[15px] leading-relaxed">
            A focused workspace to learn Python — write code, get instant feedback, and actually <em>see</em> how your program runs.
          </p>
          <ul className="mt-8 space-y-3">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-white/90 text-[14px]">
                <CheckCircle2 size={18} className="flex-shrink-0 mt-0.5 text-white/70" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-white/55 text-xs">© CodeForge · Python Programming Platform</p>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center px-4 py-10 relative">
        <div className="absolute top-4 right-4"><ThemeToggle /></div>
        <div className="w-full max-w-md animate-fade-in">
          {/* compact brand for small screens (brand panel hidden) */}
          <div className="lg:hidden flex flex-col items-center mb-8">
            <span className="w-12 h-12 rounded-xl bg-brand-solid flex items-center justify-center text-white mb-3"><LogoMark size={26} /></span>
            <h1 className="font-sans font-bold text-t text-2xl tracking-tight">CodeForge</h1>
            <p className="text-t3 text-[13px] mt-0.5">Python Programming Platform</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
