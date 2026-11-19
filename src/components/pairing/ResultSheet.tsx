import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import {
  Check,
  ChevronDown,
  Clock3,
  ScanLine,
  Share2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  X,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { haptic } from './haptics'
import { prefersReducedMotion } from './motion'
import type { PairingItem } from './pairing-data'
import {
  ENGINE_RULE_COUNT,
  evaluatePairing,
  type Finding,
  type PairingReport,
  type ReportItem,
  type RiskLevel,
  type SafePair,
  type SpacingPlan,
} from './pairing-engine'

interface ResultSheetProps {
  items: PairingItem[]
  onClose: () => void
  onRemove: (id: string) => void
}

const RISK_ORDER: Record<RiskLevel, number> = {
  danger: 4,
  caution: 3,
  spacing: 2,
  synergy: 1,
  safe: 0,
}

const CASE_RISK_LABELS: Record<RiskLevel, string> = {
  danger: '危险',
  caution: '谨慎',
  spacing: '间隔',
  synergy: '协同',
  safe: '',
}

const RISK_LABELS: Record<Finding['severity'], string> = {
  danger: '不建议同用',
  caution: '需谨慎',
  spacing: '需间隔',
  safe_note: '安心澄清',
  synergy: '推荐搭配',
}

function buildShareText(report: PairingReport, items: PairingItem[]): string {
  const lines = [
    '【能一起用吗？· 配伍检测】',
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

export function ResultSheet({ items, onClose, onRemove }: ResultSheetProps) {
  const sheetRef = useRef<HTMLElement>(null)
  const closeTimer = useRef<number | null>(null)
  const copiedTimer = useRef<number | null>(null)
  const dragStart = useRef<{ y: number; time: number; pointerId: number } | null>(null)
  const closingRef = useRef(false)
  const returnFocusRef = useRef<HTMLElement | null>(null)

  const [phase, setPhase] = useState<'scanning' | 'result'>('scanning')
  const [closing, setClosing] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [dragY, setDragY] = useState(0)
  const [filterId, setFilterId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

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
    const delay = prefersReducedMotion() ? 0 : 300
    const timer = window.setTimeout(() => {
      setPhase('result')
      haptic('ready')
    }, delay)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    sheetRef.current?.focus()

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
        sheetRef.current?.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      if (event.shiftKey && (active === first || active === sheetRef.current)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
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
      returnTarget?.focus()
    }
  }, [requestClose])

  useEffect(() => {
    if (filterId && !items.some((item) => item.id === filterId)) setFilterId(null)
  }, [filterId, items])

  useEffect(() => {
    if (items.length < 2) requestClose()
  }, [items.length, requestClose])

  const handleToggleFilter = useCallback(
    (id: string) => {
      if (items.length < 3) return
      haptic('category')
      setFilterId((previous) => (previous === id ? null : id))
    },
    [items.length],
  )

  const handleRemove = useCallback(
    (id: string) => {
      if (items.length <= 2) return
      onRemove(id)
    },
    [items.length, onRemove],
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
      setDragY(0)
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
        await nav.share({ title: '能一起用吗？· 配伍检测', text })
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
        aria-busy={phase === 'scanning'}
        aria-labelledby="po-result-title"
        aria-modal="true"
        className={cn(
          'po-sheet',
          dragging && 'is-dragging',
          closing && 'is-closing',
          phase === 'scanning' && 'is-scanning',
        )}
        role="dialog"
        style={dragY > 0 ? { transform: `translateY(${dragY}px)` } : undefined}
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
              <span className="po-sheet-eyebrow">PAIRING BENCH · RESULT</span>
              <h2 className="po-sheet-title" id="po-result-title">
                配伍检测结果
              </h2>
            </div>
            <span className="po-sheet-live">
              <span className="po-sheet-live-dot" aria-hidden="true" />
              本地计算
            </span>
            <button
              type="button"
              aria-label="关闭检测结果"
              className="po-sheet-close"
              onClick={requestClose}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <X size={16} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className={cn('po-sheet-scroll', phase === 'scanning' && 'is-scanning')}>
          {phase === 'scanning' ? (
            <ScanState items={items} />
          ) : (
            <div className="po-result-content">
              <VerdictCard
                filterId={filterId}
                itemRisk={itemRisk}
                items={items}
                onRemove={handleRemove}
                onToggleFilter={handleToggleFilter}
                report={report}
              />

              {filterActive && (
                <div className="po-filter-banner">
                  <span className="po-filter-text">
                    <Sparkles size={12} strokeWidth={1.8} aria-hidden="true" />
                    仅显示与「{filterName}」有关的结果
                  </span>
                  <button
                    type="button"
                    className="po-filter-clear"
                    onClick={() => setFilterId(null)}
                  >
                    清除
                  </button>
                </div>
              )}

              {!hasVisibleResult && filterActive && (
                <div className="po-filter-empty po-tone-safe">
                  <ShieldCheck size={20} strokeWidth={1.7} aria-hidden="true" />
                  <p>「{filterName}」暂未关联到冲突卡片</p>
                  <button type="button" onClick={() => setFilterId(null)}>
                    查看全部结果
                  </button>
                </div>
              )}

              {filterOnlySafe && !allSafe && (
                <div className="po-filter-confirm po-tone-safe">
                  <ShieldCheck size={22} strokeWidth={1.7} aria-hidden="true" />
                  <h3>「{filterName}」暂未发现已知冲突</h3>
                  <p>
                    与其它已选物品的 {visibleSafePairs.length} 组两两组合均未命中现有配伍规则，可按说明书使用。
                  </p>
                  <button type="button" onClick={() => setFilterId(null)}>
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
                      label={`查看已排查的 ${visibleSafePairs.length} 组组合`}
                      notes={[]}
                      pairs={visibleSafePairs}
                    />
                  )}
                </>
              ) : (
                <>
                  {mainFindings.length > 0 && (
                    <section className="po-result-section">
                      <SectionLabel count={mainFindings.length} label="核心冲突与建议" />
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
                          ? `已排查且暂未发现冲突的组合 (${visibleSafePairs.length})`
                          : `安心澄清 (${visibleSafetyNotes.length})`
                      }
                      notes={visibleSafetyNotes}
                      pairs={visibleSafePairs}
                    />
                  )}
                </>
              )}

              <p className="po-disclaimer">
                检测结果基于常见药理及饮食配伍规律，仅供参考，不替代执业医师或药师的个体化诊断。孕产妇、儿童及慢病患者请遵医嘱。
              </p>
            </div>
          )}
        </div>

        {phase === 'result' && (
          <footer className="po-sheet-footer">
            <button
              type="button"
              aria-label="分享检测结果"
              className={cn('po-sheet-share', copied && 'is-copied')}
              onClick={handleShare}
            >
              {copied ? (
                <Check size={14} strokeWidth={2.2} aria-hidden="true" />
              ) : (
                <Share2 size={14} strokeWidth={1.9} aria-hidden="true" />
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
        )}
      </section>
    </div>
  )
}

function ScanState({ items }: { items: PairingItem[] }) {
  return (
    <div className="po-sheet-scan">
      <div className="po-scan-orb" aria-hidden="true">
        <span className="po-scan-ring po-scan-ring-outer" />
        <span className="po-scan-ring po-scan-ring-inner" />
        <span className="po-scan-sweep" />
        <span className="po-scan-core">
          <ScanLine size={20} strokeWidth={1.7} />
        </span>
        {items.slice(0, 5).map((item, index) => (
          <span
            className="po-scan-item"
            key={item.id}
            style={
              {
                '--angle': `${(index / Math.max(1, items.length)) * 360}deg`,
              } as CSSProperties
            }
          >
            <img alt="" decoding="async" draggable={false} src={item.art} />
          </span>
        ))}
      </div>
      <p className="po-scan-title">正在检测配伍</p>
      <p className="po-scan-sub">本地比对 {ENGINE_RULE_COUNT} 条药理规则</p>
      <div className="po-scan-track">
        <span />
      </div>
    </div>
  )
}

function VerdictCard({
  report,
  items,
  itemRisk,
  filterId,
  onToggleFilter,
  onRemove,
}: {
  report: PairingReport
  items: PairingItem[]
  itemRisk: Map<string, RiskLevel>
  filterId: string | null
  onToggleFilter: (id: string) => void
  onRemove: (id: string) => void
}) {
  const VerdictIcon =
    report.verdict === 'danger'
      ? ShieldAlert
      : report.verdict === 'caution'
        ? TriangleAlert
        : report.verdict === 'spacing'
          ? Clock3
          : ShieldCheck

  return (
    <header className={cn('po-verdict', `po-tone-${report.verdict}`)}>
      <div className="po-verdict-top">
        <span className="po-verdict-icon">
          <VerdictIcon size={20} strokeWidth={1.8} aria-hidden="true" />
        </span>
        <div className="po-verdict-heading">
          <span className="po-kicker">综合结论</span>
          <h3 className="po-verdict-title">{report.verdictTitle}</h3>
        </div>
        <span className="po-verdict-count">已测 {items.length} 项</span>
      </div>
      <p className="po-verdict-summary">{report.summary}</p>

      <div className="po-case-strip" role="group" aria-label="本次检测物品">
        {items.map((item) => {
          const risk = itemRisk.get(item.id) ?? 'safe'
          const riskLabel = CASE_RISK_LABELS[risk]
          const active = filterId === item.id
          const canFilter = items.length >= 3
          return (
            <div
              className={cn(
                'po-case-chip',
                `po-risk-${risk}`,
                active && 'is-active',
                filterId && !active && 'is-muted',
              )}
              key={item.id}
            >
              <button
                type="button"
                aria-disabled={!canFilter}
                aria-label={`${item.name}${riskLabel ? `，${riskLabel}` : ''}${canFilter ? '，轻点筛选相关结果' : ''}`}
                aria-pressed={canFilter ? active : undefined}
                className="po-case-hit"
                onClick={() => onToggleFilter(item.id)}
                title={canFilter ? '轻点筛选相关结果' : item.name}
              >
                <span className="po-case-art">
                  <img alt="" decoding="async" draggable={false} src={item.art} />
                </span>
                <span className="po-case-name">{item.shortName}</span>
                {riskLabel && (
                  <span className="po-case-risk" aria-hidden="true">
                    {riskLabel}
                  </span>
                )}
              </button>
              {items.length > 2 && (
                <button
                  type="button"
                  aria-label={`从托盘中移出 ${item.name}`}
                  className="po-case-remove"
                  onClick={(event) => {
                    event.stopPropagation()
                    onRemove(item.id)
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                >
                  <X size={9} strokeWidth={2.4} aria-hidden="true" />
                </button>
              )}
            </div>
          )
        })}
      </div>
      {items.length >= 3 && (
        <p className="po-case-hint">轻点物品可筛选与它有关的结果</p>
      )}
    </header>
  )
}

function SectionLabel({ label, count }: { label: string; count: number }) {
  return (
    <div className="po-section-label">
      <span>{label}</span>
      <span className="po-section-count">{count}</span>
    </div>
  )
}

function FindingCard({
  finding,
  artById,
}: {
  finding: Finding
  artById: Map<string, string>
}) {
  const LinkIcon =
    finding.severity === 'danger'
      ? Zap
      : finding.severity === 'caution'
        ? TriangleAlert
        : finding.severity === 'spacing'
          ? Clock3
          : finding.severity === 'synergy'
            ? Sparkles
            : ShieldCheck
  const riskLabel =
    finding.severity === 'spacing'
      ? `间隔 ≥${finding.spacingHours ?? 0} 小时`
      : RISK_LABELS[finding.severity]

  const badgesByItem = new Map<string, string[]>()
  for (const entry of finding.triggeredIngredients) {
    const list = badgesByItem.get(entry.itemId) ?? []
    list.push(entry.ingredient)
    badgesByItem.set(entry.itemId, list)
  }

  return (
    <article className={cn('po-finding', `po-tone-${finding.risk}`)}>
      <div className="po-finding-top">
        <div className="po-pair-row">
          {finding.items.map((item, index) => (
            <Fragment key={item.id}>
              {index > 0 && (
                <span className="po-pair-link" aria-hidden="true">
                  <LinkIcon size={11} strokeWidth={2} />
                </span>
              )}
              <ItemNode
                art={artById.get(item.id)}
                badges={badgesByItem.get(item.id) ?? []}
                item={item}
              />
            </Fragment>
          ))}
        </div>
        <span className="po-risk-tag">{riskLabel}</span>
      </div>

      <h4 className="po-finding-title">{finding.title}</h4>

      <div className="po-action-box">
        <span className="po-action-label">行动建议</span>
        <p>{finding.action}</p>
      </div>

      <details className="po-finding-details">
        <summary>
          <span>
            {finding.severity === 'safe_note'
              ? '查看安心依据'
              : finding.severity === 'synergy'
                ? '查看搭配原理'
                : '查看药理机制与注意症状'}
          </span>
          <ChevronDown size={12} strokeWidth={2} aria-hidden="true" />
        </summary>
        <div className="po-detail-body">
          <p>
            <strong>药理机制：</strong>
            {finding.mechanism}
          </p>
          {finding.symptoms && (
            <p>
              <strong>注意症状：</strong>
              {finding.symptoms}
            </p>
          )}
        </div>
      </details>
    </article>
  )
}

function ItemNode({
  item,
  badges,
  art,
}: {
  item: ReportItem
  badges: string[]
  art?: string
}) {
  return (
    <span className="po-pair-node">
      <span className="po-pair-icon">
        {art ? <img alt="" decoding="async" draggable={false} src={art} /> : null}
      </span>
      <span className="po-pair-name">{item.name}</span>
      {badges.length > 0 && (
        <span className="po-badge-row">
          {badges.map((ingredient) => (
            <span className="po-ingredient-badge" key={ingredient}>
              含 {ingredient}
            </span>
          ))}
        </span>
      )}
    </span>
  )
}

function SpacingPlanCard({
  plan,
  artById,
}: {
  plan: SpacingPlan
  artById: Map<string, string>
}) {
  return (
    <section className="po-plan po-tone-spacing">
      <div className="po-plan-head">
        <div className="po-plan-heading">
          <span className="po-plan-icon">
            <Clock3 size={16} strokeWidth={1.8} aria-hidden="true" />
          </span>
          <div>
            <span className="po-kicker">SMART SCHEDULE</span>
            <h3 className="po-plan-title">智能错峰建议</h3>
          </div>
        </div>
        <span className="po-plan-total">间隔 ≥{plan.totalHours} 小时</span>
      </div>

      <ol className="po-plan-steps">
        {plan.steps.map((step, index) => (
          <li className={cn('po-plan-step', `is-${step.kind}`)} key={step.id}>
            <span className="po-plan-index">{String(index + 1).padStart(2, '0')}</span>
            <div className="po-plan-body">
              <div className="po-plan-step-head">
                <span>{step.label}</span>
              </div>
              <p className="po-plan-detail">{step.detail}</p>
              <div className="po-plan-items">
                {step.items.map((item) => (
                  <span className="po-plan-item" key={item.id}>
                    {artById.get(item.id) ? (
                      <img alt="" decoding="async" draggable={false} src={artById.get(item.id)} />
                    ) : null}
                    <span>{item.name}</span>
                  </span>
                ))}
              </div>
            </div>
          </li>
        ))}
      </ol>

      <p className="po-plan-note">
        以药品说明书为准；缓释、肠溶或特殊剂型请先咨询药师。
      </p>
    </section>
  )
}

function SafeFold({
  label,
  pairs,
  notes,
  artById,
  defaultOpen = false,
}: {
  label: string
  pairs: SafePair[]
  notes: Finding[]
  artById: Map<string, string>
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <details
      className="po-safe-fold"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        <span>{label}</span>
        <ChevronDown size={13} strokeWidth={2} aria-hidden="true" />
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
        <span className="po-safe-x" aria-hidden="true">
          ×
        </span>
        <span className="po-safe-mini">
          {artById.get(b.id) ? (
            <img alt="" decoding="async" draggable={false} src={artById.get(b.id)} />
          ) : null}
          <span>{b.name}</span>
        </span>
      </span>
      <span className="po-safe-check">
        <Check size={11} strokeWidth={2.2} aria-hidden="true" />
        暂未发现已知冲突
      </span>
    </div>
  )
}