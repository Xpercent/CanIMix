export type CategoryId =
  | 'cold'
  | 'infection'
  | 'digestive'
  | 'cardio'
  | 'metabolic'
  | 'neuro'
  | 'hormone'
  | 'vitamins'
  | 'supplements'
  | 'produce'
  | 'drinks'
  | 'meals'

export type CategoryFilter = 'all' | CategoryId

export interface Category {
  id: CategoryId
  shortName: string
  fullName: string
  order: number
}

export interface PairingItem {
  id: string
  name: string
  displayName: string
  shortName: string
  categoryId: CategoryId
  art: string
  keywords: string[]
  order: number
}

export const MAX_SLOTS = 5

export const CATEGORIES: readonly Category[] = [
  { id: 'cold', shortName: '感冒过敏', fullName: '感冒止痛与过敏', order: 1 },
  { id: 'infection', shortName: '抗感染', fullName: '抗生素与抗感染', order: 2 },
  { id: 'digestive', shortName: '肠胃消化', fullName: '肠胃与消化用药', order: 3 },
  { id: 'cardio', shortName: '心脑血管', fullName: '心脑血管与三高慢病', order: 4 },
  { id: 'metabolic', shortName: '降糖代谢', fullName: '降糖痛风与代谢', order: 5 },
  { id: 'neuro', shortName: '精神助眠', fullName: '精神神经与助眠', order: 6 },
  { id: 'hormone', shortName: '激素专科', fullName: '激素避孕与专科药', order: 7 },
  { id: 'vitamins', shortName: '维生素', fullName: '维生素与矿物质', order: 8 },
  { id: 'supplements', shortName: '保健中药', fullName: '保健品与中草药', order: 9 },
  { id: 'produce', shortName: '果蔬', fullName: '水果与蔬菜', order: 10 },
  { id: 'drinks', shortName: '饮品', fullName: '日常饮品', order: 11 },
  { id: 'meals', shortName: '餐食调味', fullName: '日常餐食与调味', order: 12 },
]

export const CATEGORY_BY_ID = new Map<CategoryId, Category>(
  CATEGORIES.map((category) => [category.id, category]),
)

interface ItemSeed extends Omit<PairingItem, 'art'> {
  artPath: string
}

const ITEM_SEEDS: readonly ItemSeed[] = [
  {
    id: 'ibuprofen',
    name: '布洛芬',
    displayName: '布洛芬',
    shortName: '布洛芬',
    categoryId: 'cold',
    artPath: '01_感冒止痛与过敏/解热镇痛药-布洛芬.svg',
    keywords: ['ibuprofen', 'blf', '退烧', '止痛', '解热镇痛'],
    order: 1,
  },
  {
    id: 'cold-999',
    name: '999 感冒灵颗粒',
    displayName: '999 感冒灵',
    shortName: '感冒灵',
    categoryId: 'cold',
    artPath: '01_感冒止痛与过敏/复方感冒药-999感冒灵颗粒.svg',
    keywords: ['999', 'ganmaoling', 'gml', '复方感冒药', '对乙酰氨基酚'],
    order: 2,
  },
  {
    id: 'loratadine',
    name: '氯雷他定',
    displayName: '氯雷他定',
    shortName: '氯雷他定',
    categoryId: 'cold',
    artPath: '01_感冒止痛与过敏/抗过敏药-氯雷他定.svg',
    keywords: ['loratadine', 'lltd', '抗过敏', '过敏'],
    order: 3,
  },
  {
    id: 'amoxicillin',
    name: '阿莫西林',
    displayName: '阿莫西林',
    shortName: '阿莫西林',
    categoryId: 'infection',
    artPath: '02_抗生素与抗感染/抗生素-阿莫西林.svg',
    keywords: ['amoxicillin', 'amxl', '青霉素', '抗生素'],
    order: 4,
  },
  {
    id: 'omeprazole',
    name: '奥美拉唑',
    displayName: '奥美拉唑',
    shortName: '奥美拉唑',
    categoryId: 'digestive',
    artPath: '03_肠胃与消化用药/抑酸药-奥美拉唑.svg',
    keywords: ['omeprazole', 'omlz', '胃药', '抑酸', '肠胃'],
    order: 5,
  },
  {
    id: 'aspirin',
    name: '阿司匹林',
    displayName: '阿司匹林',
    shortName: '阿司匹林',
    categoryId: 'cardio',
    artPath: '04_心脑血管与三高慢病/抗血小板药-阿司匹林.svg',
    keywords: ['aspirin', 'aspl', '抗血小板', '抗凝'],
    order: 6,
  },
  {
    id: 'metformin',
    name: '二甲双胍',
    displayName: '二甲双胍',
    shortName: '二甲双胍',
    categoryId: 'metabolic',
    artPath: '05_降糖痛风与代谢/降糖药-二甲双胍.svg',
    keywords: ['metformin', 'ejsg', '降糖', '血糖'],
    order: 7,
  },
  {
    id: 'melatonin',
    name: '褪黑素',
    displayName: '褪黑素',
    shortName: '褪黑素',
    categoryId: 'neuro',
    artPath: '06_精神神经与助眠/褪黑素.svg',
    keywords: ['melatonin', 'hts', '助眠', '睡眠'],
    order: 8,
  },
  {
    id: 'grapefruit',
    name: '西柚',
    displayName: '西柚',
    shortName: '西柚',
    categoryId: 'produce',
    artPath: '10_水果与蔬菜/西柚.svg',
    keywords: ['grapefruit', 'xiyou', '柚子', '水果', 'pomelo'],
    order: 9,
  },
  {
    id: 'coffee',
    name: '咖啡',
    displayName: '咖啡',
    shortName: '咖啡',
    categoryId: 'drinks',
    artPath: '11_日常饮品/咖啡.svg',
    keywords: ['coffee', 'kafei', '咖啡因', '饮品'],
    order: 10,
  },
]

const artModules = import.meta.glob('../../assets/items/**/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

const ART_BY_PATH = new Map<string, string>(
  Object.entries(artModules).map(([path, url]) => {
    const marker = '/assets/items/'
    const index = path.indexOf(marker)
    return [index === -1 ? path : path.slice(index + marker.length), url] as const
  }),
)

function resolveArt(path: string): string {
  const url = ART_BY_PATH.get(path)
  if (!url) {
    console.warn(`[pairing] missing SVG asset: ${path}`)
    return ''
  }
  return url
}

export const PAIRING_ITEMS: readonly PairingItem[] = ITEM_SEEDS.map(
  ({ artPath, ...item }) => ({ ...item, art: resolveArt(artPath) }),
)

export const ITEM_BY_ID = new Map<string, PairingItem>(
  PAIRING_ITEMS.map((item) => [item.id, item]),
)

export function normalizeSearch(value: string): string {
  return value
    .toLocaleLowerCase('zh-CN')
    .replace(/[\s\-_·，,。.、/\\()（）]/g, '')
}

const SEARCH_HAYSTACKS = new Map<string, string>(
  PAIRING_ITEMS.map((item) => {
    const category = CATEGORY_BY_ID.get(item.categoryId)
    const text = [
      item.name,
      item.displayName,
      item.shortName,
      ...item.keywords,
      category?.fullName ?? '',
    ].join(' ')
    return [item.id, normalizeSearch(text)] as const
  }),
)

export function itemMatchesQuery(item: PairingItem, query: string): boolean {
  const needle = normalizeSearch(query)
  if (!needle) return true
  return SEARCH_HAYSTACKS.get(item.id)?.includes(needle) ?? false
}