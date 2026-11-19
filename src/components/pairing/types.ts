export type NoticeTone = 'info' | 'warn'

export interface Notice {
  nonce: number
  text: string
  tone: NoticeTone
}
