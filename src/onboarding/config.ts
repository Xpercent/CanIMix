/**
 * 评委引导总开关。
 *
 * - 构建时置 `VITE_GUIDE=off` 可彻底关闭起始页与引导；
 * - 运行中还可以用舞台左上角的开关临时启停，选择会写入 localStorage。
 */
export const GUIDE_MASTER_ENABLED = import.meta.env.VITE_GUIDE !== 'off'

export const GUIDE_STORAGE_KEY = 'tongfu.guide.enabled'

export function readGuideEnabled(): boolean {
  if (!GUIDE_MASTER_ENABLED) return false
  try {
    const stored = window.localStorage.getItem(GUIDE_STORAGE_KEY)
    if (stored === '0') return false
    if (stored === '1') return true
  } catch {
    // 隐私模式下 localStorage 可能不可用，回落到默认开启
  }
  return true
}

export function persistGuideEnabled(value: boolean) {
  try {
    window.localStorage.setItem(GUIDE_STORAGE_KEY, value ? '1' : '0')
  } catch {
    // 写不进去也不影响本次会话
  }
}
