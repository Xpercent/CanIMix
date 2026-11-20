import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { pinyin } from 'pinyin-pro'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const itemsFile = JSON.parse(
  fs.readFileSync(path.join(root, 'src/data/items.json'), 'utf8'),
)

// 与 pairing-data.ts 中的短名、分类名保持一致，覆盖额外的检索用字。
const EXTRA_TERMS = [
  '999感冒灵',
  '藿香口服液',
  '短效避孕药',
  '感冒过敏',
  '抗感染',
  '肠胃消化',
  '心脑血管',
  '降糖代谢',
  '精神助眠',
  '激素专科',
  '维生素',
  '保健中药',
  '果蔬',
  '饮品',
  '餐食调味',
]

const texts = EXTRA_TERMS.slice()
for (const item of itemsFile.items) {
  texts.push(item.name, item.category, ...item.ingredients, ...item.tags)
}

const CJK_RE = /[\u3400-\u4dbf\u4e00-\u9fff]/
const readings = new Map()

for (const text of texts) {
  const chars = [...text]
  const syllables = pinyin(text, { toneType: 'none', type: 'array' })
  if (syllables.length !== chars.length) {
    throw new Error(`pinyin alignment mismatch: ${text}`)
  }
  for (let index = 0; index < chars.length; index += 1) {
    const char = chars[index]
    if (!CJK_RE.test(char)) continue
    if (!readings.has(char)) readings.set(char, new Map())
    const counter = readings.get(char)
    const syllable = syllables[index]
    counter.set(syllable, (counter.get(syllable) ?? 0) + 1)
  }
}

const conflicts = [...readings].filter(([, counter]) => counter.size > 1)
if (conflicts.length > 0) {
  console.warn(
    'polyphonic characters kept a single reading:',
    conflicts.map(([char, counter]) => `${char}:${[...counter.keys()].join('/')}`).join(', '),
  )
}

const entries = [...readings]
  .map(([char, counter]) => {
    const [syllable] = [...counter.entries()].sort((a, b) => b[1] - a[1])[0]
    return [char, syllable]
  })
  .sort((a, b) => a[0].codePointAt(0) - b[0].codePointAt(0))

const lines = [
  '// 由 tools/generate-pinyin-map.mjs 根据 items.json 生成，勿手改。',
  'export const PINYIN_BY_CHAR: Record<string, string> = {',
]
const chunkSize = 8
for (let index = 0; index < entries.length; index += chunkSize) {
  const chunk = entries.slice(index, index + chunkSize)
  lines.push(`  ${chunk.map(([char, syllable]) => `'${char}': '${syllable}',`).join(' ')}`)
}
lines.push('}', '')

const output = path.join(root, 'src/components/pairing/pinyin-map.ts')
fs.writeFileSync(output, lines.join('\n'))
console.log(`wrote ${entries.length} characters to ${path.relative(root, output)}`)
