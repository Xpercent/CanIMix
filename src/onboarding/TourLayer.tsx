import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { MousePointerClick } from 'lucide-react'
import { cn } from '@/lib/utils'
import { prefersReducedMotion } from '@/components/pairing/motion'
import type { TourStep } from './tour-steps'

interface TourLayout {
  side: 'left' | 'right'
  cardX: number
  cardY: number
  cardW: number
  cardH: number
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
  onSkip: () => void
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), Math.max(min, max))

/** 把被滚动容器裁掉的目标滚回视野，再让高亮环跟着它走。 */
function revealTarget(target: HTMLElement) {
  let scroller = target.parentElement
  while (scroller && scroller !== document.body) {
    const style = window.getComputedStyle(scroller)
    if (
      /(auto|scroll)/.test(style.overflowY) &&
      scroller.scrollHeight > scroller.clientHeight + 4
    ) {
      break
    }
    scroller = scroller.parentElement
  }
  if (!scroller) return

  const box = scroller.getBoundingClientRect()
  const rect = target.getBoundingClientRect()
  const margin = 14
  if (rect.top >= box.top + margin && rect.bottom <= box.bottom - margin) return

  scroller.scrollTo({
    top: scroller.scrollTop + (rect.top - box.top) - (box.height - rect.height) / 2,
    behavior: prefersReducedMotion() ? 'auto' : 'smooth',
  })
}

export function TourLayer({
  step,
  stepIndex,
  steps,
  stageRef,
  phoneRef,
  nudge,
  onSkip,
}: TourLayerProps) {
  const cardRef = useRef<HTMLElement>(null)
  const revealedFor = useRef<string | null>(null)
  const [layout, setLayout] = useState<TourLayout | null>(null)

  useEffect(() => {
    let frame = 0
    const measure = () => {
      frame = window.requestAnimationFrame(measure)

      const stage = stageRef.current
      const phone = phoneRef.current
      const target = document.querySelector<HTMLElement>(step.target)
      if (!stage || !phone || !target) return

      const stageRect = stage.getBoundingClientRect()
      const phoneRect = phone.getBoundingClientRect()
      const targetRect = target.getBoundingClientRect()
      if (targetRect.width < 1 || targetRect.height < 1) return

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
      const cardH = cardRef.current?.offsetHeight ?? 220

      let cardX =
        side === 'right'
          ? phoneRect.right - stageRect.left + gap
          : phoneRect.left - stageRect.left - gap - cardW
      cardX = clamp(cardX, 14, stageRect.width - cardW - 14)

      const cardY = clamp(
        targetCy - cardH / 2,
        16,
        stageRect.height - cardH - 16,
      )
      const startX = side === 'right' ? cardX : cardX + cardW
      const startY = clamp(targetCy, cardY + 30, cardY + cardH - 30)

      const next: TourLayout = {
        side,
        cardX,
        cardY,
        cardW,
        cardH,
        startX,
        startY,
        endX: targetCx,
        endY: targetCy,
        ringX: targetRect.left - stageRect.left - 4,
        ringY: targetRect.top - stageRect.top - 4,
        ringW: targetRect.width + 8,
        ringH: targetRect.height + 8,
        ringRadius: clamp(
          Math.min(targetRect.width, targetRect.height) * 0.22,
          10,
          24,
        ),
      }

      setLayout((previous) => {
        if (!previous) return next
        const keys = Object.keys(next) as (keyof TourLayout)[]
        const same = keys.every((key) => {
          const a = previous[key]
          const b = next[key]
          if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < 0.6
          return a === b
        })
        return same ? previous : next
      })
    }

    frame = window.requestAnimationFrame(measure)
    return () => window.cancelAnimationFrame(frame)
  }, [step.id, step.target, stageRef, phoneRef])

  // 连接线弯度不进 layout 比较，按当前 layout 直接算。
  const bend = layout
    ? Math.max(42, Math.abs(layout.endX - layout.startX) * 0.46)
    : 0
  const path = layout
    ? layout.side === 'right'
      ? `M ${layout.startX} ${layout.startY} C ${layout.startX + bend} ${layout.startY}, ${layout.endX - bend} ${layout.endY}, ${layout.endX} ${layout.endY}`
      : `M ${layout.startX} ${layout.startY} C ${layout.startX - bend} ${layout.startY}, ${layout.endX + bend} ${layout.endY}, ${layout.endX} ${layout.endY}`
    : ''

  const total = steps.length

  return (
    <div className={cn('po-tour', layout && 'is-ready')}>
      <svg aria-hidden="true" className="po-tour-link">
        {layout && (
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

      {layout && (
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
          {step.actionLabel && (
            <span
              className="po-tour-action"
              aria-hidden="true"
              style={{
                left: layout.ringX + layout.ringW / 2,
                top: layout.ringY - 8,
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
          <p className="po-tour-body">{step.body}</p>

          {nudge && (
            <p className="po-tour-nudge" key={nudge.nonce} role="status">
              {nudge.text}
            </p>
          )}

          <footer className="po-tour-foot">
            <span className="po-tour-hint">
              <span className="po-tour-tap" aria-hidden="true">
                <MousePointerClick size={13} strokeWidth={1.9} />
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
          </footer>

          <div className="po-tour-actions">
            <button className="po-tour-skip" onClick={onSkip} type="button">
              跳过引导
            </button>
          </div>

          <p className="po-sr-only" role="status" aria-live="polite">
            第 {stepIndex + 1} 步，共 {total} 步：{step.title}
          </p>
        </div>
      </aside>
    </div>
  )
}
