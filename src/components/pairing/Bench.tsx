import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  type CSSProperties,
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

/**
 * 托盘分两层：
 *   1. 凹槽层——固定 5 格，只画空位，永远不动；
 *   2. 物品层——绝对定位，按 item.id 保持节点稳定，位置由索引算出来。
 *
 * 物品换位时节点不重建，位移动画只比较「上一轮的索引」和「这一轮的索引」，
 * 用百分比换算，不缓存任何像素坐标——窗口缩放、台面收起都不会污染它。
 */
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
  const prevIndex = useRef<Map<string, number>>(new Map())
  const exitAnimations = useRef<Map<string, Animation>>(new Map())
  const clearing = useRef(false)

  const cardOf = useCallback(
    (id: string) =>
      railRef.current?.querySelector<HTMLElement>(
        `[data-slot-item="${id}"] .po-slot-card`,
      ) ?? null,
    [],
  )

  const exitItem = useCallback(
    (id: string) => {
      if (exitAnimations.current.has(id)) return
      const card = cardOf(id)
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
    [cardOf, onRemove],
  )

  const exitAll = useCallback(() => {
    if (clearing.current) return
    const cards = railRef.current
      ? Array.from(railRef.current.querySelectorAll<HTMLElement>('[data-slot-item] .po-slot-card'))
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

  // 换位补间：位移量 = 索引差 × 一格宽度。物品宽度恰好等于一格，
  // 所以直接用自身宽度的百分比表达，无需测量像素。
  useLayoutEffect(() => {
    const next = new Map<string, number>()
    items.forEach((item, index) => next.set(item.id, index))

    if (!prefersReducedMotion()) {
      for (const [id, index] of next) {
        const before = prevIndex.current.get(id)
        if (before === undefined || before === index) continue
        const node = railRef.current?.querySelector<HTMLElement>(`[data-slot-item="${id}"]`)
        if (!node) continue
        node.animate(
          [
            { transform: `translateX(${(before - index) * 100}%)` },
            { transform: 'translateX(0%)' },
          ],
          { duration: SLOT_FLIP_MS, easing: SLOT_FLIP_EASING },
        )
      }
    }

    prevIndex.current = next
  }, [items])

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
        {Array.from({ length: MAX_SLOTS }, (_, index) => (
          <div className="po-slot-cell" data-slot-cell={index} key={index}>
            <div className="po-slot-disc">
              <div className={cn('po-slot-well', index === count && 'is-next')} aria-hidden="true">
                <span className="po-slot-ordinal">{pad2(index + 1)}</span>
                <Plus className="po-slot-plus" size={13} strokeWidth={1.6} />
              </div>
            </div>
            <span className="po-slot-label is-empty" aria-hidden="true" />
          </div>
        ))}

        <div className="po-slot-items">
          {items.map((item, index) => (
            <div
              className="po-slot-item"
              data-slot-item={item.id}
              key={item.id}
              style={{ '--slot': index } as CSSProperties}
            >
              <div className="po-slot-disc">
                <button
                  type="button"
                  aria-label={`移出 ${item.name}，第 ${index + 1} 位`}
                  className={cn('po-slot-card', landingIds.has(item.id) && 'is-landing')}
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
              </div>
              <span className="po-slot-label">{item.shortName}</span>
            </div>
          ))}
        </div>
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
