import test from 'node:test'
import assert from 'node:assert/strict'
import { evaluatePairing, validateRulesData } from './pairing-engine.ts'

test('rules.json 与 items.json 的中文标签、成分和 id 完全一致', () => {
  const result = validateRulesData()
  assert.deepEqual(result.errors, [])
  assert.equal(result.ok, true)
})

test('布洛芬 + 999感冒灵颗粒：解热镇痛叠加并透视对乙酰氨基酚', () => {
  const report = evaluatePairing(['布洛芬', '999感冒灵颗粒'])

  assert.equal(report.verdict, 'caution')
  const finding = report.conflicts.find((item) => item.title.includes('退烧止痛'))
  assert.ok(finding)
  assert.equal(finding.type, 'tag_stack')
  assert.equal(finding.severity, 'caution')
  assert.ok(
    finding.triggeredIngredients.some(
      (entry) =>
        entry.itemId === '999感冒灵颗粒' && entry.ingredient === '对乙酰氨基酚',
    ),
  )
})

test('头孢类 + 藿香正气水：双硫仑风险并透视酒精', () => {
  const report = evaluatePairing(['头孢类', '藿香正气水'])

  assert.equal(report.verdict, 'danger')
  const finding = report.conflicts.find((item) => item.ruleId === 'tag-alcohol-disulfiram')
  assert.ok(finding)
  assert.equal(finding.severity, 'danger')
  assert.ok(
    finding.triggeredIngredients.some(
      (entry) => entry.itemId === '藿香正气水' && entry.ingredient === '酒精',
    ),
  )
})

test('头孢类 + 藿香正气口服液：安全并给出不含酒精澄清', () => {
  const report = evaluatePairing(['头孢类', '藿香正气口服液'])

  assert.equal(report.verdict, 'safe')
  assert.equal(report.conflicts.length, 0)
  assert.equal(report.safetyNotes.length, 1)
  assert.equal(report.safetyNotes[0].ruleId, 'safe-oral-liquid-disulfiram')
  assert.ok(
    report.safetyNotes[0].triggeredIngredients.every(
      (entry) => entry.ingredient !== '酒精',
    ),
  )
})

test('左甲状腺素 + 牛奶 + 钙片 + 维生素D：聚合错峰并保留维D钙协同', () => {
  const report = evaluatePairing(['左甲状腺素', '牛奶', '钙片', '维生素D'])

  assert.equal(report.verdict, 'spacing')
  assert.equal(report.conflicts.some((item) => item.severity === 'danger'), false)

  const spacing = report.conflicts.find(
    (item) =>
      item.severity === 'spacing' &&
      item.items.some((entry) => entry.id === '牛奶') &&
      item.items.some((entry) => entry.id === '钙片'),
  )
  assert.ok(spacing)
  assert.equal(spacing.spacingHours, 4)
  assert.ok(
    spacing.triggeredIngredients.some(
      (entry) => entry.itemId === '牛奶' && entry.ingredient === '钙',
    ),
  )

  const plan = report.spacingPlan
  assert.ok(plan)
  assert.equal(plan.totalHours, 4)
  const priority = plan.steps.find((step) => step.kind === 'priority')
  assert.ok(priority?.items.some((item) => item.id === '左甲状腺素'))
  const spacingStep = plan.steps.find((step) => step.kind === 'spacing' && step.hours === 4)
  assert.ok(spacingStep?.items.some((item) => item.id === '牛奶'))
  assert.ok(spacingStep?.items.some((item) => item.id === '钙片'))
  assert.ok(plan.steps.some((step) => step.items.some((item) => item.id === '维生素D')))

  const synergy = report.synergies.find(
    (item) =>
      item.items.some((entry) => entry.id === '钙片') &&
      item.items.some((entry) => entry.id === '维生素D'),
  )
  assert.ok(synergy)
})

test('华法林 + 布洛芬 + 鱼油 + 绿叶蔬菜：三重出血叠加与维K拮抗', () => {
  const report = evaluatePairing(['华法林', '布洛芬', '鱼油', '绿叶蔬菜'])

  assert.equal(report.verdict, 'danger')
  assert.equal(report.spacingPlan, null)

  const bleeding = report.conflicts.find((item) => item.ruleId === 'stack-bleeding-3')
  assert.ok(bleeding)
  assert.equal(bleeding.severity, 'danger')
  assert.equal(bleeding.items.length, 3)
  assert.ok(!report.conflicts.some((item) => item.ruleId === 'stack-bleeding-2'))

  const vitaminK = report.conflicts.find((item) => item.ruleId === 'tag-vitk-warfarin')
  assert.ok(vitaminK)
  assert.ok(
    vitaminK.triggeredIngredients.some(
      (entry) => entry.itemId === '绿叶蔬菜' && entry.ingredient === '维生素K',
    ),
  )
})

test('同一目标药物的多个金属离子来源聚合为一张卡片', () => {
  const report = evaluatePairing(['多西环素', '牛奶', '钙片'])
  const spacing = report.conflicts.find((item) => item.severity === 'spacing')

  assert.ok(spacing)
  assert.deepEqual(
    spacing.items.map((item) => item.id).sort(),
    ['多西环素', '牛奶', '钙片'].sort(),
  )
  assert.ok(
    spacing.triggeredIngredients.some(
      (entry) => entry.itemId === '牛奶' && entry.ingredient === '钙',
    ),
  )
})

test('蒙脱石散只拦截药物，不拦截食物', () => {
  const report = evaluatePairing(['蒙脱石散', '阿莫西林', '香蕉'])
  const spacing = report.conflicts.find((item) => item.ruleId === 'tag-adsorbent-drug')

  assert.ok(spacing)
  assert.equal(spacing.items.some((item) => item.id === '香蕉'), false)
  assert.deepEqual(
    spacing.items.map((item) => item.id).sort(),
    ['蒙脱石散', '阿莫西林'].sort(),
  )
})

test('同一组物品的重复成分与同类叠加只保留最高优先级卡片', () => {
  const report = evaluatePairing(['999感冒灵颗粒', '维C银翘片'])

  assert.equal(report.conflicts.length, 1)
  assert.equal(report.conflicts[0].ruleId, 'dup-acetaminophen')
  assert.equal(report.conflicts[0].severity, 'danger')
})