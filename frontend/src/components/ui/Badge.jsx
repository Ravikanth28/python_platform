export default function Badge({ variant = 'blue', children }) {
  const cls = {
    blue:   'badge-blue',
    brand:  'badge-brand',
    green:  'badge-green',
    red:    'badge-red',
    yellow: 'badge-yellow',
    cyan:   'badge-cyan',
    violet: 'badge-violet',
    gray:   'badge-gray',
  }[variant] || 'badge-blue'

  return <span className={cls}>{children}</span>
}

export function StatusBadge({ status }) {
  const map = {
    Accepted:              'green',
    'Wrong Answer':        'red',
    'Time Limit Exceeded': 'yellow',
    'Compilation Error':   'violet',
    'Runtime Error':       'red',
    Pending:               'gray',
    Passed:                'green',
    Failed:                'red',
  }
  return <Badge variant={map[status] || 'blue'}>{status}</Badge>
}

export function DifficultyBadge({ level }) {
  const map = { easy: 'green', medium: 'yellow', hard: 'red' }
  return <Badge variant={map[level] || 'blue'}>{level}</Badge>
}

export function ModeBadge({ mode }) {
  return <Badge variant={mode === 'test' ? 'violet' : 'cyan'}>{mode}</Badge>
}
