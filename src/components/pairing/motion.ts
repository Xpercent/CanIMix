export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export const SLOT_EXIT_MS = 110
export const SLOT_EXIT_EASING = 'ease-in'

export const SLOT_CLEAR_MS = 190
export const SLOT_CLEAR_STAGGER_MS = 24
export const SLOT_CLEAR_EASING = 'ease-in'

export const SLOT_FLIP_MS = 360
export const SLOT_FLIP_EASING = 'cubic-bezier(.22,1.02,.36,1)'