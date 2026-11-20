import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { MousePointerClick } from 'lucide-react'
import { cn } from '@/lib/utils'
import { prefersReducedMotion } from '@/components/pairing/motion'
import type { TourStep } from './tour-steps'

interface TourLayout {
  side: 'left' | 'right'
  /** 卡片贴在目标的哪一侧：桌面在左右，手机竖屏在上下 */
  dock: 'side' | 'top' | 'bottom'
  /** 卡片就贴在目标旁边（而不是退到屏幕边缘） */
  adjacent: boolean
  cardX: number
  cardY: number
  cardW: number
  cardH: number
  /** 目标仍在手机视口内时才画连接线和高亮环 */
  anchorVisible: boolean
  startX: number
  startY: number
  endX: number
  endY: number
  ringX: number
  ringY: number
  ringW: number
  ringH: number
  ringRadius: number
}

interface TourLayerProps {
  step: TourStep
  stepIndex: number
  steps: readonly TourStep[]
  stageRef: RefObject<HTMLElement | null>
  phoneRef: RefObject<HTMLElement | null>
  nudge: { text: string; nonce: number } | null
  /** 结束或跳过引导时先播放退场动画，再真正卸载 */
  exiting: boolean
  /** 手机竖屏：卡片改为贴边停靠的浮动卡，不再占用手机两侧的空白 */
  compact: boolean
  onSkip: () => void
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), Math.max(min, max))

/** 找出目标最近的滚动容器，引导只滚它，不动整页。 */
function findScroller(target: HTMLElement) {
  let scroller = target.parentElement
  while (scroller && scroller !== document.body) {
    const style = window.getComputedStyle(scroller)
    if (
      /(auto|scroll)/.test(style.overflowY) &&
      scroller.scrollHeight > scroller.clientHeight + 4
    ) {
      return scroller
    }
    scroller = scroller.parentElement
  }
  return null
}

/**
 * 把被滚动容器裁掉的目标滚回视野，再让高亮环跟着它走。
 */
function revealTarget(target: HTMLElement) {
  const scroller = findScroller(target)
  if (!scroller) return

  const box = scroller.getBoundingClientRect()
  const rect = target.getBoundingClientRect()
  const margin = 14
  if (rect.top >= box.top + margin && rect.bottom <= box.bottom - margin) return

  scroller.scrollTo({
    top: scroller.scrollTop + box.top + box.height / 2 - (rect.top + rect.height / 2),
    behavior: prefersReducedMotion() ? 'auto' : 'smooth',
  })
}

/** 每帧都在测量，数值抖动小于 0.6px 时沿用旧 layout，避免卡片抖。 */
function sameLayout(previous: TourLayout | null, next: TourLayout) {
  if (!previous) return false
  const keys = Object.keys(next) as (keyof TourLayout)[]
  return keys.every((key) => {
    const a = previous[key]
    const b = next[key]
    if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < 0.6
    return a === b
  })
}

export function TourLayer({
  step,
  stepIndex,
  steps,
  stageRef,
  phoneRef,
  nudge,
  exiting,
  compact,
  onSkip,
}: TourLayerProps) {
  const cardRef = useRef<HTMLElement>(null)
  const revealedFor = useRef<string | null>(null)
  /** 目标停稳后再定卡片位置：面板滑入/列表滚动时别让卡片来回跳 */
  const settle = useRef({ key: '', since: 0 })
  /** 本步的停靠方式定下来就不再变，卡片只跟着目标平移 */
  const pinnedDock = useRef<{ dock: 'top' | 'bottom'; adjacent: boolean } | null>(null)
  const [layout, setLayout] = useState<TourLayout | null>(null)

  useEffect(() => {
    let frame = 0
    const hideAnchor = () =>
      setLayout((previous) =>
        previous?.anchorVisible ? { ...previous, anchorVisible: false } : previous,
      )
    const measure = () => {
      frame = window.requestAnimationFrame(measure)

      const stage = stageRef.current
      const phone = phoneRef.current
      if (!stage || !phone) return
      const target = document.querySelector<HTMLElement>(step.target)
      // 结果面板收起或目标被移除时，连线不应追着元素跑，立即隐藏
      if (!target) {
        hideAnchor()
        return
      }

      const stageRect = stage.getBoundingClientRect()
      const phoneRect = phone.getBoundingClientRect()
      let targetRect = target.getBoundingClientRect()
      const onPhone =
        targetRect.width > 1 &&
        targetRect.height > 1 &&
        targetRect.bottom > phoneRect.top + 2 &&
        targetRect.top < phoneRect.bottom - 2 &&
        targetRect.right > phoneRect.left + 2 &&
        targetRect.left < phoneRect.right - 2
      // 面板开始收起时目标还在 DOM 里，但不应继续带动连线
      if (!onPhone || target.closest('.is-closing')) {
        hideAnchor()
        return
      }

      const ring = {
        ringX: targetRect.left - stageRect.left - 4,
        ringY: targetRect.top - stageRect.top - 4,
        ringW: targetRect.width + 8,
        ringH: targetRect.height + 8,
        ringRadius: clamp(Math.min(targetRect.width, targetRect.height) * 0.22, 10, 24),
      }
      const cardH = cardRef.current?.offsetHeight ?? (compact ? 240 : 220)

      // ── 手机竖屏：卡片就近贴在目标旁边，贴不下才退回屏幕上下边缘 ──
      if (compact) {
        const edge = 16
        const topLimit = 12
        const bottomLimit = stageRect.height - 12
        // 不撑满屏幕：留出两边空白，读起来像一张提示卡而不是一堵墙
        const cardW = Math.round(Math.min(304, stageRect.width - edge * 2))
        const gap = 10

        if (revealedFor.current !== step.id) {
          revealedFor.current = step.id
          revealTarget(target)
        }

        // 目标还在滑入/滚动时先不摆卡片，等它停稳再一次性出现；
        // 出现之后就跟着目标走，不再来回换边
        const posKey = `${Math.round(targetRect.top)}|${Math.round(targetRect.left)}|${Math.round(targetRect.height)}`
        const now = performance.now()
        if (settle.current.key !== posKey) settle.current = { key: posKey, since: now }
        const settled = now - settle.current.since >= 130

        const targetTop = targetRect.top - stageRect.top
        const targetBottom = targetRect.bottom - stageRect.top
        const targetCx = targetRect.left - stageRect.left + targetRect.width / 2
        const targetCy = targetTop + targetRect.height / 2

        if (!pinnedDock.current) {
          if (!settled) return
          // 优先贴目标下沿，其次贴上沿；两边都放不下才退到屏幕边缘
          const belowY = targetBottom + gap
          const aboveY = targetTop - gap - cardH
          pinnedDock.current =
            belowY + cardH <= bottomLimit
              ? { dock: 'bottom', adjacent: true }
              : aboveY >= topLimit
                ? { dock: 'top', adjacent: true }
                : targetCy < stageRect.height / 2
                  ? { dock: 'bottom', adjacent: false }
                  : { dock: 'top', adjacent: false }
        }

        const { dock, adjacent } = pinnedDock.current
        const cardY = adjacent
          ? clamp(
              dock === 'bottom' ? targetBottom + gap : targetTop - gap - cardH,
              topLimit,
              bottomLimit - cardH,
            )
          : dock === 'bottom'
            ? bottomLimit - cardH
            : topLimit

        // 横向跟着目标走，撞到屏幕边就夹住
        const cardX = clamp(
          Math.round(targetCx - cardW / 2),
          edge,
          Math.round(stageRect.width - cardW - edge),
        )
        const cardAbove = cardY + cardH <= targetCy
        const startX = clamp(targetCx, cardX + 24, cardX + cardW - 24)
        const startY = cardAbove ? cardY + cardH : cardY

        setLayout((previous) => {
          const next: TourLayout = {
            side: 'right',
            dock,
            adjacent,
            cardX,
            cardY,
            cardW,
            cardH,
            anchorVisible: true,
            startX,
            startY,
            endX: targetCx,
            endY: targetCy,
            ringX: targetRect.left - stageRect.left - 4,
            ringY: targetRect.top - stageRect.top - 4,
            ringW: targetRect.width + 8,
            ringH: targetRect.height + 8,
            ringRadius: clamp(Math.min(targetRect.width, targetRect.height) * 0.22, 10, 24),
          }
          return sameLayout(previous, next) ? previous : next
        })
        return
      }

      if (revealedFor.current !== step.id) {
        revealedFor.current = step.id
        revealTarget(target)
      }

      const leftSpace = phoneRect.left - stageRect.left
      const rightSpace = stageRect.right - phoneRect.right
      const targetCx = targetRect.left - stageRect.left + targetRect.width / 2
      const targetCy = targetRect.top - stageRect.top + targetRect.height / 2
      const phoneCx = phoneRect.left - stageRect.left + phoneRect.width / 2
      // 优先把卡片放在目标所在的一侧，连接线就不用横穿整个屏幕
      const targetOnLeft = targetCx < phoneCx - 4
      const side: 'left' | 'right' = targetOnLeft
        ? leftSpace >= 250
          ? 'left'
          : 'right'
        : rightSpace >= 250
          ? 'right'
          : 'left'
      const space = side === 'left' ? leftSpace : rightSpace
      const gap = clamp(space * 0.13, 20, 48)
      const cardW = Math.round(clamp(space - gap - 18, 240, 380))

      let cardX =
        side === 'right'
          ? phoneRect.right - stageRect.left + gap
          : phoneRect.left - stageRect.left - gap - cardW
      cardX = clamp(cardX, 14, stageRect.width - cardW - 14)

      const cardMaxY = stageRect.height - cardH - 16
      const lift = (step.lift ?? 0) + cardH * (step.liftCards ?? 0)
      const cardY = clamp(
        clamp(targetCy - cardH / 2, 16, cardMaxY) - lift,
        16,
        cardMaxY,
      )
      const startX = side === 'right' ? cardX : cardX + cardW
      const startY = clamp(targetCy, cardY + 30, cardY + cardH - 30)

      const next: TourLayout = {
        side,
        dock: 'side',
        adjacent: false,
        cardX,
        cardY,
        cardW,
        cardH,
        anchorVisible: true,
        startX,
        startY,
        endX: targetCx,
        endY: targetCy,
        ...ring,
      }

      setLayout((previous) => (sameLayout(previous, next) ? previous : next))
    }

    frame = window.requestAnimationFrame(measure)
    return () => window.cancelAnimationFrame(frame)
  }, [step.id, step.target, step.lift, step.liftCards, stageRef, phoneRef, compact])

  // 连接线弯度不进 layout 比较，按当前 layout 直接算。
  const vertical = layout?.dock !== 'side'
  const bend = layout
    ? Math.max(42, Math.abs(layout.endX - layout.startX) * 0.46)
    : 0
  const vBend = layout ? Math.max(28, Math.abs(layout.endY - layout.startY) * 0.5) : 0
  const vDir = layout && layout.startY < layout.endY ? 1 : -1
  const path = layout
    ? vertical
      ? `M ${layout.startX} ${layout.startY} C ${layout.startX} ${layout.startY + vDir * vBend}, ${layout.endX} ${layout.endY - vDir * vBend}, ${layout.endX} ${layout.endY}`
      : layout.side === 'right'
        ? `M ${layout.startX} ${layout.startY} C ${layout.startX + bend} ${layout.startY}, ${layout.endX - bend} ${layout.endY}, ${layout.endX} ${layout.endY}`
        : `M ${layout.startX} ${layout.startY} C ${layout.startX - bend} ${layout.startY}, ${layout.endX + bend} ${layout.endY}, ${layout.endX} ${layout.endY}`
    : ''
  /** 卡片贴在目标旁边时不需要气泡，退到屏幕边缘时才用气泡指路 */
  const showAction = Boolean(layout && !layout.adjacent)
  const actionBelow = Boolean(layout && layout.dock === 'top')

  const total = steps.length

  return (
    <div
      className={cn(
        'po-tour',
        compact && 'is-compact',
        layout && 'is-ready',
        exiting && 'is-leaving',
      )}
      data-dock={layout?.dock ?? 'side'}
    >
      <svg aria-hidden="true" className="po-tour-link">
        {layout?.anchorVisible && (
          <>
            <path className="po-tour-link-glow" d={path} />
            <path className="po-tour-link-line" d={path} />
            <circle
              className="po-tour-link-dot"
              cx={layout.endX}
              cy={layout.endY}
              r="3.4"
            />
          </>
        )}
      </svg>

      {layout?.anchorVisible && (
        <>
          <span
            className="po-tour-spot"
            aria-hidden="true"
            style={
              {
                left: layout.ringX,
                top: layout.ringY,
                width: layout.ringW,
                height: layout.ringH,
                borderRadius: layout.ringRadius,
              } as CSSProperties
            }
          />
          <span
            className="po-tour-spot po-tour-spot-pulse"
            aria-hidden="true"
            style={
              {
                left: layout.ringX,
                top: layout.ringY,
                width: layout.ringW,
                height: layout.ringH,
                borderRadius: layout.ringRadius,
              } as CSSProperties
            }
          />
          {step.actionLabel && showAction && (
            <span
              className={cn('po-tour-action', actionBelow && 'is-below')}
              aria-hidden="true"
              style={{
                left: layout.ringX + layout.ringW / 2,
                top: actionBelow ? layout.ringY + layout.ringH + 8 : layout.ringY - 8,
              }}
            >
              {step.actionLabel}
            </span>
          )}
        </>
      )}

      <aside
        aria-label="使用引导"
        className="po-tour-card"
        data-dock={layout?.dock ?? 'side'}
        data-side={layout?.side ?? 'right'}
        ref={cardRef}
        style={
          {
            left: layout?.cardX ?? 0,
            top: layout?.cardY ?? 0,
            width: layout?.cardW ?? 300,
          } as CSSProperties
        }
      >
        <div className="po-tour-card-inner" key={step.id}>
          <span className="po-tour-track" aria-hidden="true">
            <span
              className="po-tour-track-fill"
              style={{ width: `${((stepIndex + 1) / total) * 100}%` }}
            />
          </span>

          <header className="po-tour-head">
            <span className="po-tour-kicker">
              <span className="po-tour-glyph" aria-hidden="true">
                <svg fill="none" viewBox="0 0 12 12">
                  <circle cx="6" cy="6" fill="currentColor" r="1.6" />
                  <path
                    d="M6 .8v2.4M6 8.8v2.4M.8 6h2.4M8.8 6h2.4"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeWidth="1"
                  />
                </svg>
              </span>
              GUIDED TOUR
            </span>
            <span className="po-tour-count">
              {String(stepIndex + 1).padStart(2, '0')}
              <span> / {String(total).padStart(2, '0')}</span>
            </span>
          </header>

          <h2 className="po-tour-title">{step.title}</h2>
          <p className="po-tour-body">
            {compact ? step.bodyShort ?? step.body : step.body}
          </p>

          {nudge && (
            <p className="po-tour-nudge" key={nudge.nonce} role="status">
              {nudge.text}
            </p>
          )}

          <footer className="po-tour-foot">
            <span className="po-tour-hint">
              <span className="po-tour-tap" aria-hidden="true">
                <MousePointerClick size={14} strokeWidth={1.9} />
              </span>
              {step.hint}
            </span>
            <span className="po-tour-dots" aria-hidden="true">
              {steps.map((entry, index) => (
                <span
                  className={cn('po-tour-dot', index === stepIndex && 'is-active')}
                  key={entry.id}
                />
              ))}
            </span>
            <button className="po-tour-skip" onClick={onSkip} type="button">
              跳过引导
            </button>
          </footer>

          <p className="po-sr-only" role="status" aria-live="polite">
            第 {stepIndex + 1} 步，共 {total} 步：{step.title}
          </p>
        </div>
      </aside>
    </div>
  )
}
