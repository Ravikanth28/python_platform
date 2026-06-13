/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans:  ['DM Sans', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['Source Serif 4', 'Georgia', 'serif'],
        mono:  ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      colors: {
        // ── Katonic semantic tokens (theme-aware via CSS vars) ──
        brand:        'var(--brand)',
        'brand-solid':'var(--brand-solid)',
        'brand-l':    'var(--brandL)',
        'brand-ghost':'var(--brandGhost)',

        beige:        'var(--beige)',
        'beige-pg':   'var(--beige-pg)',
        'beige-card': 'var(--beige-card)',
        'beige-b':    'var(--beige-b)',
        'beige-b2':   'var(--beige-b2)',
        'beige-rule': 'var(--beige-rule)',
        'beige-pill': 'var(--beige-pill)',

        surface:      'var(--s)',
        'surface-h':  'var(--sh)',
        'surface-a':  'var(--sa)',
        line:         'var(--b)',
        'line-strong':'var(--bd)',

        t:   'var(--t)',
        t2:  'var(--t2)',
        t3:  'var(--t3)',
        t4:  'var(--t4)',

        ok:   'var(--ok)',
        warn: 'var(--warn)',
        err:  'var(--err)',
        info: 'var(--info)',

        'd-purple': 'var(--d-purple)',
        'd-cyan':   'var(--d-cyan)',
        'd-rose':   'var(--d-rose)',
        'd-orange': 'var(--d-orange)',

        // ── Back-compat aliases (old class names → brand) ──
        primary: {
          DEFAULT: 'var(--brand)',
          400: 'var(--brand)',
          500: 'var(--brand)',
          600: 'var(--brand-solid)',
        },
        violet: 'var(--d-purple)',
        'dark-300': 'var(--s)',
      },
      borderRadius: {
        xs: '4px', sm: '5px', md: '6px', DEFAULT: '8px', lg: '10px', xl: '12px', '2xl': '14px',
      },
      boxShadow: {
        xs:   'var(--shadow-xs)',
        sm:   'var(--shadow-sm)',
        md:   'var(--shadow-md)',
        lg:   'var(--shadow-lg)',
        focus:'var(--shadow-focus)',
        glow: 'var(--shadow-sm)',
        'glow-sm': 'var(--shadow-xs)',
      },
      transitionTimingFunction: {
        katonic: 'cubic-bezier(.4,0,.2,1)',
      },
      animation: {
        'fade-in':  'fadeIn 0.25s cubic-bezier(.4,0,.2,1)',
        'slide-up': 'slideUp 0.25s cubic-bezier(.4,0,.2,1)',
      },
      keyframes: {
        fadeIn:  { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { transform: 'translateY(12px)', opacity: 0 }, to: { transform: 'translateY(0)', opacity: 1 } },
      },
    },
  },
  plugins: [],
}
