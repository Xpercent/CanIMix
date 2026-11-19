import itemsFile from '../../data/items.json' with { type: 'json' }
import rulesFile from '../../data/rules.json' with { type: 'json' }

export type RiskLevel = 'danger' | 'caution' | 'spacing' | 'safe' | 'synergy'
export type RuleSeverity = 'danger' | 'caution' | 'spacing' | 'safe_note' | 'synergy'
export type RuleType =
  | 'duplicate_ingredient'
  | 'exact_pair'
  | 'tag_pair'
  | 'tag_stack'
  | 'safe_clarification'
  | 'synergy'

export interface ItemData {
  id: string
  name: string
  icon: string
  is_drug: boolean
  ingredients: string[]
  tags: string[]
}

export interface RuleCondition {
  ingredient?: string
  min_count?: number
  tag?: string
  tags?: string[]
  items?: string[]
  target_is_drug?: boolean
  target_distinct?: boolean
  focus_tag?: string
}

export interface RuleData {
  id: string
  type: RuleType
  severity: RuleSeverity
  priority: number
  override_group?: string
  condition: RuleCondition
  spacing_hours: number | null
  spacing_order_hint?: string
  title: string
  action: string
  mechanism: string
  symptoms?: string
}

export interface ReportItem {
  id: string
  name: string
  icon: string
  isDrug: boolean
}

export interface TriggeredIngredient {
  itemId: string
  itemName: string
  ingredient: string
}

export interface Finding {
  key: string
  ruleId: string
  type: RuleType
  severity: RuleSeverity
  risk: RiskLevel
  priority: number
  overrideGroup?: string
  title: string
  action: string
  mechanism: string
  symptoms?: string
  items: ReportItem[]
  focusId?: string
  triggeredIngredients: TriggeredIngredient[]
  spacingHours: number | null
  spacingOrderHint?: string
}

export interface SafePair {
  key: string
  items: [ReportItem, ReportItem]
}

export interface SpacingStep {
  id: string
  kind: 'priority' | 'spacing' | 'synergy'
  label: string
  detail: string
  items: ReportItem[]
  hours?: number
}

export interface SpacingPlan {
  totalHours: number
  steps: SpacingStep[]
}

export interface PairingReport {
  items: ReportItem[]
  verdict: 'danger' | 'caution' | 'spacing' | 'safe'
  verdictTitle: string
  summary: string
  conflicts: Finding[]
  safetyNotes: Finding[]
  synergies: Finding[]
  safePairs: SafePair[]
  spacingPlan: SpacingPlan | null
  stats: {
    pairs: number
    danger: number
    caution: number
    spacing: number
    safetyNotes: number
    synergies: number
    safePairs: number
  }
}

export interface ValidationResult {
  ok: boolean
  errors: string[]
  warnings: string[]
}

interface RawMatch {
  rule: RuleData
  items: ItemData[]
  focus?: ItemData
  counterparts: ItemData[]
  triggered: TriggeredIngredient[]
  pairKey?: string
  order: number
}

interface FindingDraft {
  key: string
  rule: RuleData
  items: ItemData[]
  focus?: ItemData
  counterparts: ItemData[]
  triggered: TriggeredIngredient[]
}

const itemsDoc = itemsFile as unknown as { items: ItemData[] }
const rulesDoc = rulesFile as unknown as {
  rules: RuleData[]
  ingredient_hints?: Record<string, string[]>
}

export const ENGINE_ITEMS: readonly ItemData[] = itemsDoc.items
export const ENGINE_RULES: readonly RuleData[] = rulesDoc.rules
const INGREDIENT_HINTS = rulesDoc.ingredient_hints ?? {}

const ITEMS_BY_ID = new Map<string, ItemData>(ENGINE_ITEMS.map((item) => [item.id, item]))

const SEVERITY_ORDER: Record<RuleSeverity, number> = {
  danger: 4,
  caution: 3,
  spacing: 2,
  synergy: 1,
  safe_note: 0,
}

const SEVERITY_RISK: Record<RuleSeverity, RiskLevel> = {
  danger: 'danger',
  caution: 'caution',
  spacing: 'spacing',
  safe_note: 'safe',
  synergy: 'synergy',
}

const VERDICT_TITLES: Record<PairingReport['verdict'], string> = {
  danger: '不建议同用',
  caution: '需谨慎联用',
  spacing: '需间隔服用',
  safe: '暂未发现明显冲突',
}

function toReportItem(item: ItemData): ReportItem {
  return { id: item.id, name: item.name, icon: item.icon, isDrug: item.is_drug }
}

function pairKeyOf(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

function allPairs<T>(items: readonly T[]): Array<[T, T]> {
  const pairs: Array<[T, T]> = []
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) pairs.push([items[i], items[j]])
  }
  return pairs
}

function resolveSelected(selected: readonly (ItemData | string)[]): ItemData[] {
  const seen = new Set<string>()
  const resolved: ItemData[] = []
  for (const entry of selected) {
    const item = typeof entry === 'string' ? ITEMS_BY_ID.get(entry) : entry
    if (!item || seen.has(item.id)) continue
    seen.add(item.id)
    resolved.push(item)
  }
  return resolved
}

function sortItems(items: ItemData[], trayIndex: Map<string, number>): ItemData[] {
  return [...items].sort(
    (a, b) => (trayIndex.get(a.id) ?? 0) - (trayIndex.get(b.id) ?? 0),
  )
}

function collectTriggered(
  items: ItemData[],
  rule: RuleData,
  hintTags?: string[],
): TriggeredIngredient[] {
  const hints = new Set<string>()
  if (rule.condition.ingredient) hints.add(rule.condition.ingredient)
  if (hintTags) {
    for (const tag of hintTags) {
      for (const ingredient of INGREDIENT_HINTS[tag] ?? []) hints.add(ingredient)
    }
  } else if (rule.type === 'exact_pair') {
    for (const item of items) {
      for (const tag of item.tags) {
        for (const ingredient of INGREDIENT_HINTS[tag] ?? []) hints.add(ingredient)
      }
    }
  }

  const triggered: TriggeredIngredient[] = []
  const seen = new Set<string>()
  for (const item of items) {
    for (const ingredient of item.ingredients) {
      if (!hints.has(ingredient)) continue
      if (item.name.includes(ingredient)) continue
      const key = `${item.id}|${ingredient}`
      if (seen.has(key)) continue
      seen.add(key)
      triggered.push({ itemId: item.id, itemName: item.name, ingredient })
    }
  }
  return triggered
}

function chooseFocus(
  a: ItemData,
  b: ItemData,
  tags: string[],
  focusTag?: string,
): { focus: ItemData; other: ItemData } {
  if (focusTag) {
    const aFocus = a.tags.includes(focusTag)
    const bFocus = b.tags.includes(focusTag)
    if (aFocus !== bFocus) {
      return bFocus ? { focus: b, other: a } : { focus: a, other: b }
    }
  }
  if (a.is_drug !== b.is_drug) {
    return a.is_drug ? { focus: a, other: b } : { focus: b, other: a }
  }
  const secondTag = tags[1]
  const aSecond = a.tags.includes(secondTag)
  const bSecond = b.tags.includes(secondTag)
  if (bSecond && !aSecond) return { focus: b, other: a }
  if (aSecond && !bSecond) return { focus: a, other: b }
  return { focus: a, other: b }
}

function chooseExactFocus(involved: ItemData[]): ItemData | undefined {
  const drugs = involved.filter((item) => item.is_drug)
  if (drugs.length === 1) return drugs[0]
  if (drugs.length > 1) return involved[0]
  const mineral = involved.find((item) => item.tags.includes('多价金属离子'))
  return mineral ?? involved[0]
}

function dedupeMatches(matches: RawMatch[]): RawMatch[] {
  const pairBest = new Map<string, RawMatch>()
  const rest: RawMatch[] = []
  const stackBest = new Map<string, RawMatch>()

  for (const match of matches) {
    if (match.rule.type !== 'tag_stack') continue
    const key = match.rule.condition.tag ?? match.rule.id
    const previous = stackBest.get(key)
    const currentCount = match.rule.condition.min_count ?? 2
    const previousCount = previous ? (previous.rule.condition.min_count ?? 2) : 0
    if (
      !previous ||
      currentCount > previousCount ||
      (currentCount === previousCount && match.rule.priority > previous.rule.priority)
    ) {
      stackBest.set(key, match)
    }
  }
  const stackKeep = new Set(stackBest.values())

  for (const match of matches) {
    if (!match.pairKey) {
      if (match.rule.type === 'tag_stack' && !stackKeep.has(match)) continue
      rest.push(match)
      continue
    }
    const key = `${match.pairKey}|${match.rule.override_group ?? match.rule.id}`
    const previous = pairBest.get(key)
    if (!previous || match.rule.priority > previous.rule.priority) pairBest.set(key, match)
  }

  const pairMatches = [...pairBest.values()]
  const exactPriority = new Map<string, number>()
  for (const match of pairMatches) {
    if (match.rule.type !== 'exact_pair' || !match.pairKey) continue
    exactPriority.set(
      match.pairKey,
      Math.max(exactPriority.get(match.pairKey) ?? 0, match.rule.priority),
    )
  }

  const filtered = pairMatches.filter((match) => {
    if (match.rule.type === 'exact_pair') return true
    const priority = match.pairKey ? exactPriority.get(match.pairKey) : undefined
    return priority === undefined || match.rule.priority > priority
  })

  return [...rest, ...filtered]
}

export function evaluatePairing(
  selected: readonly (ItemData | string)[],
): PairingReport {
  const items = resolveSelected(selected)
  const trayIndex = new Map(items.map((item, index) => [item.id, index] as const))

  if (items.length < 2) {
    return {
      items: items.map(toReportItem),
      verdict: 'safe',
      verdictTitle: '至少选择 2 项',
      summary: items.length === 0 ? '先装入需要一起使用的物品。' : '再装入 1 项即可开始检测。',
      conflicts: [],
      safetyNotes: [],
      synergies: [],
      safePairs: [],
      spacingPlan: null,
      stats: {
        pairs: 0,
        danger: 0,
        caution: 0,
        spacing: 0,
        safetyNotes: 0,
        synergies: 0,
        safePairs: 0,
      },
    }
  }

  const matches: RawMatch[] = []
  let matchOrder = 0
  const nextOrder = () => {
    matchOrder += 1
    return matchOrder
  }

  for (const rule of ENGINE_RULES) {
    if (rule.type !== 'duplicate_ingredient') continue
    const ingredient = rule.condition.ingredient
    if (!ingredient) continue
    const matched = items.filter((item) => item.ingredients.includes(ingredient))
    if (matched.length < (rule.condition.min_count ?? 2)) continue
    matches.push({
      rule,
      items: matched,
      counterparts: [],
      triggered: collectTriggered(matched, rule),
      order: nextOrder(),
    })
  }

  for (const rule of ENGINE_RULES) {
    if (rule.type !== 'exact_pair') continue
    const ids = rule.condition.items
    if (!ids || ids.length < 2) continue
    if (!ids.every((id) => items.some((item) => item.id === id))) continue
    const involved = ids.map((id) => items.find((item) => item.id === id)!).filter(Boolean)
    if (involved.length !== ids.length) continue
    const focus = chooseExactFocus(involved)
    matches.push({
      rule,
      items: involved,
      focus,
      counterparts: involved.filter((item) => item !== focus),
      triggered: collectTriggered(involved, rule),
      pairKey: involved.length === 2 ? pairKeyOf(involved[0].id, involved[1].id) : undefined,
      order: nextOrder(),
    })
  }

  for (const rule of ENGINE_RULES) {
    if (rule.type !== 'tag_pair') continue
    const condition = rule.condition

    if (condition.tag && condition.target_is_drug) {
      const source = items.find((item) => item.tags.includes(condition.tag!))
      if (!source) continue
      const targets = items.filter((item) => item !== source && item.is_drug)
      if (targets.length === 0) continue
      matches.push({
        rule,
        items: [source, ...targets],
        focus: source,
        counterparts: targets,
        triggered: collectTriggered([source, ...targets], rule, [condition.tag!]),
        order: nextOrder(),
      })
      continue
    }

    const tags = condition.tags
    if (!tags || tags.length !== 2) continue
    const [tagA, tagB] = tags
    for (const [a, b] of allPairs(items)) {
      let target: ItemData | undefined
      let other: ItemData | undefined
      if (a.tags.includes(tagA) && b.tags.includes(tagB)) {
        target = b
        other = a
      } else if (b.tags.includes(tagA) && a.tags.includes(tagB)) {
        target = a
        other = b
      }
      if (!target || !other) continue
      const focus = chooseFocus(target, other, tags, condition.focus_tag)
      matches.push({
        rule,
        items: [focus.focus, focus.other],
        focus: focus.focus,
        counterparts: [focus.other],
        triggered: collectTriggered([focus.focus, focus.other], rule, tags),
        pairKey: pairKeyOf(target.id, other.id),
        order: nextOrder(),
      })
    }
  }

  for (const rule of ENGINE_RULES) {
    if (rule.type !== 'tag_stack') continue
    const tag = rule.condition.tag
    if (!tag) continue
    const matched = items.filter((item) => item.tags.includes(tag))
    if (matched.length < (rule.condition.min_count ?? 2)) continue
    matches.push({
      rule,
      items: matched,
      counterparts: [],
      triggered: collectTriggered(matched, rule, [tag]),
      order: nextOrder(),
    })
  }

  for (const rule of ENGINE_RULES) {
    if (rule.type !== 'safe_clarification') continue
    const tags = rule.condition.tags
    if (!tags || tags.length !== 2) continue
    const [tagA, tagB] = tags
    for (const [a, b] of allPairs(items)) {
      let target: ItemData | undefined
      let other: ItemData | undefined
      if (a.tags.includes(tagA) && b.tags.includes(tagB)) {
        target = b
        other = a
      } else if (b.tags.includes(tagA) && a.tags.includes(tagB)) {
        target = a
        other = b
      }
      if (!target || !other) continue
      const focus = chooseFocus(target, other, tags)
      matches.push({
        rule,
        items: [focus.focus, focus.other],
        focus: focus.focus,
        counterparts: [focus.other],
        triggered: [],
        pairKey: pairKeyOf(target.id, other.id),
        order: nextOrder(),
      })
    }
  }

  for (const rule of ENGINE_RULES) {
    if (rule.type !== 'synergy') continue
    const ids = rule.condition.items
    if (!ids || ids.length < 2) continue
    if (!ids.every((id) => items.some((item) => item.id === id))) continue
    const involved = ids.map((id) => items.find((item) => item.id === id)!).filter(Boolean)
    if (involved.length !== ids.length) continue
    matches.push({
      rule,
      items: involved,
      counterparts: [],
      triggered: [],
      pairKey: involved.length === 2 ? pairKeyOf(involved[0].id, involved[1].id) : undefined,
      order: nextOrder(),
    })
  }

  const kept = dedupeMatches(matches)

  const drafts = new Map<string, FindingDraft>()
  for (const match of kept) {
    const rule = match.rule
    let key: string

    if (rule.type === 'tag_pair' || rule.type === 'safe_clarification') {
      key = `${rule.id}|${match.focus?.id ?? match.items[0]?.id ?? ''}|${rule.override_group ?? ''}`
      const previous = drafts.get(key)
      if (!previous) {
        drafts.set(key, {
          key,
          rule,
          items: match.items,
          focus: match.focus,
          counterparts: [...match.counterparts],
          triggered: [...match.triggered],
        })
      } else {
        const counterparts = new Map(
          previous.counterparts.map((item) => [item.id, item] as const),
        )
        for (const item of match.counterparts) counterparts.set(item.id, item)
        previous.counterparts = [...counterparts.values()]
        previous.triggered = mergeTriggered([previous.triggered, match.triggered])
      }
      continue
    }

    if (rule.type === 'duplicate_ingredient') {
      key = `dup|${rule.condition.ingredient}`
    } else if (rule.type === 'tag_stack') {
      key = `stack|${rule.condition.tag}|${rule.condition.min_count ?? 2}`
    } else {
      key = `${rule.id}|${match.pairKey ?? match.items.map((item) => item.id).join('+')}`
    }

    drafts.set(key, {
      key,
      rule,
      items: match.items,
      focus: match.focus,
      counterparts: match.counterparts,
      triggered: match.triggered,
    })
  }

  let findings = [...drafts.values()].map((draft) => createFinding(draft, trayIndex))

  const exactByPair = new Map<string, Finding>()
  for (const finding of findings) {
    if (finding.type !== 'exact_pair' || finding.items.length !== 2) continue
    const key = pairKeyOf(finding.items[0].id, finding.items[1].id)
    const previous = exactByPair.get(key)
    if (!previous || finding.priority > previous.priority) exactByPair.set(key, finding)
  }

  findings = findings.filter((finding) => {
    if (finding.type === 'exact_pair' || finding.items.length !== 2) return true
    const exact = exactByPair.get(pairKeyOf(finding.items[0].id, finding.items[1].id))
    return !exact || finding.priority > exact.priority
  })

  findings = dedupeByItemSet(findings)
  findings = consolidateSpacing(findings, trayIndex)
  findings.sort(compareFindings)

  const conflicts = findings.filter(
    (finding) =>
      finding.severity === 'danger' ||
      finding.severity === 'caution' ||
      finding.severity === 'spacing',
  )
  const safetyNotes = findings.filter((finding) => finding.severity === 'safe_note')
  const synergies = findings.filter((finding) => finding.severity === 'synergy')

  const topSeverity = conflicts[0]?.severity
  const verdict: PairingReport['verdict'] =
    topSeverity === 'danger' || topSeverity === 'caution' || topSeverity === 'spacing'
      ? topSeverity
      : 'safe'

  const pairCount = allPairs(items).length
  const covered = new Set<string>()
  for (const finding of findings) {
    for (const [a, b] of allPairs(finding.items)) {
      covered.add(pairKeyOf(a.id, b.id))
    }
  }
  const safePairs: SafePair[] = allPairs(items)
    .filter(([a, b]) => !covered.has(pairKeyOf(a.id, b.id)))
    .map(([a, b]) => ({
      key: pairKeyOf(a.id, b.id),
      items: [toReportItem(a), toReportItem(b)] as [ReportItem, ReportItem],
    }))

  const spacingFindings = conflicts.filter((finding) => finding.severity === 'spacing')
  const spacingPlan =
    verdict === 'danger' ? null : buildSpacingPlan(spacingFindings, synergies, trayIndex)

  return {
    items: items.map(toReportItem),
    verdict,
    verdictTitle: VERDICT_TITLES[verdict],
    summary: buildSummary(verdict, conflicts, safetyNotes.length + synergies.length, pairCount),
    conflicts,
    safetyNotes,
    synergies,
    safePairs,
    spacingPlan,
    stats: {
      pairs: pairCount,
      danger: conflicts.filter((finding) => finding.severity === 'danger').length,
      caution: conflicts.filter((finding) => finding.severity === 'caution').length,
      spacing: spacingFindings.length,
      safetyNotes: safetyNotes.length,
      synergies: synergies.length,
      safePairs: safePairs.length,
    },
  }
}

function mergeTriggered(lists: TriggeredIngredient[][]): TriggeredIngredient[] {
  const merged = new Map<string, TriggeredIngredient>()
  for (const list of lists) {
    for (const entry of list) {
      merged.set(`${entry.itemId}|${entry.ingredient}`, entry)
    }
  }
  return [...merged.values()]
}

function renderTitle(rule: RuleData, focus?: ItemData, other?: ItemData): string {
  if (!rule.title.includes('{')) return rule.title
  return rule.title
    .replace(/\{focus\}/g, focus?.name ?? '该药物')
    .replace(/\{other\}/g, other?.name ?? '相关药物')
}

function createFinding(draft: FindingDraft, trayIndex: Map<string, number>): Finding {
  const { rule, focus } = draft
  const other =
    draft.counterparts.length > 0
      ? sortItems(draft.counterparts, trayIndex)[0]
      : undefined
  let items: ItemData[]

  if (rule.type === 'tag_pair' || rule.type === 'safe_clarification') {
    items = focus
      ? [focus, ...sortItems(draft.counterparts, trayIndex)]
      : sortItems(draft.items, trayIndex)
  } else if (rule.type === 'duplicate_ingredient' || rule.type === 'tag_stack') {
    items = sortItems(draft.items, trayIndex)
  } else {
    items = draft.items
  }

  return {
    key: draft.key,
    ruleId: rule.id,
    type: rule.type,
    severity: rule.severity,
    risk: SEVERITY_RISK[rule.severity],
    priority: rule.priority,
    overrideGroup: rule.override_group,
    title: renderTitle(rule, focus, other),
    action: rule.action,
    mechanism: rule.mechanism,
    symptoms: rule.symptoms,
    items: items.map(toReportItem),
    focusId: focus?.id,
    triggeredIngredients: sortTriggered(draft.triggered, trayIndex),
    spacingHours: rule.spacing_hours,
    spacingOrderHint: rule.spacing_order_hint,
  }
}

function sortReportItems(
  items: ReportItem[],
  trayIndex: Map<string, number>,
): ReportItem[] {
  return [...items].sort(
    (a, b) => (trayIndex.get(a.id) ?? 0) - (trayIndex.get(b.id) ?? 0),
  )
}

function sortTriggered(
  triggered: TriggeredIngredient[],
  trayIndex: Map<string, number>,
): TriggeredIngredient[] {
  return [...triggered].sort(
    (a, b) =>
      (trayIndex.get(a.itemId) ?? 0) - (trayIndex.get(b.itemId) ?? 0) ||
      a.ingredient.localeCompare(b.ingredient, 'zh-CN'),
  )
}

function compareFindings(a: Finding, b: Finding): number {
  return (
    SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity] ||
    b.priority - a.priority ||
    a.title.localeCompare(b.title, 'zh-CN')
  )
}

function dedupeByItemSet(findings: Finding[]): Finding[] {
  const best = new Map<string, Finding>()
  for (const finding of findings) {
    const signature = finding.items
      .map((item) => item.id)
      .sort()
      .join('|')
    const previous = best.get(signature)
    if (
      !previous ||
      finding.priority > previous.priority ||
      (finding.priority === previous.priority &&
        SEVERITY_ORDER[finding.severity] > SEVERITY_ORDER[previous.severity])
    ) {
      best.set(signature, finding)
    }
  }
  return [...best.values()]
}

function consolidateSpacing(
  findings: Finding[],
  trayIndex: Map<string, number>,
): Finding[] {
  const singles: Finding[] = []
  const groups = new Map<string, Finding[]>()

  for (const finding of findings) {
    if (finding.severity !== 'spacing' || !finding.focusId) {
      singles.push(finding)
      continue
    }
    const key = `${finding.overrideGroup ?? finding.ruleId}|${finding.focusId}`
    const list = groups.get(key)
    if (list) list.push(finding)
    else groups.set(key, [finding])
  }

  const consolidated: Finding[] = []
  for (const [key, list] of groups) {
    if (list.length === 1) {
      consolidated.push(list[0])
      continue
    }

    const first = list[0]
    const focus = first.items.find((item) => item.id === first.focusId)
    if (!focus) {
      consolidated.push(...list)
      continue
    }

    const counterparts = new Map<string, ReportItem>()
    for (const finding of list) {
      for (const item of finding.items) {
        if (item.id !== focus.id) counterparts.set(item.id, item)
      }
    }
    const orderedCounterparts = sortReportItems([...counterparts.values()], trayIndex)
    const hours = Math.max(...list.map((finding) => finding.spacingHours ?? 0))
    const isAdsorbent = list.some((finding) => finding.ruleId === 'tag-adsorbent-drug')
    const firstNames = isAdsorbent
      ? orderedCounterparts.map((item) => item.name).join('、')
      : focus.name
    const laterNames = isAdsorbent
      ? focus.name
      : orderedCounterparts.map((item) => item.name).join('、')
    const orderHint = isAdsorbent
      ? `间隔 ${hours} 小时后再服${focus.name}`
      : `间隔 ${hours} 小时后再服${laterNames}`

    consolidated.push({
      ...first,
      key: `spacing|${key}`,
      priority: Math.max(...list.map((finding) => finding.priority)),
      title: spacingTitle(first.overrideGroup, focus.name, first.title),
      action: `先服${firstNames}，间隔至少 ${hours} 小时后再服用${laterNames}。`,
      mechanism: spacingMechanism(first.overrideGroup, first.mechanism),
      items: [focus, ...orderedCounterparts],
      triggeredIngredients: sortTriggered(
        mergeTriggered(list.map((finding) => finding.triggeredIngredients)),
        trayIndex,
      ),
      spacingHours: hours,
      spacingOrderHint: orderHint,
    })
  }

  return [...singles, ...consolidated]
}

function spacingTitle(group: string | undefined, focusName: string, fallback: string): string {
  switch (group) {
    case '甲状腺激素吸收':
      return '左甲状腺素要空腹错开'
    case '铁吸收':
      return '补铁剂要与这些错开'
    case '矿物质螯合':
      return `${focusName}与矿物质要错开`
    case '益生菌活性':
      return '抗生素与益生菌要错开'
    case '脂溶性维生素吸收':
      return '奥利司他要错开脂溶性维生素'
    case '蒙脱石吸附':
      return '蒙脱石会吸走同服的药'
    default:
      return fallback
  }
}

function spacingMechanism(group: string | undefined, fallback: string): string {
  switch (group) {
    case '甲状腺激素吸收':
      return '钙、铁、蛋白质等与左甲状腺素结合，降低其肠道吸收。'
    case '铁吸收':
      return '咖啡、浓茶中的多酚和鞣酸，以及牛奶中的钙，都会降低铁的吸收。'
    case '矿物质螯合':
      return '多价金属离子与药物形成难溶螯合物，降低药物吸收。'
    case '益生菌活性':
      return '抗生素可能杀灭益生菌活菌，降低其效果。'
    case '脂溶性维生素吸收':
      return '奥利司他阻断脂肪吸收，也会减少脂溶性维生素的吸收。'
    case '蒙脱石吸附':
      return '蒙脱石具有广谱吸附作用，可能吸附同服药物。'
    default:
      return fallback
  }
}

function describeItemKinds(items: ReportItem[]): '药品' | '饮食或补剂' | '物品' {
  const hasDrug = items.some((item) => item.isDrug)
  const hasNonDrug = items.some((item) => !item.isDrug)
  if (hasDrug && hasNonDrug) return '物品'
  return hasDrug ? '药品' : '饮食或补剂'
}

function buildSpacingPlan(
  spacing: Finding[],
  synergies: Finding[],
  trayIndex: Map<string, number>,
): SpacingPlan | null {
  if (spacing.length === 0) return null

  const first = new Map<string, ReportItem>()
  const later = new Map<number, Map<string, ReportItem>>()
  const hintsByHours = new Map<number, Set<string>>()

  for (const finding of spacing) {
    const focus = finding.items.find((item) => item.id === finding.focusId) ?? finding.items[0]
    if (!focus) continue
    const others = finding.items.filter((item) => item.id !== focus.id)
    const isAdsorbent = finding.ruleId === 'tag-adsorbent-drug'
    const firstItems = isAdsorbent ? others : [focus]
    const laterItems = isAdsorbent ? [focus] : others
    for (const item of firstItems) first.set(item.id, item)
    const hours = finding.spacingHours ?? 0
    const group = later.get(hours) ?? new Map<string, ReportItem>()
    for (const item of laterItems) group.set(item.id, item)
    later.set(hours, group)
    if (finding.spacingOrderHint) {
      const hints = hintsByHours.get(hours) ?? new Set<string>()
      hints.add(finding.spacingOrderHint)
      hintsByHours.set(hours, hints)
    }
  }

  const synergyItems = new Map<string, ReportItem>()
  const synergyPartners = new Map<string, Set<string>>()
  const inLater = (id: string) => [...later.values()].some((group) => group.has(id))

  for (const finding of synergies) {
    const pair = finding.items
    if (pair.length !== 2) {
      for (const item of pair) synergyItems.set(item.id, item)
      continue
    }
    const [a, b] = pair
    const firstHit = first.has(a.id) ? a : first.has(b.id) ? b : undefined
    if (firstHit) {
      const other = firstHit.id === a.id ? b : a
      if (!inLater(other.id) && !first.has(other.id)) first.set(other.id, other)
      continue
    }

    let laterHit: { item: ReportItem; group: Map<string, ReportItem> } | undefined
    for (const group of later.values()) {
      if (group.has(a.id)) {
        laterHit = { item: a, group }
        break
      }
      if (group.has(b.id)) {
        laterHit = { item: b, group }
        break
      }
    }
    if (laterHit) {
      const other = laterHit.item.id === a.id ? b : a
      synergyItems.set(other.id, other)
      const partners = synergyPartners.get(other.id) ?? new Set<string>()
      partners.add(laterHit.item.name)
      synergyPartners.set(other.id, partners)
      continue
    }
    synergyItems.set(a.id, a)
    synergyItems.set(b.id, b)
  }

  for (const id of first.keys()) synergyItems.delete(id)
  for (const group of later.values()) {
    for (const id of group.keys()) {
      if (first.has(id)) group.delete(id)
      synergyItems.delete(id)
    }
  }

  const steps: SpacingStep[] = []
  if (first.size > 0) {
    const firstItems = [...first.values()]
    const kinds = describeItemKinds(firstItems)
    steps.push({
      id: 'priority',
      kind: 'priority',
      label: '优先服用',
      detail:
        kinds === '药品'
          ? '按说明书剂量用温水送服'
          : kinds === '饮食或补剂'
            ? '按推荐方式先摄入'
            : '按说明书或推荐方式先使用',
      items: sortReportItems(firstItems, trayIndex),
    })
  }

  const hourList = [...later.keys()].sort((a, b) => a - b)
  for (const hours of hourList) {
    const group = later.get(hours)
    if (!group || group.size === 0) continue
    const laterItems = [...group.values()]
    const hints = [...(hintsByHours.get(hours) ?? [])]
    const kinds = describeItemKinds(laterItems)
    const verb = kinds === '药品' ? '服用' : kinds === '饮食或补剂' ? '摄入' : '使用'
    const detail =
      hints.length === 1
        ? hints[0]
        : `间隔至少 ${hours} 小时后再${verb}以下${kinds}`
    steps.push({
      id: `spacing-${hours}`,
      kind: 'spacing',
      label: `间隔 ≥${hours} 小时`,
      detail,
      items: sortReportItems(laterItems, trayIndex),
      hours,
    })
  }

  if (synergyItems.size > 0) {
    const partners = [...new Set([...synergyPartners.values()].flatMap((set) => [...set]))]
    steps.push({
      id: 'synergy',
      kind: 'synergy',
      label: '可同餐搭配',
      detail:
        partners.length > 0
          ? `可与${partners.join('、')}同餐服用，按推荐方式搭配即可`
          : '这些组合有助于吸收，可按推荐方式随餐服用',
      items: sortReportItems([...synergyItems.values()], trayIndex),
    })
  }

  if (steps.length === 0) return null
  return { totalHours: Math.max(0, ...hourList), steps }
}

function buildSummary(
  verdict: PairingReport['verdict'],
  conflicts: Finding[],
  positiveCount: number,
  pairCount: number,
): string {
  const top = conflicts[0]
  if (verdict === 'danger' && top) {
    const dangerCount = conflicts.filter((finding) => finding.severity === 'danger').length
    return `发现 ${dangerCount} 组不建议同用的搭配。\n优先处理「${top.title}」。`
  }
  if (verdict === 'caution' && top) {
    return `发现 ${conflicts.length} 组需谨慎的搭配。\n重点关注「${top.title}」。`
  }
  if (verdict === 'spacing' && top) {
    const spacing = conflicts.filter((finding) => finding.severity === 'spacing')
    const hours = Math.max(...spacing.map((finding) => finding.spacingHours ?? 0))
    return `发现 ${spacing.length} 组需间隔的搭配，至少间隔 ${hours} 小时。\n优先处理「${top.title}」。`
  }
  return positiveCount > 0
    ? `已比对 ${pairCount} 组两两搭配，暂未发现已知冲突，另有 ${positiveCount} 条安心提示。规则未覆盖的组合不等于安全，仍需以说明书为准。`
    : `已比对 ${pairCount} 组两两搭配，暂未发现已知冲突。规则未覆盖的组合不等于安全，仍需以说明书为准。`
}

export function validateRulesData(
  items: readonly ItemData[] = ENGINE_ITEMS,
  rules: readonly RuleData[] = ENGINE_RULES,
  hints: Record<string, string[]> = INGREDIENT_HINTS,
): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const itemIds = new Set<string>()
  const tags = new Set<string>()
  const ingredients = new Set<string>()

  for (const item of items) {
    if (itemIds.has(item.id)) errors.push(`items.json 存在重复 id：${item.id}`)
    itemIds.add(item.id)
    for (const tag of item.tags) tags.add(tag)
    for (const ingredient of item.ingredients) ingredients.add(ingredient)
  }

  const ruleIds = new Set<string>()
  for (const rule of rules) {
    if (ruleIds.has(rule.id)) errors.push(`rules.json 存在重复 id：${rule.id}`)
    ruleIds.add(rule.id)

    if (
      ![
        'duplicate_ingredient',
        'exact_pair',
        'tag_pair',
        'tag_stack',
        'safe_clarification',
        'synergy',
      ].includes(rule.type)
    ) {
      errors.push(`规则 ${rule.id} 的 type 不合法：${rule.type}`)
    }
    if (!['danger', 'caution', 'spacing', 'safe_note', 'synergy'].includes(rule.severity)) {
      errors.push(`规则 ${rule.id} 的 severity 不合法：${rule.severity}`)
    }
    if (rule.severity === 'spacing' && !rule.spacing_hours) {
      errors.push(`spacing 规则缺少 spacing_hours：${rule.id}`)
    }
    if (rule.severity !== 'spacing' && rule.spacing_hours != null) {
      errors.push(`非 spacing 规则不应填写 spacing_hours：${rule.id}`)
    }

    const condition = rule.condition
    if (condition.ingredient && !ingredients.has(condition.ingredient)) {
      errors.push(`规则 ${rule.id} 引用了不存在的成分：${condition.ingredient}`)
    }
    if (condition.tag && !tags.has(condition.tag)) {
      errors.push(`规则 ${rule.id} 引用了不存在的标签：${condition.tag}`)
    }
    for (const tag of condition.tags ?? []) {
      if (!tags.has(tag)) errors.push(`规则 ${rule.id} 引用了不存在的标签：${tag}`)
    }
    if (condition.focus_tag && !(condition.tags ?? []).includes(condition.focus_tag)) {
      warnings.push(`规则 ${rule.id} 的 focus_tag 不在 tags 中：${condition.focus_tag}`)
    }
    for (const id of condition.items ?? []) {
      if (!itemIds.has(id)) errors.push(`规则 ${rule.id} 引用了不存在的物品 id：${id}`)
    }
    if (
      (rule.type === 'tag_pair' || rule.type === 'safe_clarification') &&
      (!condition.tags || condition.tags.length !== 2) &&
      !(condition.tag && condition.target_is_drug)
    ) {
      warnings.push(`规则 ${rule.id} 的标签条件不是两个标签`)
    }
    if (rule.type === 'tag_stack' && (condition.min_count ?? 2) < 2) {
      warnings.push(`规则 ${rule.id} 的 min_count 小于 2`)
    }
    if (
      (rule.type === 'exact_pair' || rule.type === 'synergy') &&
      (!condition.items || condition.items.length !== 2)
    ) {
      warnings.push(`规则 ${rule.id} 的物品条件不是一对物品`)
    }
  }

  for (const [tag, list] of Object.entries(hints)) {
    if (!tags.has(tag)) errors.push(`ingredient_hints 引用了不存在的标签：${tag}`)
    for (const ingredient of list) {
      if (!ingredients.has(ingredient)) {
        errors.push(`ingredient_hints[${tag}] 引用了不存在的成分：${ingredient}`)
      }
    }
  }

  return { ok: errors.length === 0, errors, warnings }
}