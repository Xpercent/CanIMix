import { PINYIN_BY_CHAR } from './pinyin-map'

const CJK_RE = /[\u3400-\u4dbf\u4e00-\u9fff]/
const ASCII_ALNUM_RE = /[a-z0-9]/
const cache = new Map<string, string>()

export function hasCjk(value: string): boolean {
  return CJK_RE.test(value)
}

export function normalizePinyinQuery(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en-US')
    .replace(/[^a-z0-9]/g, '')
}

function convertToken(token: string): { full: string; initials: string } {
  let full = ''
  let initials = ''
  for (const char of token) {
    const syllable = PINYIN_BY_CHAR[char]
    if (syllable) {
      full += syllable
      initials += syllable[0]
      continue
    }
    const lower = char.toLocaleLowerCase('en-US')
    if (ASCII_ALNUM_RE.test(lower)) {
      full += lower
      initials += lower
    }
  }
  return { full, initials }
}

// 每个词单独生成全拼与首字母，再以空格分隔，避免相邻词拼接出跨词误命中。
// ü 同时给出 v / u 两种写法，兼容 lv、lu 两种键盘输入。
export function pinyinHaystack(text: string): string {
  const cached = cache.get(text)
  if (cached !== undefined) return cached

  const tokens: string[] = []
  for (const segment of text.split(/\s+/)) {
    if (!segment) continue
    const { full, initials } = convertToken(segment)
    if (!full) continue
    const vSpelling = full.replaceAll('ü', 'v')
    tokens.push(vSpelling, initials)
    if (vSpelling !== full) tokens.push(full.replaceAll('ü', 'u'))
  }

  const value = tokens.join(' ')
  cache.set(text, value)
  return value
}
