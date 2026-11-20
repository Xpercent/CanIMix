import itemsFile from '../../data/items.json'
import { hasCjk, normalizePinyinQuery, pinyinHaystack } from './pinyin'

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
  icon: string
  is_drug: boolean
  ingredients: string[]
  tags: string[]
  order: number
}

interface RawItem {
  id: string
  name: string
  category: string
  icon: string
  is_drug: boolean
  ingredients: string[]
  tags: string[]
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

const CATEGORY_ID_BY_NAME: Record<string, CategoryId | undefined> = {
  感冒止痛与过敏: 'cold',
  抗生素与抗感染: 'infection',
  肠胃与消化用药: 'digestive',
  心脑血管与三高慢病: 'cardio',
  降糖痛风与代谢: 'metabolic',
  精神神经与助眠: 'neuro',
  激素避孕与专科药: 'hormone',
  维生素与矿物质: 'vitamins',
  保健品与中草药: 'supplements',
  水果与蔬菜: 'produce',
  日常饮品: 'drinks',
  日常餐食与调味: 'meals',
}

const SHORT_NAMES: Record<string, string> = {
  '999感冒灵颗粒': '999感冒灵',
  '藿香正气口服液': '藿香口服液',
  头孢类: '头孢类',
  MAOI: 'MAOI',
  SSRI: 'SSRI',
  三环类: '三环类',
  洛尔类: '洛尔类',
  普利类: '普利类',
  沙坦类: '沙坦类',
  苯二氮䓬类: 'BZD 类',
  非苯二氮䓬类: 'Z 类安眠药',
  复方短效口服避孕药: '短效避孕药',
}

// 图标全部内联进主包：93 个独立 SVG 在弱网下会排队请求，导致图标逐个迟到
const artModules = import.meta.glob('../../assets/items/**/*.svg', {
  eager: true,
  query: '?inline',
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

const RAW_ITEMS = (itemsFile as { items: RawItem[] }).items

export const PAIRING_ITEMS: readonly PairingItem[] = RAW_ITEMS.flatMap((raw, index) => {
  const categoryId = CATEGORY_ID_BY_NAME[raw.category]
  if (!categoryId) {
    console.warn(`[pairing] unknown category: ${raw.category}`)
    return []
  }
  return [
    {
      id: raw.id,
      name: raw.name,
      displayName: raw.name,
      shortName: SHORT_NAMES[raw.id] ?? raw.name,
      categoryId,
      art: resolveArt(raw.icon),
      icon: raw.icon,
      is_drug: raw.is_drug,
      ingredients: raw.ingredients,
      tags: raw.tags,
      order: index,
    },
  ]
})

export const ITEM_BY_ID = new Map<string, PairingItem>(
  PAIRING_ITEMS.map((item) => [item.id, item]),
)

export function normalizeSearch(value: string): string {
  return value
    .toLocaleLowerCase('zh-CN')
    .replace(/[\s\-_·，,。.、/\\()（）]/g, '')
}

function nameText(item: PairingItem): string {
  return [item.name, item.displayName, item.shortName].join(' ')
}

function searchableText(item: PairingItem): string {
  return `${nameText(item)} ${item.tags.join(' ')}`
}

const SEARCH_HAYSTACKS = new Map<string, string>(
  PAIRING_ITEMS.map((item) => [item.id, normalizeSearch(searchableText(item))] as const),
)

const SEARCH_PINYIN = new Map<string, string>(
  PAIRING_ITEMS.map((item) => [item.id, pinyinHaystack(nameText(item))] as const),
)

export function itemMatchesQuery(item: PairingItem, query: string): boolean {
  const needle = normalizeSearch(query)
  if (!needle) return true
  if (SEARCH_HAYSTACKS.get(item.id)?.includes(needle)) return true
  if (hasCjk(query)) return false
  const pinyinNeedle = normalizePinyinQuery(query)
  if (!pinyinNeedle) return false
  return SEARCH_PINYIN.get(item.id)?.includes(pinyinNeedle) ?? false
}
