import {
  Check,
  Clock3,
  Sparkles,
  TriangleAlert,
  Zap,
} from 'lucide-react'
import type { Finding } from '../pairing-engine'

export function SeverityGlyph({
  severity,
  size = 14,
}: {
  severity: Finding['severity']
  size?: number
}) {
  if (severity === 'danger') return <Zap size={size} strokeWidth={2} aria-hidden="true" />
  if (severity === 'caution') {
    return <TriangleAlert size={size} strokeWidth={1.9} aria-hidden="true" />
  }
  if (severity === 'spacing') return <Clock3 size={size} strokeWidth={1.9} aria-hidden="true" />
  if (severity === 'synergy') {
    return <Sparkles size={size} strokeWidth={1.9} aria-hidden="true" />
  }
  return <Check size={size} strokeWidth={2.1} aria-hidden="true" />
}

export function SectionLabel({ label, count }: { label: string; count: number }) {
  return (
    <div className="po-section-label">
      <span>{label}</span>
      <span className="po-section-count">{count}</span>
    </div>
  )
}