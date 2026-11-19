import { useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import type { Finding, SafePair } from '../pairing-engine'
import { FindingCard } from './finding-card'

interface SafeFoldProps {
  label: string
  pairs: SafePair[]
  notes: Finding[]
  artById: Map<string, string>
  defaultOpen?: boolean
}

export function SafeFold({
  label,
  pairs,
  notes,
  artById,
  defaultOpen = false,
}: SafeFoldProps) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <details
      className="po-safe-fold"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        <span>{label}</span>
        <span className="po-details-chevron" aria-hidden="true">
          <ChevronDown size={13} strokeWidth={2.1} />
        </span>
      </summary>
      <div className="po-safe-body">
        {pairs.length > 0 && (
          <div className="po-safe-pairs">
            {pairs.map((pair) => (
              <SafePairRow artById={artById} key={pair.key} pair={pair} />
            ))}
          </div>
        )}
        {notes.length > 0 && (
          <div className="po-safe-notes">
            {notes.map((finding) => (
              <FindingCard artById={artById} finding={finding} key={finding.key} />
            ))}
          </div>
        )}
      </div>
    </details>
  )
}

function SafePairRow({
  pair,
  artById,
}: {
  pair: SafePair
  artById: Map<string, string>
}) {
  const [a, b] = pair.items
  return (
    <div className="po-safe-pair">
      <span className="po-safe-pair-items">
        <span className="po-safe-mini">
          {artById.get(a.id) ? (
            <img alt="" decoding="async" draggable={false} src={artById.get(a.id)} />
          ) : null}
          <span>{a.name}</span>
        </span>
        <span className="po-safe-join" aria-hidden="true">
          与
        </span>
        <span className="po-safe-mini">
          {artById.get(b.id) ? (
            <img alt="" decoding="async" draggable={false} src={artById.get(b.id)} />
          ) : null}
          <span>{b.name}</span>
        </span>
      </span>
      <span className="po-safe-check">
        <Check size={11} strokeWidth={2.4} aria-hidden="true" />
        未发现已知冲突
      </span>
    </div>
  )
}