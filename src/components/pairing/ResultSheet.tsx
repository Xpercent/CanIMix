import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import {
  Check,
  ListFilter,
  Share2,
  ShieldCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { haptic } from './haptics'
import { useScrollMask } from './use-scroll-mask'
import type { PairingItem } from './pairing-data'
import {
  evaluatePairing,
  type PairingReport,
  type RiskLevel,
} from './pairing-engine'
import { FindingCard } from './result/finding-card'
import { SafeFold } from './result/safe-fold'
import { SectionLabel } from './result/shared'
import { SpacingPlanCard } from './result/spacing-plan-card'
import { VerdictCard } from './result/verdict-card'

interface ResultSheetProps {
  items: PairingItem[]
  onClose: () => void
}

const RISK_ORDER: Record<RiskLevel, number> = {
  danger: 4,
  caution: 3,
  spacing: 2,
  synergy: 1,
  safe: 0,
}

function buildShareText(report: PairingReport, items: PairingItem[]): string {
  const lines = [
    '【一起吃安全吗？· 同服检测】',
    `结论：${report.verdictTitle}`,
    `物品：${items.map((item) => item.name).join(' + ')}`,
    report.summary,
  ]
  for (const finding of report.conflicts.slice(0, 4)) {
    lines.push(`· ${finding.title}：${finding.action}`)
  }
  lines.push('仅供参考，不替代执业医师或药师的个体化诊断。')
  return lines.join('\n')
}

export function ResultSheet({ items, onClose }: ResultSheetProps) {
  const sheetRef = useRef<HTMLElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const closeTimer = useRef<number | null>(null)
  const copiedTimer = useRef<number | null>(null)
  const dragStart = useRef<{ y: number; time: number; pointerId: number } | null>(null)
  const closingRef = useRef(false)
  const returnFocusRef = useRef<HTMLElement | null>(null)

  const [closing, setClosing] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [dragY, setDragY] = useState(0)
  const [filterPick, setFilterPick] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // 物品被移出后筛选自动失效，渲染时直接忽略过期的选中项。
  const filterId =
    filterPick && items.some((item) => item.id === filterPick) ? filterPick : null

  useScrollMask(
    scrollRef,
    `${items.map((item) => item.id).join('|')}:${filterId ?? 'all'}`,
  )

  const report = useMemo(() => evaluatePairing(items), [items])
  const artById = useMemo(
    () => new Map(items.map((item) => [item.id, item.art] as const)),
    [items],
  )

  const itemRisk = useMemo(() => {
    const risks = new Map<string, RiskLevel>()
    for (const finding of [...report.conflicts, ...report.synergies]) {
      for (const item of finding.items) {
        const previous = risks.get(item.id) ?? 'safe'
        if (RISK_ORDER[finding.risk] > RISK_ORDER[previous]) risks.set(item.id, finding.risk)
      }
    }
    return risks
  }, [report])

  const requestClose = useCallback(() => {
    if (closingRef.current) return
    closingRef.current = true
    setClosing(true)
    haptic('remove')
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current)
    closeTimer.current = window.setTimeout(onClose, 220)
  }, [onClose])

  useEffect(() => {
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    sheetRef.current?.focus({ preventScroll: true })

    const focusableSelector =
      'summary, a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    const getFocusable = () => {
      const root = sheetRef.current
      if (!root) return []
      return [...root.querySelectorAll<HTMLElement>(focusableSelector)].filter(
        (element) => element.offsetParent !== null,
      )
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        requestClose()
        return
      }
      if (event.key !== 'Tab') return

      const focusable = getFocusable()
      if (focusable.length === 0) {
        event.preventDefault()
        sheetRef.current?.focus({ preventScroll: true })
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      if (event.shiftKey && (active === first || active === sheetRef.current)) {
        event.preventDefault()
        last.focus({ preventScroll: true })
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus({ preventScroll: true })
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      if (closeTimer.current !== null) window.clearTimeout(closeTimer.current)
      if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current)
      const returnTarget = returnFocusRef.current?.isConnected
        ? returnFocusRef.current
        : document.querySelector<HTMLElement>('[data-pairing-start]')
      returnTarget?.focus({ preventScroll: true })
    }
  }, [requestClose])

  const handleToggleFilter = useCallback(
    (id: string) => {
      if (items.length < 3) return
      haptic('category')
      setFilterPick((previous) => (previous === id ? null : id))
      if (scrollRef.current) scrollRef.current.scrollTop = 0
    },
    [items.length],
  )

  const handlePointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragStart.current = {
      y: event.clientY,
      time: performance.now(),
      pointerId: event.pointerId,
    }
    setDragging(true)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (!dragStart.current) return
    setDragY(Math.max(0, event.clientY - dragStart.current.y))
  }

  const finishDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const start = dragStart.current
    if (!start) return
    dragStart.current = null
    setDragging(false)
    if (event.currentTarget.hasPointerCapture(start.pointerId)) {
      event.currentTarget.releasePointerCapture(start.pointerId)
    }
    const delta = Math.max(0, event.clientY - start.y)
    const elapsed = Math.max(1, performance.now() - start.time)
    const velocity = delta / elapsed
    const threshold = sheetRef.current ? sheetRef.current.offsetWidth * 0.22 : 80
    if (delta > threshold || (delta > 24 && velocity > 0.55)) {
      // 保留当前拖拽位移，让关闭动画从松手的位置继续下滑，而不是先弹回全开状态。
      requestClose()
    } else {
      setDragY(0)
    }
  }

  const cancelDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const start = dragStart.current
    dragStart.current = null
    setDragging(false)
    setDragY(0)
    if (start && event.currentTarget.hasPointerCapture(start.pointerId)) {
      event.currentTarget.releasePointerCapture(start.pointerId)
    }
  }

  const handleShare = useCallback(async () => {
    const text = buildShareText(report, items)
    const nav = navigator as Navigator & {
      share?: (data: { title?: string; text?: string }) => Promise<void>
    }
    try {
      if (nav.share) {
        await nav.share({ title: '一起吃安全吗？· 同服检测', text })
        return
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        haptic('undo')
        if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current)
        copiedTimer.current = window.setTimeout(() => setCopied(false), 1600)
      }
    } catch {
      // 用户取消分享或浏览器拒绝剪贴板权限，界面保持原状即可。
    }
  }, [items, report])

  const filterName = filterId
    ? items.find((item) => item.id === filterId)?.name ?? filterId
    : ''
  const filterActive = filterId !== null

  const visibleConflicts = report.conflicts.filter(
    (finding) => !filterId || finding.items.some((item) => item.id === filterId),
  )
  const visibleSynergies = report.synergies.filter(
    (finding) => !filterId || finding.items.some((item) => item.id === filterId),
  )
  const visibleSafetyNotes = report.safetyNotes.filter(
    (finding) => !filterId || finding.items.some((item) => item.id === filterId),
  )
  const visibleSafePairs = filterId
    ? report.safePairs.filter((pair) => pair.items.some((item) => item.id === filterId))
    : report.safePairs

  const planVisible =
    report.spacingPlan !== null &&
    (!filterId ||
      report.spacingPlan.steps.some((step) =>
        step.items.some((item) => item.id === filterId),
      ))

  const hasVisibleFindings =
    visibleConflicts.length > 0 ||
    visibleSynergies.length > 0 ||
    visibleSafetyNotes.length > 0 ||
    planVisible
  const hasVisibleResult = hasVisibleFindings || visibleSafePairs.length > 0
  const filterOnlySafe =
    filterActive && !hasVisibleFindings && visibleSafePairs.length > 0

  const mainFindings = [...visibleConflicts, ...visibleSynergies]
  const allSafe = report.conflicts.length === 0
  const showSafeFold = allSafe
    ? visibleSafePairs.length > 0
    : visibleSafePairs.length > 0 || visibleSafetyNotes.length > 0

  return (
    <div className={cn('po-sheet-layer', closing && 'is-closing')} role="presentation">
      <button
        type="button"
        aria-label="关闭检测结果"
        className="po-sheet-scrim"
        onClick={requestClose}
      />

      <section
        ref={sheetRef}
        id="pairing-result-sheet"
        aria-labelledby="po-result-title"
        aria-modal="true"
        className={cn('po-sheet', dragging && 'is-dragging', closing && 'is-closing')}
        role="dialog"
        style={dragY > 0 ? { translate: `0 ${dragY}px` } : undefined}
        tabIndex={-1}
      >
        <header
          className="po-sheet-head"
          onPointerCancel={cancelDrag}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishDrag}
        >
          <div className="po-sheet-grab" aria-hidden="true">
            <span className="po-sheet-grabber" />
          </div>
          <div className="po-sheet-headrow">
            <div className="po-sheet-heading">
              <span className="po-sheet-eyebrow">SAFETY CHECK · REPORT</span>
              <h2 className="po-sheet-title" id="po-result-title">
                冲突检测结果
              </h2>
            </div>
          </div>
        </header>

        <div className="po-sheet-scroll" ref={scrollRef}>
          <div className="po-result-content">
            <VerdictCard
              filterId={filterId}
              filterName={filterName}
              itemRisk={itemRisk}
              items={items}
              onToggleFilter={handleToggleFilter}
              report={report}
            />

            {filterActive && (
              <div className="po-filter-banner" role="status" aria-live="polite">
                <span className="po-filter-text">
                  <ListFilter size={13} strokeWidth={1.9} aria-hidden="true" />
                  仅显示与「{filterName}」相关的结果
                </span>
                <button
                  type="button"
                  className="po-filter-clear"
                  onClick={() => setFilterPick(null)}
                >
                  显示全部
                </button>
              </div>
            )}

            {!hasVisibleResult && filterActive && (
              <div className="po-filter-empty po-tone-safe" role="status">
                <ShieldCheck size={22} strokeWidth={1.7} aria-hidden="true" />
                <p>「{filterName}」暂未关联到冲突结果</p>
                <button type="button" onClick={() => setFilterPick(null)}>
                  查看全部结果
                </button>
              </div>
            )}

            {filterOnlySafe && !allSafe && (
              <div className="po-filter-confirm po-tone-safe" role="status">
                <ShieldCheck size={24} strokeWidth={1.7} aria-hidden="true" />
                <h3>「{filterName}」未发现已知冲突</h3>
                <p>
                  与其余已选物品的 {visibleSafePairs.length} 组两两搭配均未命中现有冲突规则，可按说明书使用。
                </p>
                <button type="button" onClick={() => setFilterPick(null)}>
                  查看全部结果
                </button>
              </div>
            )}

            {allSafe ? (
              <>
                {(visibleSafetyNotes.length > 0 || visibleSynergies.length > 0) && (
                  <section className="po-result-section">
                    <SectionLabel
                      count={visibleSafetyNotes.length + visibleSynergies.length}
                      label="安心提示与推荐搭配"
                    />
                    <div className="po-card-flow">
                      {visibleSafetyNotes.map((finding) => (
                        <FindingCard
                          artById={artById}
                          finding={finding}
                          key={finding.key}
                        />
                      ))}
                      {visibleSynergies.map((finding) => (
                        <FindingCard
                          artById={artById}
                          finding={finding}
                          key={finding.key}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {showSafeFold && (
                  <SafeFold
                    artById={artById}
                    defaultOpen={filterActive}
                    key={`safe-${filterId ?? 'all'}`}
                    label={`查看已排查的 ${visibleSafePairs.length} 组搭配`}
                    notes={[]}
                    pairs={visibleSafePairs}
                  />
                )}
              </>
            ) : (
              <>
                {mainFindings.length > 0 && (
                  <section className="po-result-section">
                    <SectionLabel count={mainFindings.length} label="冲突与行动建议" />
                    <div className="po-card-flow">
                      {mainFindings.map((finding) => (
                        <FindingCard
                          artById={artById}
                          finding={finding}
                          key={finding.key}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {planVisible && report.spacingPlan && (
                  <SpacingPlanCard
                    artById={artById}
                    plan={report.spacingPlan}
                  />
                )}

                {showSafeFold && (
                  <SafeFold
                    artById={artById}
                    defaultOpen={filterActive}
                    key={`safe-${filterId ?? 'all'}`}
                    label={
                      visibleSafePairs.length > 0
                        ? `已排查且暂未发现冲突的搭配（${visibleSafePairs.length}）`
                        : `安心提示（${visibleSafetyNotes.length}）`
                    }
                    notes={visibleSafetyNotes}
                    pairs={visibleSafePairs}
                  />
                )}
              </>
            )}

            <p className="po-disclaimer">
              检测结果基于常见药理与饮食相互作用规律，仅供用药参考，不替代执业医师或药师的个体化诊断。孕产妇、儿童及慢病患者请遵医嘱。
            </p>
          </div>
        </div>

        <footer className="po-sheet-footer">
          <button
            type="button"
            aria-label="分享检测结果"
            className={cn('po-sheet-share', copied && 'is-copied')}
            onClick={handleShare}
          >
            {copied ? (
              <Check size={16} strokeWidth={2.2} aria-hidden="true" />
            ) : (
              <Share2 size={16} strokeWidth={1.9} aria-hidden="true" />
            )}
            <span>{copied ? '已复制' : '分享'}</span>
          </button>
          <button
            type="button"
            className="po-sheet-primary"
            onClick={requestClose}
          >
            知道了
          </button>
        </footer>
      </section>
    </div>
  )
}