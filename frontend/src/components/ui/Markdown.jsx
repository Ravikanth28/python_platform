// Tiny, dependency-free Markdown renderer for AI tutor replies.
// Supports: fenced code blocks, inline code, bold, italic, headings,
// and bullet / numbered lists. Everything else renders as plain text.

function renderInline(text, keyp) {
  const nodes = []
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g
  let last = 0
  let m
  let i = 0
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index))
    const tok = m[0]
    if (tok.startsWith('**')) {
      nodes.push(<strong key={`${keyp}-b${i}`} className="font-semibold text-t">{tok.slice(2, -2)}</strong>)
    } else if (tok.startsWith('`')) {
      nodes.push(
        <code
          key={`${keyp}-c${i}`}
          className="font-mono text-[12px] px-1 py-0.5 rounded"
          style={{ background: 'var(--brandGhost)', color: 'var(--brand)' }}
        >
          {tok.slice(1, -1)}
        </code>
      )
    } else {
      nodes.push(<em key={`${keyp}-i${i}`} className="italic">{tok.slice(1, -1)}</em>)
    }
    last = m.index + tok.length
    i++
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

export default function Markdown({ text }) {
  const blocks = []
  const parts = String(text ?? '').split('```')

  parts.forEach((part, pi) => {
    // odd segments are fenced code blocks
    if (pi % 2 === 1) {
      const code = part.replace(/^[a-zA-Z0-9+#-]*\n/, '').replace(/\n$/, '')
      blocks.push(
        <pre
          key={`code-${pi}`}
          className="font-mono text-[12px] leading-relaxed rounded-lg border border-line surface-inset px-3 py-2 overflow-x-auto whitespace-pre"
          style={{ color: 'var(--t2)' }}
        >
          {code}
        </pre>
      )
      return
    }

    const lines = part.split('\n')
    let list = null // { ordered, items: [] }
    const flush = (key) => {
      if (!list) return
      const Tag = list.ordered ? 'ol' : 'ul'
      blocks.push(
        <Tag
          key={key}
          className={`${list.ordered ? 'list-decimal' : 'list-disc'} pl-5 space-y-1 text-t2`}
        >
          {list.items.map((it, idx) => <li key={idx}>{renderInline(it, `${key}-${idx}`)}</li>)}
        </Tag>
      )
      list = null
    }

    lines.forEach((line, li) => {
      const t = line.trim()
      const key = `${pi}-${li}`
      if (!t) { flush(`fl-${key}`); return }

      const ol = t.match(/^(\d+)\.\s+(.*)/)
      const ul = t.match(/^[-*]\s+(.*)/)
      const h = t.match(/^(#{1,3})\s+(.*)/)

      if (ol) {
        if (!list || !list.ordered) { flush(`fl-${key}`); list = { ordered: true, items: [] } }
        list.items.push(ol[2]); return
      }
      if (ul) {
        if (!list || list.ordered) { flush(`fl-${key}`); list = { ordered: false, items: [] } }
        list.items.push(ul[1]); return
      }
      flush(`fl-${key}`)
      if (h) {
        blocks.push(<p key={key} className="font-semibold text-t mt-1">{renderInline(h[2], key)}</p>)
      } else {
        blocks.push(<p key={key} className="text-t2">{renderInline(t, key)}</p>)
      }
    })
    flush(`fl-end-${pi}`)
  })

  return <div className="space-y-2 text-[13px] leading-relaxed">{blocks}</div>
}
