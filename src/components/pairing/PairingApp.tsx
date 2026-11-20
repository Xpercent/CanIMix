import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import {
  CATEGORIES,
  ITEM_BY_ID,
  MAX_SLOTS,
  PAIRING_ITEMS,
  itemMatchesQuery,
  type CategoryFilter,
  type CategoryId,
  type PairingItem,
} from './pairing-data'
import { LibraryPanel, type RailEntry } from './LibraryPanel'
import { Bench, type BenchHandle } from './Bench'
import { ControlDeck } from './ControlDeck'
import { Flight, type FlightState } from './Flight'
import { HeroHeader } from './HeroHeader'
import { StatusBar } from './StatusBar'
import { ResultSheet } from './ResultSheet'
import { validateRulesData } from './pairing-engine'
import { haptic } from './haptics'
import { prefersReducedMotion } from './motion'
import type { Notice, NoticeTone } from './types'

const NO_SLOT_INDEX = new Map<string, number>()

export function PairingApp() {
  const appRef = useRef<HTMLDivElement>(null)
  const benchRef = useRef<BenchHandle>(null)
  const stackRef = useRef<string[]>([])
  const clearingRef = useRef(false)
  const noticeTimer = useRef<number | null>(null)
  const landingTimers = useRef<Map<string, number>>(new Map())
  const enteringTimers = useRef<Map<string, number>>(new Map())
  const nonce = useRef(0)

  const [stack, setStack] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [notice, setNotice] = useState<Notice | null>(null)
  const [flights, setFlights] = useState<FlightState[]>([])
  const [landingIds, setLandingIds] = useState<Set<string>>(new Set())
  const [enteringIds, setEnteringIds] = useState<Set<string>>(new Set())
  const [shakeNonce, setShakeNonce] = useState(0)
  const [testNonce, setTestNonce] = useState(0)
  const [clearing, setClearing] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetSession, setSheetSession] = useState(0)
  const [deckCollapsed, setDeckCollapsed] = useState(false)

  useEffect(() => {
    if (!import.meta.env.DEV) return
    const result = validateRulesData()
    if (!result.ok) {
      console.error('[pairing] rules data mismatch', result.errors)
    }
  }, [])

  const updateStack = useCallback((updater: (previous: string[]) => string[]) => {
    const next = updater(stackRef.current)
    stackRef.current = next
    setStack(next)
  }, [])

  const showNotice = useCallback((text: string, tone: NoticeTone = 'info') => {
    if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current)
    nonce.current += 1
    setNotice({ nonce: nonce.current, text, tone })
    noticeTimer.current = window.setTimeout(() => {
      setNotice(null)
      noticeTimer.current = null
    }, 1900)
  }, [])

  useEffect(() => {
    const landing = landingTimers.current
    const entering = enteringTimers.current
    return () => {
      if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current)
      for (const timer of landing.values()) window.clearTimeout(timer)
      for (const timer of entering.values()) window.clearTimeout(timer)
      landing.clear()
      entering.clear()
    }
  }, [])

  // 白瓷台面随列表下滚收起：只留五个小圆点吸顶，回滚即展开
  useEffect(() => {
    const scroller = appRef.current?.querySelector<HTMLElement>('.po-grid-scroll')
    if (!scroller) return

    let frame = 0
    const measure = () => {
      frame = 0
      const top = scroller.scrollTop
      setDeckCollapsed((previous) => (previous ? top > 16 : top > 48))
    }
    const onScroll = () => {
      if (frame === 0) frame = window.requestAnimationFrame(measure)
    }

    scroller.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      scroller.removeEventListener('scroll', onScroll)
      if (frame !== 0) window.cancelAnimationFrame(frame)
    }
  }, [])

  // 尺寸变化时先关掉过渡：所有尺寸都按 --u 重算，不需要补间，
  // 否则拖动窗口会把圆盘和台面拖成一段滞后的变形动画
  useEffect(() => {
    const app = appRef.current
    if (!app) return

    let timer = 0
    const observer = new ResizeObserver(() => {
      app.classList.add('is-resizing')
      window.clearTimeout(timer)
      timer = window.setTimeout(() => app.classList.remove('is-resizing'), 200)
    })
    observer.observe(app)

    return () => {
      observer.disconnect()
      window.clearTimeout(timer)
    }
  }, [])

  const stackItems = useMemo(
    () =>
      stack
        .map((id) => ITEM_BY_ID.get(id))
        .filter((item): item is PairingItem => item !== undefined),
    [stack],
  )

  const slotIndexById = useMemo(
    () => new Map(stack.map((id, index) => [id, index] as const)),
    [stack],
  )

  const matchedItems = useMemo(
    () => PAIRING_ITEMS.filter((item) => itemMatchesQuery(item, query)),
    [query],
  )

  const counts = useMemo(() => {
    const next = new Map<CategoryId, number>()
    for (const item of matchedItems) {
      next.set(item.categoryId, (next.get(item.categoryId) ?? 0) + 1)
    }
    return next
  }, [matchedItems])

  const availableCategories = useMemo(
    () => CATEGORIES.filter((entry) => (counts.get(entry.id) ?? 0) > 0),
    [counts],
  )

  const effectiveCategory: CategoryFilter =
    category !== 'all' && (counts.get(category) ?? 0) === 0 ? 'all' : category

  const handleQueryChange = useCallback(
    (value: string) => {
      setQuery(value)
      if (category !== 'all') {
        const keepsCategory = PAIRING_ITEMS.some(
          (item) => item.categoryId === category && itemMatchesQuery(item, value),
        )
        if (!keepsCategory) setCategory('all')
      }
    },
    [category],
  )

  const visibleItems = useMemo(
    () =>
      effectiveCategory === 'all'
        ? matchedItems
        : matchedItems.filter((item) => item.categoryId === effectiveCategory),
    [effectiveCategory, matchedItems],
  )

  const railEntries = useMemo<RailEntry[]>(
    () => [
      { id: 'all', label: '全部', count: matchedItems.length },
      ...availableCategories.map((entry) => ({
        id: entry.id,
        label: entry.shortName,
        count: counts.get(entry.id) ?? 0,
      })),
    ],
    [availableCategories, counts, matchedItems.length],
  )

  // 只有真正新加入的物品才播入场动画：移除中间项时后面的物品会跨槽位重挂 DOM，
  // 若无条件播动画，它们会像被重新放上托盘一样闪一下
  const markEntering = useCallback((id: string) => {
    setEnteringIds((previous) => {
      if (previous.has(id)) return previous
      const next = new Set(previous)
      next.add(id)
      return next
    })
    const existing = enteringTimers.current.get(id)
    if (existing !== undefined) window.clearTimeout(existing)
    const timer = window.setTimeout(() => {
      setEnteringIds((previous) => {
        if (!previous.has(id)) return previous
        const next = new Set(previous)
        next.delete(id)
        return next
      })
      enteringTimers.current.delete(id)
    }, 320)
    enteringTimers.current.set(id, timer)
  }, [])

  const removeItem = useCallback(
    (id: string) => {
      const timer = landingTimers.current.get(id)
      if (timer !== undefined) window.clearTimeout(timer)
      landingTimers.current.delete(id)
      const enteringTimer = enteringTimers.current.get(id)
      if (enteringTimer !== undefined) window.clearTimeout(enteringTimer)
      enteringTimers.current.delete(id)
      updateStack((previous) => previous.filter((itemId) => itemId !== id))
      setLandingIds((previous) => {
        if (!previous.has(id)) return previous
        const next = new Set(previous)
        next.delete(id)
        return next
      })
      setEnteringIds((previous) => {
        if (!previous.has(id)) return previous
        const next = new Set(previous)
        next.delete(id)
        return next
      })
      setFlights((previous) => previous.filter((flight) => flight.itemId !== id))
      haptic('remove')
    },
    [updateStack],
  )

  const requestRemove = useCallback(
    (id: string) => {
      if (clearingRef.current) return
      if (benchRef.current) {
        benchRef.current.exitItem(id)
        return
      }
      removeItem(id)
    },
    [removeItem],
  )

  const addItem = useCallback(
    (item: PairingItem, sourceEl: HTMLElement | null) => {
      if (clearingRef.current) return

      const current = stackRef.current
      if (current.includes(item.id)) {
        requestRemove(item.id)
        return
      }

      if (current.length >= MAX_SLOTS) {
        haptic('full')
        setShakeNonce((value) => value + 1)
        showNotice('台面已满 · 先移出一项再添加', 'warn')
        return
      }

      const slotIndex = current.length
      const app = appRef.current
      let flightStarted = false

      if (app && sourceEl && !prefersReducedMotion()) {
        const cell = app.querySelector<HTMLElement>(`[data-slot-cell="${slotIndex}"]`)
        const disc = cell?.querySelector<HTMLElement>('.po-slot-disc')
        if (cell && disc) {
          const appRect = app.getBoundingClientRect()
          const sourceRect = sourceEl.getBoundingClientRect()
          const targetRect = disc.getBoundingClientRect()
          if (sourceRect.width > 0 && targetRect.width > 0) {
            nonce.current += 1
            const flight: FlightState = {
              key: nonce.current,
              itemId: item.id,
              art: item.art,
              start: {
                x: sourceRect.left - appRect.left,
                y: sourceRect.top - appRect.top,
                w: sourceRect.width,
                h: sourceRect.height,
              },
              endX: targetRect.left - appRect.left + targetRect.width / 2,
              endY: targetRect.top - appRect.top + targetRect.height / 2,
              // 圆盘内药图占直径的 0.69，落点尺寸跟着圆盘走，收起时也不会跳
              endSize: targetRect.width * 0.69,
            }
            setFlights((previous) => [...previous, flight])
            flightStarted = true
          }
        }
      }

      updateStack((previous) => [...previous, item.id])
      markEntering(item.id)

      if (flightStarted) {
        setLandingIds((previous) => {
          const next = new Set(previous)
          next.add(item.id)
          return next
        })
        const existingTimer = landingTimers.current.get(item.id)
        if (existingTimer !== undefined) window.clearTimeout(existingTimer)
        const timer = window.setTimeout(() => {
          setLandingIds((previous) => {
            if (!previous.has(item.id)) return previous
            const next = new Set(previous)
            next.delete(item.id)
            return next
          })
          landingTimers.current.delete(item.id)
        }, 400)
        landingTimers.current.set(item.id, timer)
      }

      haptic(current.length + 1 === 2 ? 'ready' : 'add')
    },
    [markEntering, requestRemove, showNotice, updateStack],
  )

  const removeFlight = useCallback((key: number) => {
    setFlights((previous) => previous.filter((flight) => flight.key !== key))
  }, [])

  const finishClear = useCallback(() => {
    clearingRef.current = false
    setClearing(false)
    updateStack(() => [])
    setLandingIds(new Set())
    setEnteringIds(new Set())
    setFlights([])
    for (const timer of landingTimers.current.values()) window.clearTimeout(timer)
    landingTimers.current.clear()
    for (const timer of enteringTimers.current.values()) window.clearTimeout(timer)
    enteringTimers.current.clear()
  }, [updateStack])

  const clearStack = useCallback(() => {
    if (stackRef.current.length === 0 || clearingRef.current) return
    haptic('clear')
    clearingRef.current = true
    setClearing(true)
    if (benchRef.current) {
      benchRef.current.exitAll()
      return
    }
    finishClear()
  }, [finishClear])

  const handleTest = useCallback(() => {
    if (stackRef.current.length < 2 || clearingRef.current) return
    haptic('test')
    setTestNonce((value) => value + 1)
    setSheetSession((value) => value + 1)
    setSheetOpen(true)
  }, [])

  const closeSheet = useCallback(() => setSheetOpen(false), [])

  const count = stack.length
  const metaState =
    count === 0 ? '待挑选' : count === 1 ? '还差 1 项' : count >= MAX_SLOTS ? '已满' : '就绪'
  const hint =
    count === 0
      ? '从下方挑选需要一起使用的物品'
      : count === 1
        ? '再从下方添加 1 项即可检测'
        : count >= MAX_SLOTS
          ? '台面已满 · 轻点圆盘可移出'
          : '轻点圆盘可移出'

  return (
    <div className="pairing-app" ref={appRef}>
      <div className={cn('po-deck', deckCollapsed && 'is-collapsed')}>
        <StatusBar />

        <section
          className={cn(
            'po-hero',
            count >= 2 && 'is-ready',
            count >= MAX_SLOTS && 'is-full',
          )}
        >
          <span className="po-hero-glow po-hero-glow-cool" aria-hidden="true" />
          <HeroHeader />
          <Bench
            ref={benchRef}
            count={count}
            enteringIds={enteringIds}
            hint={hint}
            items={stackItems}
            landingIds={landingIds}
            metaState={metaState}
            notice={notice}
            onClear={finishClear}
            onRemove={removeItem}
            shakeNonce={shakeNonce}
            testNonce={testNonce}
          />
        </section>
      </div>

      <LibraryPanel
        activeCategory={effectiveCategory}
        items={visibleItems}
        onAdd={addItem}
        onCategoryChange={setCategory}
        onQueryChange={handleQueryChange}
        onShowAll={() => setCategory('all')}
        query={query}
        railEntries={railEntries}
        slotIndexById={clearing ? NO_SLOT_INDEX : slotIndexById}
      />

      <ControlDeck
        clearing={clearing}
        count={count}
        onClear={clearStack}
        onTest={handleTest}
      />

      <div className="po-home" aria-hidden="true">
        <span className="po-home-indicator" />
      </div>

      {sheetOpen && count >= 2 && (
        <ResultSheet items={stackItems} key={sheetSession} onClose={closeSheet} />
      )}

      <div className="po-flight-layer" aria-hidden="true">
        {flights.map((flight) => (
          <Flight flight={flight} key={flight.key} onDone={removeFlight} />
        ))}
      </div>
    </div>
  )
}