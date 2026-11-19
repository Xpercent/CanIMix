export type HapticKind =
  | 'add'
  | 'remove'
  | 'duplicate'
  | 'full'
  | 'ready'
  | 'clear'
  | 'undo'
  | 'category'
  | 'test'

const VIBRATION: Record<HapticKind, number | number[]> = {
  add: 8,
  remove: 6,
  duplicate: [10, 30, 10],
  full: [12, 45, 12],
  ready: 10,
  clear: 8,
  undo: 6,
  category: 4,
  test: 12,
}

// Web 端没有 iOS 触觉；Capacitor 接入时映射到 UIImpactFeedbackGenerator。
export function haptic(kind: HapticKind): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
    return
  }
  try {
    navigator.vibrate(VIBRATION[kind])
  } catch {
    // 浏览器可能因权限或用户手势限制而拒绝，视觉反馈已覆盖。
  }
}