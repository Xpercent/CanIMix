import { useEffect, type RefObject } from 'react'

/** 滚动容器的上下淡出：可滚动时底部留 20u 渐隐，滚动后顶部留 8u。 */
export function useScrollMask(ref: RefObject<HTMLElement | null>, revision: string): void {
  useEffect(() => {
    const element = ref.current
    if (!element) return

    let frame = 0
    const apply = () => {
      frame = 0
      const max = element.scrollHeight - element.clientHeight
      const scrollable = max > 2
      const top = scrollable && element.scrollTop > 4 ? 8 : 0
      const bottom = scrollable ? 20 : 0
      element.style.setProperty('--fade-top', `${top}`)
      element.style.setProperty('--fade-bottom', `${bottom}`)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(apply)
    }

    apply()
    element.addEventListener('scroll', onScroll, { passive: true })
    const observer = new ResizeObserver(apply)
    observer.observe(element)
    return () => {
      element.removeEventListener('scroll', onScroll)
      observer.disconnect()
      if (frame) cancelAnimationFrame(frame)
    }
  }, [ref, revision])
}
