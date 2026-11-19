import { Fragment } from 'react'
import { ChevronDown, FlaskConical } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Finding, ReportItem } from '../pairing-engine'
import { findingBadgeLabel, findingKicker } from './labels'
import { SeverityGlyph } from './shared'

interface FindingCardProps {
  finding: Finding
  artById: Map<string, string>
}

export function FindingCard({ finding, artById }: FindingCardProps) {
  const showRelationBoard = Boolean(finding.focusId) && finding.items.length > 2
  const focus = showRelationBoard
    ? finding.items.find((item) => item.id === finding.focusId)
    : undefined
  const targets =
    showRelationBoard && focus
      ? finding.items.filter((item) => item.id !== focus.id)
      : []

  const compoundNotes = new Map<string, { name: string; ingredients: string[] }>()
  for (const entry of finding.triggeredIngredients) {
    const note = compoundNotes.get(entry.itemId) ?? {
      name: entry.itemName,
      ingredients: [],
    }
    if (!note.ingredients.includes(entry.ingredient)) note.ingredients.push(entry.ingredient)
    compoundNotes.set(entry.itemId, note)
  }

  const allDrug = finding.items.every((item) => item.isDrug)
  const detailsLabel =
    finding.severity === 'safe_note'
      ? '安心依据'
      : finding.severity === 'synergy'
        ? '搭配原理'
        : '药理机制与注意症状'

  return (
    <article className={cn('po-finding', `po-tone-${finding.risk}`)}>
      <header className="po-finding-head">
        <span className="po-finding-sev" aria-hidden="true">
          <SeverityGlyph severity={finding.severity} />
        </span>
        <div className="po-finding-heading">
          <span className="po-finding-kicker">{findingKicker(finding)}</span>
          <h4 className="po-finding-title">{finding.title}</h4>
        </div>
        <span className="po-risk-tag">{findingBadgeLabel(finding)}</span>
      </header>

      <div className="po-involved">
        <div className="po-involved-label">
          <span>{allDrug ? '涉及药品' : '涉及物品'}</span>
          <span className="po-involved-count">{finding.items.length} 项</span>
        </div>

        {showRelationBoard && focus ? (
          <div className="po-relboard">
            <div className="po-rel-main">
              <span className="po-rel-role">{focus.isDrug ? '主要药品' : '主要物品'}</span>
              <span className="po-rel-main-card">
                <span className="po-rel-main-art">
                  {artById.get(focus.id) ? (
                    <img alt="" decoding="async" draggable={false} src={artById.get(focus.id)} />
                  ) : null}
                </span>
                <span className="po-rel-main-copy">
                  <span className="po-rel-main-name">{focus.name}</span>
                  <span className="po-rel-main-sub">与下方 {targets.length} 项相关</span>
                </span>
              </span>
            </div>

            <div className="po-relflow" aria-hidden="true">
              <span className="po-relflow-pill">{relationBridgeLabel(finding)}</span>
            </div>

            <div className="po-rel-targets-wrap">
              <span className="po-rel-role">相关 · {targets.length} 项</span>
              <div className="po-rel-targets">
                {targets.map((item) => (
                  <span className="po-rel-target" key={item.id} title={item.name}>
                    <span className="po-rel-target-art">
                      {artById.get(item.id) ? (
                        <img
                          alt=""
                          decoding="async"
                          draggable={false}
                          src={artById.get(item.id)}
                        />
                      ) : null}
                    </span>
                    <span className="po-rel-target-name">{item.name}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className={cn('po-peer-row', `is-${Math.min(finding.items.length, 5)}`)}>
            {finding.items.map((item, index) => (
              <Fragment key={item.id}>
                {index > 0 && finding.items.length <= 3 && (
                  <span className="po-peer-link" aria-hidden="true">
                    <SeverityGlyph severity={finding.severity} size={13} />
                  </span>
                )}
                <PeerNode art={artById.get(item.id)} item={item} />
              </Fragment>
            ))}
          </div>
        )}

        {compoundNotes.size > 0 && (
          <div className="po-compound-notes" role="note" aria-label="复方成分提示">
            {[...compoundNotes.values()].map((note) => (
              <p className="po-compound-row" key={note.name}>
                <FlaskConical size={13} strokeWidth={1.8} aria-hidden="true" />
                <span className="po-compound-item">{note.name}</span>
                <span className="po-compound-verb">含</span>
                {note.ingredients.map((ingredient) => (
                  <span className="po-compound-pill" key={ingredient}>
                    {ingredient}
                  </span>
                ))}
              </p>
            ))}
          </div>
        )}
      </div>

      <div className="po-action-box">
        <span className="po-action-label">行动建议</span>
        <p>{finding.action}</p>
      </div>

      <details className="po-finding-details">
        <summary>
          <span>{detailsLabel}</span>
          <span className="po-details-chevron" aria-hidden="true">
            <ChevronDown size={13} strokeWidth={2.1} />
          </span>
        </summary>
        <div className="po-detail-body">
          <p>
            <strong>药理机制</strong>
            {finding.mechanism}
          </p>
          {finding.symptoms && (
            <p>
              <strong>注意症状</strong>
              {finding.symptoms}
            </p>
          )}
        </div>
      </details>
    </article>
  )
}

function PeerNode({ item, art }: { item: ReportItem; art?: string }) {
  return (
    <span className="po-peer-node">
      <span className="po-peer-art">
        {art ? <img alt="" decoding="async" draggable={false} src={art} /> : null}
      </span>
      <span className="po-peer-name" title={item.name}>
        {item.name}
      </span>
    </span>
  )
}

function relationBridgeLabel(finding: Finding): string {
  if (finding.severity === 'spacing') return '需错开'
  if (finding.severity === 'danger') return '组合风险'
  if (finding.severity === 'caution') return '谨慎同用'
  if (finding.severity === 'synergy') return '协同搭配'
  return '安心说明'
}