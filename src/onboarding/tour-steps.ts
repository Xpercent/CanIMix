import type { PairingTourEvent } from '@/components/pairing/types'

export interface TourStep {
  id: string
  title: string
  body: string
  hint: string
  /** 手机内需要高亮、并由评委真实点击的元素 */
  target: string
  /** 可选：贴近高亮目标的一句动作提示，不读卡片也能看懂要点哪里 */
  actionLabel?: string
  /** 可选：卡片整体上移的像素数，避免底部目标把卡片压到舞台底边 */
  lift?: number
  /** 可选：在上移基础上再抬高的卡片高度倍数 */
  liftCards?: number
  /** 完成本步交互后直接结束引导，不再显示下一步 */
  endOnAccept?: boolean
  accepts: (event: PairingTourEvent) => boolean
  nudge?: (event: PairingTourEvent) => string | null
}

const COLD_ITEM = '999感冒灵颗粒'
const ALCOHOL = '酒精饮品'

/** 收尾演示自动放上台面的三样肠胃用药 */
export const DEMO_ITEMS = ['多潘立酮', '蒙脱石散', '铝碳酸镁'] as const

function expectsCategory(targetId: string): (event: PairingTourEvent) => boolean {
  return (event) => event.type === 'category' && event.category === targetId
}

function wrongCategory(targetId: string, label: string) {
  return (event: PairingTourEvent): string | null =>
    event.type === 'category' && event.category !== targetId
      ? `点高亮处的「${label}」分类试试`
      : null
}

export const TOUR_STEPS: readonly TourStep[] = [
  {
    id: 'pick-cold',
    title: '从分类开始挑',
    body: '左侧 12 个分类，药品、保健品、果蔬和饮品都在一起。先点「感冒过敏」，看看货架上有什么。',
    hint: '在手机上点击高亮处',
    target: '[data-rail-id="cold"]',
    accepts: expectsCategory('cold'),
    nudge: wrongCategory('cold', '感冒过敏'),
  },
  {
    id: 'first-item',
    title: '把东西放上检测台',
    body: '点「999感冒灵」——它和不少常见饮品都合不来。台面最多叠放 5 项，随时可以点圆盘移出。',
    hint: '点高亮处的物品卡片',
    target: `[data-item-id="${COLD_ITEM}"]`,
    accepts: (event) => event.type === 'stack' && event.ids.length >= 1,
  },
  {
    id: 'pick-drinks',
    title: '换一类：日常饮品',
    body: '会打架的不只有药。咖啡、酒、牛奶这些喝的东西，也会影响药效。点左侧「饮品」继续。',
    hint: '点左侧「饮品」分类',
    target: '[data-rail-id="drinks"]',
    accepts: expectsCategory('drinks'),
    nudge: wrongCategory('drinks', '饮品'),
  },
  {
    id: 'add-alcohol',
    title: '再加一项：酒精饮品',
    body: '感冒药里的镇静成分遇上酒精，会放大嗜睡和呼吸抑制。点「酒精饮品」，把第二项放上台面。',
    hint: '点高亮处的「酒精饮品」',
    target: `[data-item-id="${ALCOHOL}"]`,
    accepts: (event) =>
      event.type === 'stack' && event.ids.includes(ALCOHOL),
    nudge: (event) => {
      if (event.type === 'category') return '先留在「饮品」分类里，再点「酒精饮品」'
      if (event.type === 'stack' && event.ids.length >= 2 && !event.ids.includes(ALCOHOL)) {
        return '再加「酒精饮品」这一项试试'
      }
      return null
    },
  },
  {
    id: 'start-test',
    title: '开始检测',
    body: '两件物品就位，下方按钮已经亮起。点「开始检测」，看看它们能不能一起用。',
    hint: '点下方「开始检测」',
    target: '[data-pairing-start]',
    actionLabel: '点这里开始检测',
    lift: 22,
    liftCards: 0.5,
    accepts: (event) => event.type === 'sheet-open',
    nudge: (event) =>
      event.type === 'stack' && event.ids.length < 2
        ? '台面至少需要 2 项，先再挑一项回来'
        : null,
  },
  {
    id: 'read-result',
    title: '结论按风险分级',
    body: '红色代表危险组合，黄色需要留意，绿色是安全或协同。往下滑还能看到作用机制和错开服用时间；看完点「知道了」收起。',
    hint: '点高亮处的「知道了」',
    target: '.po-sheet-primary',
    actionLabel: '看完点这里收起',
    lift: 22,
    liftCards: 0.5,
    accepts: (event) => event.type === 'sheet-close',
  },
  {
    id: 'demo-stage',
    title: '多类药物与食物，一起查',
    body: '已切到「肠胃消化」，放上多潘立酮、蒙脱石散和铝碳酸镁。不止药品——12 个分类里的果蔬、饮品、保健品都能放上台面，两两自动比对。点「开始检测」。',
    hint: '点下方「开始检测」',
    target: '[data-pairing-start]',
    actionLabel: '点这里开始检测',
    lift: 22,
    liftCards: 0.5,
    accepts: (event) => event.type === 'sheet-open',
  },
  {
    id: 'demo-result',
    title: '不同冲突，分级说明',
    body: '上一组判为危险同用，这一组只需错开：蒙脱石散会吸走同服的药，至少间隔 2 小时。不同冲突会给出不同分级。看完点「知道了」，引导结束。',
    hint: '点高亮处的「知道了」结束引导',
    target: '.po-sheet-primary',
    actionLabel: '看完点这里结束',
    lift: 22,
    liftCards: 0.5,
    endOnAccept: true,
    accepts: (event) => event.type === 'sheet-close',
  },
]
