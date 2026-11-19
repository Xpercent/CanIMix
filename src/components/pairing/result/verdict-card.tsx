import { Check, Clock3, ShieldAlert, ShieldCheck, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PairingItem } from '../pairing-data'
import type { PairingReport, RiskLevel } from '../pairing-engine'
import { CASE_RISK_LABELS } from './labels'

interface VerdictCardProps {
  report: PairingReport
  items: PairingItem[]
  itemRisk: Map<string, RiskLevel>
  filterId: string | null
  filterName: string
  onToggleFilter: (id: string) => void
}

export function VerdictCard({
  report,
  items,
  itemRisk,
  filterId,
  filterName,
  onToggleFilter,
}: VerdictCardProps) {
  const VerdictIcon =
    report.verdict === 'danger'
      ? ShieldAlert
      : report.verdict === 'caution'
        ? TriangleAlert
        : report.verdict === 'spacing'
          ? Clock3
          : ShieldCheck
  const canFilter = items.length >= 3
  const filterActive = filterId !== null

  return (
    <header className={cn('po-verdict', `po-tone-${report.verdict}`)}>
      <div className="po-verdict-top">
        <span className="po-verdict-icon">
          <VerdictIcon size={22} strokeWidth={1.8} aria-hidden="true" />
        </span>
        <div className="po-verdict-heading">
          <span className="po-kicker">综合结论</span>
          <h3 className="po-verdict-title">{report.verdictTitle}</h3>
        </div>
        <span className="po-verdict-count">已测 {items.length} 项</span>
      </div>
      <p className="po-verdict-summary">{report.summary}</p>

      <div className="po-case-block">
        <div className="po-case-head">
          <span className="po-case-head-label">本次检测</span>
          <span className="po-case-head-meta">
            {filterActive
              ? `已筛选 · ${filterName}`
              : canFilter
                ? '轻点卡片筛选'
                : `${items.length} 项`}
          </span>
        </div>

        <div
          className={cn('po-case-strip', `is-${Math.min(items.length, 5)}`)}
          role="group"
          aria-label="本次检测物品"
        >
          {items.map((item) => {
            const risk = itemRisk.get(item.id) ?? 'safe'
            const riskLabel = CASE_RISK_LABELS[risk]
            const active = filterId === item.id
            return (
              <div
                className={cn(
                  'po-case-chip',
                  `po-risk-${risk}`,
                  active && 'is-active',
                  filterId && !active && 'is-muted',
                  !canFilter && 'is-static',
                )}
                key={item.id}
              >
                <button
                  type="button"
                  aria-disabled={!canFilter}
                  aria-label={`${item.name}，${riskLabel}${
                    canFilter ? '，轻点筛选相关结果' : ''
                  }`}
                  aria-pressed={canFilter ? active : undefined}
                  className="po-case-hit"
                  onClick={() => onToggleFilter(item.id)}
                  title={canFilter ? '轻点筛选相关结果' : item.name}
                >
                  <span className="po-case-art">
                    <img alt="" decoding="async" draggable={false} src={item.art} />
                    {active && (
                      <span className="po-case-active-mark" aria-hidden="true">
                        <Check size={9} strokeWidth={2.6} />
                      </span>
                    )}
                  </span>
                  <span className="po-case-copy">
                    <span className="po-case-name">{item.shortName}</span>
                    <span className="po-case-status">
                      <span className="po-case-status-dot" aria-hidden="true" />
                      {riskLabel}
                    </span>
                  </span>
                </button>
              </div>
            )
          })}
        </div>

        {filterActive ? (
          <p className="po-case-hint is-active" aria-live="polite">
            已筛选「{filterName}」· 再次轻点该卡片即可取消
          </p>
        ) : (
          canFilter && <p className="po-case-hint">轻点卡片，可只看与它相关的结果</p>
        )}
      </div>
    </header>
  )
}