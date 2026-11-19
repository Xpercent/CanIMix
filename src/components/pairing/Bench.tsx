import { useEffect, useLayoutEffect, useRef } from 'react'
import { Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MAX_SLOTS, type PairingItem } from './pairing-data'
import { prefersReducedMotion } from './motion'
import type { Notice } from './types'

const pad2 = (value: number) => String(value).padStart(2, '0')

interface BenchProps {
  items: PairingItem[]
  count: number
  metaState: string
  hint: string
  notice: Notice | null
  landingIds: Set<string>
  shakeNonce: number
  testNonce: number
  onRemove: (index: number) => void
}

export function Bench({
  items,
  count,
  metaState,
  hint,
  notice,
  landingIds,
  shakeNonce,
  testNonce,
  onRemove,
}: BenchProps) {
  const rowRef = useRef<HTMLDivElement>(null)
  const flareRef = useRef<HTMLSpanElement>(null)
  const beforeRects = useRef<Map<string, DOMRect>>(new Map())
  const signature = items.map((item) => item.id).join('|')

  const handleRemove = (index: number, id: string) => {
    const row = rowRef.current
    if (!row) {
      onRemove(index)
      return
    }

    const cards = Array.from(row.querySelectorAll<HTMLElement>('[data-slot-item]'))
    const snapshot = new Map(
      cards.map((card) => [card.dataset.slotItem ?? '', card.getBoundingClientRect()] as const),
    )
    const card = row.querySelector<HTMLElement>(`[data-slot-item="${id}"]`)

    if (card && !prefersReducedMotion()) {
      const animation = card.animate(
        [
          { opacity: 1, transform: 'scale(1)' },
          { opacity: 0, transform: 'scale(.94)' },
        ],
        { duration: 110, easing: 'ease-in', fill: 'forwards' },
      )
      animation.onfinish = () => {
        beforeRects.current = snapshot
        onRemove(index)
      }
    } else {
      beforeRects.current = snapshot
      onRemove(index)
    }
  }

  useLayoutEffect(() => {
    const row = rowRef.current
    const previous = beforeRects.current
    if (!row || previous.size === 0) return
    beforeRects.current = new Map()
    if (prefersReducedMotion()) return

    const cards = Array.from(row.querySelectorAll<HTMLElement>('[data-slot-item]'))
    for (const card of cards) {
      const id = card.dataset.slotItem
      const oldRect = id ? previous.get(id) : undefined
      if (!oldRect) continue
      const newRect = card.getBoundingClientRect()
      const deltaX = oldRect.left - newRect.left
      const deltaY = oldRect.top - newRect.top
      if (Math.abs(deltaX) > 0.5 || Math.abs(deltaY) > 0.5) {
        card.animate(
          [
            { transform: `translate(${deltaX}px, ${deltaY}px)` },
            { transform: 'translate(0px, 0px)' },
          ],
          { duration: 360, easing: 'cubic-bezier(.22,1.02,.36,1)' },
        )
      }
    }
  }, [signature])

  useEffect(() => {
    if (!shakeNonce) return
    const row = rowRef.current
    if (!row || prefersReducedMotion()) return
    row.animate(
      [
        { transform: 'translateX(0)' },
        { transform: 'translateX(-2.5px)' },
        { transform: 'translateX(2.5px)' },
        { transform: 'translateX(-1.5px)' },
        { transform: 'translateX(0)' },
      ],
      { duration: 360, easing: 'ease-out' },
    )
  }, [shakeNonce])

  useEffect(() => {
    if (!testNonce) return
    const flare = flareRef.current
    if (!flare || prefersReducedMotion()) return
    flare.animate(
      [
        { opacity: 0, transform: 'scale(.92)' },
        { opacity: 0.5, offset: 0.35 },
        { opacity: 0, transform: 'scale(1.04)' },
      ],
      { duration: 800, easing: 'ease-out' },
    )
  }, [testNonce])

  return (
    <section className="po-bench" aria-label="检测托盘">
      <span className="po-bench-flare" ref={flareRef} aria-hidden="true" />
      <div className="po-bench-meta">
        <span className="po-bench-id">
          <svg className="po-crosshair" fill="none" viewBox="0 0 12 12" aria-hidden="true">
            <circle cx="6" cy="6" r="3.4" stroke="currentColor" strokeWidth=".9" />
            <circle cx="6" cy="6" r=".9" fill="currentColor" />
            <path
              d="M6 .7v2.1M6 9.2v2.1M.7 6h2.1M9.2 6h2.1"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth=".9"
            />
          </svg>
          检测托盘
        </span>
        <span
          className={cn(
            'po-bench-status',
            count >= 2 && 'is-ready',
            count >= MAX_SLOTS && 'is-full',
          )}
        >
          <span className="po-count">
            <span className="po-count-num" key={count}>
              {count}
            </span>
            <span className="po-count-total">/5</span>
          </span>
          <span className="po-status-dot" aria-hidden="true" />
          <span className="po-state-label" key={metaState}>
            {metaState}
          </span>
        </span>
      </div>

      <div className="po-slot-rail" ref={rowRef}>
        {Array.from({ length: MAX_SLOTS }, (_, index) => {
          const item = items[index]
          return (
            <div
              className="po-slot-cell"
              data-slot-cell={index}
              data-slot-index={index}
              key={index}
            >
              {item ? (
                <button
                  type="button"
                  aria-label={`移出 ${item.name}，第 ${index + 1} 位`}
                  className={cn('po-slot-card', landingIds.has(item.id) && 'is-landing')}
                  data-slot-item={item.id}
                  key={item.id}
                  onClick={() => handleRemove(index, item.id)}
                  title="轻点移出"
                >
                  <span className="po-slot-ordinal">{pad2(index + 1)}</span>
                  <span className="po-slot-halo" aria-hidden="true">
                    <img
                      alt=""
                      className="po-slot-art"
                      decoding="async"
                      draggable={false}
                      src={item.art}
                    />
                  </span>
                  <span className="po-slot-name">{item.shortName}</span>
                  <span className="po-slot-x" aria-hidden="true">
                    <X size={8} strokeWidth={2.4} />
                  </span>
                </button>
              ) : (
                <div
                  className={cn('po-slot-empty', index === count && 'is-next')}
                  aria-hidden="true"
                >
                  <span className="po-slot-ordinal">{pad2(index + 1)}</span>
                  {index === count && (
                    <Plus className="po-slot-plus" size={12} strokeWidth={1.5} />
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="po-bench-hint">
        {notice ? (
          <span
            className={cn('po-notice', notice.tone === 'warn' && 'is-warn')}
            key={notice.nonce}
          >
            {notice.text}
          </span>
        ) : (
          <span className="po-hint-default" key={`${count}-${hint}`}>
            {hint}
          </span>
        )}
      </div>
      <span className="po-sr-only" aria-live="polite">
        {`${count} / 5，${metaState}。${notice?.text ?? hint}`}
      </span>
    </section>
  )
}
