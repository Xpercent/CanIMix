import type { Finding, RiskLevel } from '../pairing-engine'

export const RISK_LABELS: Record<Finding['severity'], string> = {
  danger: '不建议同用',
  caution: '需谨慎',
  spacing: '需间隔',
  safe_note: '安心提示',
  synergy: '推荐搭配',
}

export const CASE_RISK_LABELS: Record<RiskLevel, string> = {
  danger: '危险',
  caution: '谨慎',
  spacing: '间隔',
  synergy: '协同',
  safe: '无冲突',
}

const SEVERITY_KICKERS: Record<Finding['severity'], string> = {
  danger: '配伍冲突',
  caution: '谨慎联用',
  spacing: '错峰服用',
  safe_note: '安全澄清',
  synergy: '推荐搭配',
}

export function findingBadgeLabel(finding: Finding): string {
  return finding.severity === 'spacing'
    ? `间隔 ≥${finding.spacingHours ?? 0} 小时`
    : RISK_LABELS[finding.severity]
}

export function findingKicker(finding: Finding): string {
  return SEVERITY_KICKERS[finding.severity]
}