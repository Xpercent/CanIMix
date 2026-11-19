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
  const nonce = useRef(0)

  const [stack, setStack] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [notice, setNotice] = useState<Notice | null>(null)
  const [flights, setFlights] = useState<FlightState[]>([])
  const [landingIds, setLandingIds] = useState<Set<string>>(new Set())
  const [shakeNonce, setShakeNonce] = useState(0)
  const [testNonce, setTestNonce] = useState(0)
  const [clearing, setClearing] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetSession, setSheetSession] = useState(0)

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
    const timers = landingTimers.current
    return () => {
      if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current)
      for (const timer of timers.values()) window.clearTimeout(timer)
      timers.clear()
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

  const removeItem = useCallback(
    (id: string) => {
      const timer = landingTimers.current.get(id)
      if (timer !== undefined) window.clearTimeout(timer)
      landingTimers.current.delete(id)
      updateStack((previous) => previous.filter((itemId) => itemId !== id))
      setLandingIds((previous) => {
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
        showNotice('5 个槽位已满 · 先移出一项再装入', 'warn')
        return
      }

      const slotIndex = current.length
      const app = appRef.current
      let flightStarted = false

      if (app && sourceEl && !prefersReducedMotion()) {
        const cell = app.querySelector<HTMLElement>(`[data-slot-cell="${slotIndex}"]`)
        if (cell) {
          const appRect = app.getBoundingClientRect()
          const sourceRect = sourceEl.getBoundingClientRect()
          const targetRect = cell.getBoundingClientRect()
          if (sourceRect.width > 0 && targetRect.width > 0) {
            const ratio = appRect.width / 393
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
              endY: targetRect.top - appRect.top + targetRect.height * 0.477,
              endSize: 48 * ratio,
            }
            setFlights((previous) => [...previous, flight])
            flightStarted = true
          }
        }
      }

      updateStack((previous) => [...previous, item.id])

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
    [requestRemove, showNotice, updateStack],
  )

  const removeFlight = useCallback((key: number) => {
    setFlights((previous) => previous.filter((flight) => flight.key !== key))
  }, [])

  const finishClear = useCallback(() => {
    clearingRef.current = false
    setClearing(false)
    updateStack(() => [])
    setLandingIds(new Set())
    setFlights([])
    for (const timer of landingTimers.current.values()) window.clearTimeout(timer)
    landingTimers.current.clear()
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

  useEffect(() => {
    if (sheetOpen && stack.length < 2) setSheetOpen(false)
  }, [sheetOpen, stack.length])

  const count = stack.length
  const metaState =
    count === 0 ? '待装入' : count === 1 ? '还差 1 项' : count >= MAX_SLOTS ? '满栈' : '就绪'
  const hint =
    count === 0
      ? '从下方挑选需要一起使用的物品'
      : count === 1
        ? '再装入 1 项即可开始检测'
        : count >= MAX_SLOTS
          ? '台面已满 · 轻点任一槽位移出'
          : ''

  return (
    <div className="pairing-app" ref={appRef}>
      <StatusBar />

      <section
        className={cn(
          'po-hero',
          count >= 2 && 'is-ready',
          count >= MAX_SLOTS && 'is-full',
        )}
      >
        <span className="po-hero-glow po-hero-glow-cool" aria-hidden="true" />
        <span className="po-hero-glow po-hero-glow-warm" aria-hidden="true" />
        <HeroHeader />
        <Bench
          ref={benchRef}
          count={count}
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

      {sheetOpen && (
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