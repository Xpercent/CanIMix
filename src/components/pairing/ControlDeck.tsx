import { ChevronRight, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ControlDeck({
  count,
  clearing,
  onClear,
  onTest,
}: {
  count: number
  clearing: boolean
  onClear: () => void
  onTest: () => void
}) {
  const canTest = count >= 2 && !clearing
  const hinting = count === 1

  return (
    <div className="po-console">
      <button
        type="button"
        aria-label="清空检测台"
        className="po-clear"
        disabled={count === 0 || clearing}
        onClick={onClear}
      >
        <RotateCcw size={13} strokeWidth={1.9} aria-hidden="true" />
        <span>清空</span>
      </button>

      <button
        type="button"
        aria-label={
          canTest ? `开始检测，共 ${count} 项` : '至少选择 2 项后才能检测'
        }
        className={cn('po-test', canTest && 'is-active', hinting && 'is-hinting')}
        disabled={!canTest}
        onClick={onTest}
      >
        <span className="po-test-sheen" aria-hidden="true" />
        <span className="po-test-label">
          {hinting ? '再选 1 项开始检测' : '开始检测'}
        </span>
        <span className="po-test-count" aria-hidden="true">
          {count} 项
        </span>
        <ChevronRight className="po-test-chevron" size={14} strokeWidth={2.2} aria-hidden="true" />
      </button>
    </div>
  )
}
