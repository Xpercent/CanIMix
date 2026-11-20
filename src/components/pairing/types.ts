import type { CategoryFilter } from './pairing-data'

export type NoticeTone = 'info' | 'warn'

export interface Notice {
  nonce: number
  text: string
  tone: NoticeTone
}

/** 向外层引导上报的真实交互，引导只在这些事件上推进。 */
export type PairingTourEvent =
  | { type: 'category'; category: CategoryFilter }
  | { type: 'stack'; ids: readonly string[] }
  | { type: 'sheet-open' }
  | { type: 'sheet-close' }
