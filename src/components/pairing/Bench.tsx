import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  type Ref,
} from 'react'
import { Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MAX_SLOTS, type PairingItem } from './pairing-data'
import {
  prefersReducedMotion,
  SLOT_CLEAR_EASING,
  SLOT_CLEAR_MS,
  SLOT_CLEAR_STAGGER_MS,
  SLOT_EXIT_EASING,
  SLOT_EXIT_MS,
  SLOT_FLIP_EASING,
  SLOT_FLIP_MS,
} from './motion'
import { SwapText } from './SwapText'
import type { Notice } from './types'

const pad2 = (value: number) => String(value).padStart(2, '0')

const EXIT_KEYFRAMES: Keyframe[] = [
  { opacity: 1, transform: 'scale(1)' },
  { opacity: 0, transform: 'scale(.94)' },
]

const CLEAR_KEYFRAMES: Keyframe[] = [
  { opacity: 1, transform: 'scale(1) translateY(0)' },
  { opacity: 0, transform: 'scale(.94) translateY(2px)' },
]

export interface BenchHandle {
  exitItem: (id: string) => void
  exitAll: () => void
}

interface BenchProps {
  items: PairingItem[]
  count: number
  metaState: string
  hint: string
  notice: Notice | null
  landingIds: Set<string>
  shakeNonce: number
  testNonce: number
  onRemove: (id: string) => void
  onClear: () => void
}

export function Bench({
  ref,
  items,
  count,
  metaState,
  hint,
  notice,
  landingIds,
  shakeNonce,
  testNonce,
  onRemove,
  onClear,
}: BenchProps & { ref?: Ref<BenchHandle> }) {
  const railRef = useRef<HTMLDivElement>(null)
  const flareRef = useRef<HTMLSpanElement>(null)
  const slotRects = useRef<Map<string, DOMRect>>(new Map())
  const exitAnimations = useRef<Map<string, Animation>>(new Map())
  const clearing = useRef(false)
  const signature = items.map((item) => item.id).join('|')

  const exitItem = useCallback(
    (id: string) => {
      if (exitAnimations.current.has(id)) return
      const card = railRef.current?.querySelector<HTMLElement>(`[data-slot-item="${id}"]`)
      if (!card || prefersReducedMotion()) {
        onRemove(id)
        return
      }

      const animation = card.animate(EXIT_KEYFRAMES, {
        duration: SLOT_EXIT_MS,
        easing: SLOT_EXIT_EASING,
        fill: 'forwards',
      })
      exitAnimations.current.set(id, animation)
      animation.onfinish = () => {
        exitAnimations.current.delete(id)
        onRemove(id)
      }
      animation.oncancel = () => exitAnimations.current.delete(id)
    },
    [onRemove],
  )

  const exitAll = useCallback(() => {
    if (clearing.current) return
    const cards = railRef.current
      ? Array.from(railRef.current.querySelectorAll<HTMLElement>('[data-slot-item]'))
      : []
    if (cards.length === 0 || prefersReducedMotion()) {
      onClear()
      return
    }

    clearing.current = true
    const animations = cards.map((card, index) =>
      card.animate(CLEAR_KEYFRAMES, {
        duration: SLOT_CLEAR_MS,
        delay: index * SLOT_CLEAR_STAGGER_MS,
        easing: SLOT_CLEAR_EASING,
        fill: 'forwards',
      }),
    )
    void Promise.allSettled(animations.map((animation) => animation.finished)).then(() => {
      clearing.current = false
      onClear()
    })
  }, [onClear])

  useImperativeHandle(ref, () => ({ exitItem, exitAll }), [exitItem, exitAll])

  useLayoutEffect(() => {
    const rail = railRef.current
    if (!rail) return

    const cards = Array.from(rail.querySelectorAll<HTMLElement>('[data-slot-item]'))
    const previous = slotRects.current
    const measured = new Map<string, DOMRect>()
    for (const card of cards) {
      const id = card.dataset.slotItem
      // 槽位格子不做动画，量它才能得到最终落位，避免把上一轮 FLIP 位移量进来
      const cell = card.closest<HTMLElement>('.po-slot-cell')
      if (id && cell) measured.set(id, cell.getBoundingClientRect())
    }

    if (!prefersReducedMotion()) {
      for (const card of cards) {
        const id = card.dataset.slotItem
        const before = id ? previous.get(id) : undefined
        const after = id ? measured.get(id) : undefined
        if (!before || !after) continue
        const deltaX = before.left - after.left
        const deltaY = before.top - after.top
        if (Math.abs(deltaX) > 0.5 || Math.abs(deltaY) > 0.5) {
          card.animate(
            [
              { transform: `translate(${deltaX}px, ${deltaY}px)` },
              { transform: 'translate(0px, 0px)' },
            ],
            { duration: SLOT_FLIP_MS, easing: SLOT_FLIP_EASING },
          )
        }
      }
    }

    slotRects.current = measured
  }, [signature])

  useEffect(() => {
    if (!shakeNonce) return
    const rail = railRef.current
    if (!rail || prefersReducedMotion()) return
    rail.animate(
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
            <SwapText className="po-count-num" text={String(count)} />
            <span className="po-count-total">/5</span>
          </span>
          <span className="po-status-dot" aria-hidden="true" />
          <SwapText className="po-state-label" text={metaState} />
        </span>
      </div>

      <div className="po-slot-rail" ref={railRef}>
        {Array.from({ length: MAX_SLOTS }, (_, index) => {
          const item = items[index]
          const isNext = !item && index === count
          return (
            <div
              className="po-slot-cell"
              data-slot-cell={index}
              data-slot-index={index}
              key={index}
            >
              <div className="po-slot-disc">
                <div className={cn('po-slot-well', isNext && 'is-next')} aria-hidden="true">
                  {isNext ? (
                    <Plus className="po-slot-plus" size={13} strokeWidth={1.6} />
                  ) : (
                    <span className="po-slot-ordinal">{pad2(index + 1)}</span>
                  )}
                </div>
                {item && (
                  <button
                    type="button"
                    aria-label={`移出 ${item.name}，第 ${index + 1} 位`}
                    className={cn('po-slot-card', landingIds.has(item.id) && 'is-landing')}
                    data-slot-item={item.id}
                    key={item.id}
                    onClick={() => exitItem(item.id)}
                    title="轻点移出"
                  >
                    <span className="po-slot-halo" aria-hidden="true" />
                    <img
                      alt=""
                      className="po-slot-art"
                      decoding="async"
                      draggable={false}
                      src={item.art}
                    />
                    <span className="po-slot-x" aria-hidden="true">
                      <X size={8} strokeWidth={2.4} />
                    </span>
                  </button>
                )}
              </div>
              <span className={cn('po-slot-label', !item && 'is-empty')}>
                {item ? item.shortName : ''}
              </span>
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
          <SwapText className="po-hint-default" text={hint} />
        )}
      </div>
      <span className="po-sr-only" aria-live="polite">
        {`${count} / 5，${metaState}。${notice?.text ?? hint}`}
      </span>
    </section>
  )
}