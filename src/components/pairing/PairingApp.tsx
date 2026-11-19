import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { ChevronRight, Plus, RotateCcw, X } from 'lucide-react'
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
import { haptic } from './haptics'
import { prefersReducedMotion } from './motion'

type NoticeTone = 'info' | 'warn'

interface Notice {
  nonce: number
  text: string
  tone: NoticeTone
}

interface Box {
  x: number
  y: number
  w: number
  h: number
}

interface FlightState {
  key: number
  itemId: string
  art: string
  start: Box
  endX: number
  endY: number
  endSize: number
}

const pad2 = (value: number) => String(value).padStart(2, '0')

export function PairingApp() {
  const appRef = useRef<HTMLDivElement>(null)
  const stackRef = useRef<string[]>([])
  const clearingRef = useRef(false)
  const noticeTimer = useRef<number | null>(null)
  const clearTimer = useRef<number | null>(null)
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
      if (clearTimer.current !== null) window.clearTimeout(clearTimer.current)
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

  const removeAt = useCallback(
    (index: number) => {
      if (clearingRef.current) return
      const removedId = stackRef.current[index]
      updateStack((previous) => previous.filter((_, itemIndex) => itemIndex !== index))
      if (removedId) {
        const timer = landingTimers.current.get(removedId)
        if (timer !== undefined) window.clearTimeout(timer)
        landingTimers.current.delete(removedId)
        setLandingIds((previous) => {
          if (!previous.has(removedId)) return previous
          const next = new Set(previous)
          next.delete(removedId)
          return next
        })
        setFlights((previous) => previous.filter((flight) => flight.itemId !== removedId))
      }
      haptic('remove')
    },
    [updateStack],
  )

  const addItem = useCallback(
    (item: PairingItem, sourceEl: HTMLElement | null) => {
      if (clearingRef.current) return

      const current = stackRef.current
      const existingIndex = current.indexOf(item.id)
      if (existingIndex >= 0) {
        removeAt(existingIndex)
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
    [removeAt, showNotice, updateStack],
  )

  const removeFlight = useCallback((key: number) => {
    setFlights((previous) => previous.filter((flight) => flight.key !== key))
  }, [])

  const clearStack = useCallback(() => {
    const current = stackRef.current
    if (current.length === 0 || clearingRef.current) return

    haptic('clear')
    clearingRef.current = true
    setClearing(true)
    const reduce = prefersReducedMotion()
    const app = appRef.current

    if (app && !reduce) {
      app.querySelectorAll<HTMLElement>('[data-slot-item]').forEach((element, index) => {
        element.animate(
          [
            { opacity: 1, transform: 'scale(1) translateY(0)' },
            { opacity: 0, transform: 'scale(.94) translateY(2px)' },
          ],
          {
            duration: 190,
            delay: index * 24,
            easing: 'ease-in',
            fill: 'forwards',
          },
        )
      })
    }

    const delay = reduce ? 0 : 190 + 24 * Math.max(0, current.length - 1)
    if (clearTimer.current !== null) window.clearTimeout(clearTimer.current)
    clearTimer.current = window.setTimeout(() => {
      clearTimer.current = null
      clearingRef.current = false
      setClearing(false)
      updateStack(() => [])
      setLandingIds(new Set())
      setFlights([])
      for (const timer of landingTimers.current.values()) window.clearTimeout(timer)
      landingTimers.current.clear()
    }, delay)
  }, [updateStack])

  const handleTest = useCallback(() => {
    if (stackRef.current.length < 2 || clearingRef.current) return
    haptic('test')
    setTestNonce((value) => value + 1)
  }, [])

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
          count={count}
          hint={hint}
          items={stackItems}
          landingIds={landingIds}
          metaState={metaState}
          notice={notice}
          onRemove={removeAt}
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
        slotIndexById={slotIndexById}
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

      <div className="po-flight-layer" aria-hidden="true">
        {flights.map((flight) => (
          <Flight flight={flight} key={flight.key} onDone={removeFlight} />
        ))}
      </div>
    </div>
  )
}

function StatusBar() {
  return (
    <div className="po-status" aria-hidden="true">
      <div className="po-status-zoom">
        <svg className="po-status-time" fill="none" viewBox="0 0 35 12">
          <path
            clipRule="evenodd"
            d="M4.2 0.5C6.65 0.5 8 2.4 8 6C8 9.6 6.65 11.5 4.2 11.5C1.75 11.5 0.4 9.6 0.4 6C0.4 2.4 1.75 0.5 4.2 0.5ZM4.2 2.1C2.95 2.1 2.25 3.45 2.25 6C2.25 8.55 2.95 9.9 4.2 9.9C5.45 9.9 6.15 8.55 6.15 6C6.15 3.45 5.45 2.1 4.2 2.1Z"
            fill="currentColor"
            fillRule="evenodd"
          />
          <path
            clipRule="evenodd"
            d="M13 0.5C15.4 0.5 16.8 2.3 16.8 5.5C16.8 9.2 15.3 11.5 12.85 11.5C10.9 11.5 9.75 10.45 9.55 8.95H11.35C11.55 9.65 12.1 10 12.85 10C14.1 10 14.95 8.9 14.95 6.75C14.35 7.45 13.5 7.75 12.6 7.75C10.6 7.75 9.3 6.25 9.3 4.15C9.3 1.95 10.8 0.5 13 0.5ZM13 2C11.85 2 11.1 2.85 11.1 4.08C11.1 5.3 11.85 6.15 13 6.15C14.15 6.15 14.95 5.3 14.95 4.08C14.95 2.85 14.15 2 13 2Z"
            fill="currentColor"
            fillRule="evenodd"
          />
          <circle cx="19" cy="3.6" fill="currentColor" r="1.05" />
          <circle cx="19" cy="8.4" fill="currentColor" r="1.05" />
          <path
            clipRule="evenodd"
            d="M25.45 0.7H27.65V7.6H29.1V9.25H27.65V11.3H25.8V9.25H21V7.6L25.45 0.7ZM25.8 3.38L23.08 7.6H25.8V3.38Z"
            fill="currentColor"
            fillRule="evenodd"
          />
          <path
            d="M32.3 0.7H34.2V11.3H32.3V2.55L29.8 4.15V2.45L32.3 0.7Z"
            fill="currentColor"
          />
        </svg>
        <span className="po-status-icons">
          <svg fill="none" viewBox="0 0 18 12">
            <rect fill="currentColor" height="4.5" rx="1" width="3" x="0" y="7.5" />
            <rect fill="currentColor" height="6.5" rx="1" width="3" x="5" y="5.5" />
            <rect fill="currentColor" height="9" rx="1" width="3" x="10" y="3" />
            <rect fill="currentColor" height="12" rx="1" width="3" x="15" y="0" />
          </svg>
          <svg fill="none" viewBox="0 0 17 12">
            <path
              d="M0.58 3.58A11.2 11.2 0 0 1 16.42 3.58L14.86 5.14A9 9 0 0 0 2.14 5.14Z"
              fill="currentColor"
            />
            <path
              d="M3.48 6.48A7.1 7.1 0 0 1 13.52 6.48L11.96 8.04A4.9 4.9 0 0 0 5.04 8.04Z"
              fill="currentColor"
            />
            <path
              d="M6.38 9.38A3 3 0 0 1 10.62 9.38L8.75 11.25Q8.5 11.5 8.25 11.25Z"
              fill="currentColor"
            />
          </svg>
          <svg className="po-status-battery" fill="none" viewBox="0 0 25 12">
            <rect
              height="11"
              rx="2.8"
              stroke="currentColor"
              strokeOpacity="0.35"
              strokeWidth="1"
              width="21"
              x="0.5"
              y="0.5"
            />
            <rect fill="currentColor" height="8" rx="1.5" width="18" x="2" y="2" />
            <path d="M23 4A1.4 2 0 0 1 23 8Z" fill="currentColor" fillOpacity="0.4" />
          </svg>
        </span>
      </div>
    </div>
  )
}

function HeroHeader() {
  return (
    <header className="po-hero-head">
      <div className="po-eyebrow">
        <svg className="po-brand-glyph" fill="none" viewBox="0 0 12 12" aria-hidden="true">
          <circle cx="6" cy="6" r="1.5" fill="currentColor" />
          <path
            d="M6 .8v2.4M6 8.8v2.4M.8 6h2.4M8.8 6h2.4"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="1"
          />
        </svg>
        <span>PAIRING BENCH</span>
        <span className="po-eyebrow-divider">·</span>
        <span>配伍检测</span>
      </div>
      <div className="po-title-row">
        <h1 className="po-title">能一起用吗？</h1>
      </div>
    </header>
  )
}

interface BenchProps {
  items: PairingItem[]
  count: number
  metaState: string
  hint: string
  notice: Notice | null
  landingIds: Set<string>
  shakeNonce: number
  testNonce: number
  onRemove: (index: number) => void
}

function Bench({
  items,
  count,
  metaState,
  hint,
  notice,
  landingIds,
  shakeNonce,
  testNonce,
  onRemove,
}: BenchProps) {
  const rowRef = useRef<HTMLDivElement>(null)
  const flareRef = useRef<HTMLSpanElement>(null)
  const beforeRects = useRef<Map<string, DOMRect>>(new Map())
  const signature = items.map((item) => item.id).join('|')

  const handleRemove = (index: number, id: string) => {
    const row = rowRef.current
    if (!row) {
      onRemove(index)
      return
    }

    const cards = Array.from(row.querySelectorAll<HTMLElement>('[data-slot-item]'))
    const snapshot = new Map(
      cards.map((card) => [card.dataset.slotItem ?? '', card.getBoundingClientRect()] as const),
    )
    const card = row.querySelector<HTMLElement>(`[data-slot-item="${id}"]`)

    if (card && !prefersReducedMotion()) {
      const animation = card.animate(
        [
          { opacity: 1, transform: 'scale(1)' },
          { opacity: 0, transform: 'scale(.94)' },
        ],
        { duration: 110, easing: 'ease-in', fill: 'forwards' },
      )
      animation.onfinish = () => {
        beforeRects.current = snapshot
        onRemove(index)
      }
    } else {
      beforeRects.current = snapshot
      onRemove(index)
    }
  }

  useLayoutEffect(() => {
    const row = rowRef.current
    const previous = beforeRects.current
    if (!row || previous.size === 0) return
    beforeRects.current = new Map()
    if (prefersReducedMotion()) return

    const cards = Array.from(row.querySelectorAll<HTMLElement>('[data-slot-item]'))
    for (const card of cards) {
      const id = card.dataset.slotItem
      const oldRect = id ? previous.get(id) : undefined
      if (!oldRect) continue
      const newRect = card.getBoundingClientRect()
      const deltaX = oldRect.left - newRect.left
      const deltaY = oldRect.top - newRect.top
      if (Math.abs(deltaX) > 0.5 || Math.abs(deltaY) > 0.5) {
        card.animate(
          [
            { transform: `translate(${deltaX}px, ${deltaY}px)` },
            { transform: 'translate(0px, 0px)' },
          ],
          { duration: 360, easing: 'cubic-bezier(.22,1.02,.36,1)' },
        )
      }
    }
  }, [signature])

  useEffect(() => {
    if (!shakeNonce) return
    const row = rowRef.current
    if (!row || prefersReducedMotion()) return
    row.animate(
      [
        { transform: 'translateX(0)' },
        { transform: 'translateX(-2.5px)' },
        { transform: 'translateX(2.5px)' },
        { transform: 'translateX(-1.5px)' },
        { transform: 'translateX(0)' },
      ],
      { duration: 360, easing: 'ease-out' },
    )
  }, [shakeNonce])

  useEffect(() => {
    if (!testNonce) return
    const flare = flareRef.current
    if (!flare || prefersReducedMotion()) return
    flare.animate(
      [
        { opacity: 0, transform: 'scale(.92)' },
        { opacity: 0.5, offset: 0.35 },
        { opacity: 0, transform: 'scale(1.04)' },
      ],
      { duration: 800, easing: 'ease-out' },
    )
  }, [testNonce])

  return (
    <section className="po-bench" aria-label="检测托盘">
      <span className="po-bench-flare" ref={flareRef} aria-hidden="true" />
      <div className="po-bench-meta">
        <span className="po-bench-id">
          <svg className="po-crosshair" fill="none" viewBox="0 0 12 12" aria-hidden="true">
            <circle cx="6" cy="6" r="3.4" stroke="currentColor" strokeWidth=".9" />
            <circle cx="6" cy="6" r=".9" fill="currentColor" />
            <path
              d="M6 .7v2.1M6 9.2v2.1M.7 6h2.1M9.2 6h2.1"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth=".9"
            />
          </svg>
          检测托盘
        </span>
        <span
          className={cn(
            'po-bench-status',
            count >= 2 && 'is-ready',
            count >= MAX_SLOTS && 'is-full',
          )}
        >
          <span className="po-count">
            <span className="po-count-num" key={count}>
              {count}
            </span>
            <span className="po-count-total">/5</span>
          </span>
          <span className="po-status-dot" aria-hidden="true" />
          <span className="po-state-label" key={metaState}>
            {metaState}
          </span>
        </span>
      </div>

      <div className="po-slot-rail" ref={rowRef}>
        {Array.from({ length: MAX_SLOTS }, (_, index) => {
          const item = items[index]
          return (
            <div
              className="po-slot-cell"
              data-slot-cell={index}
              data-slot-index={index}
              key={index}
            >
              {item ? (
                <button
                  type="button"
                  aria-label={`移出 ${item.name}，第 ${index + 1} 位`}
                  className={cn('po-slot-card', landingIds.has(item.id) && 'is-landing')}
                  data-slot-item={item.id}
                  key={item.id}
                  onClick={() => handleRemove(index, item.id)}
                  title="轻点移出"
                >
                  <span className="po-slot-ordinal">{pad2(index + 1)}</span>
                  <span className="po-slot-halo" aria-hidden="true">
                    <img
                      alt=""
                      className="po-slot-art"
                      decoding="async"
                      draggable={false}
                      src={item.art}
                    />
                  </span>
                  <span className="po-slot-name">{item.shortName}</span>
                  <span className="po-slot-x" aria-hidden="true">
                    <X size={8} strokeWidth={2.4} />
                  </span>
                </button>
              ) : (
                <div
                  className={cn('po-slot-empty', index === count && 'is-next')}
                  aria-hidden="true"
                >
                  <span className="po-slot-ordinal">{pad2(index + 1)}</span>
                  {index === count && (
                    <Plus className="po-slot-plus" size={12} strokeWidth={1.5} />
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="po-bench-hint">
        {notice ? (
          <span
            className={cn('po-notice', notice.tone === 'warn' && 'is-warn')}
            key={notice.nonce}
          >
            {notice.text}
          </span>
        ) : (
          <span className="po-hint-default" key={`${count}-${hint}`}>
            {hint}
          </span>
        )}
      </div>
      <span className="po-sr-only" aria-live="polite">
        {`${count} / 5，${metaState}。${notice?.text ?? hint}`}
      </span>
    </section>
  )
}

function ControlDeck({
  count,
  clearing,
  onClear,
  onTest,
}: {
  count: number
  clearing: boolean
  onClear: () => void
  onTest: () => void
}) {
  const canTest = count >= 2 && !clearing
  const hinting = count === 1

  return (
    <div className="po-console">
      <button
        type="button"
        aria-label="清空检测台"
        className="po-clear"
        disabled={count === 0 || clearing}
        onClick={onClear}
      >
        <RotateCcw size={13} strokeWidth={1.9} aria-hidden="true" />
        <span>清空</span>
      </button>

      <button
        type="button"
        aria-label={
          canTest ? `开始检测，共 ${count} 项` : '至少选择 2 项后才能检测'
        }
        className={cn('po-test', canTest && 'is-active', hinting && 'is-hinting')}
        disabled={!canTest}
        onClick={onTest}
      >
        <span className="po-test-sheen" aria-hidden="true" />
        <span className="po-test-label">
          {hinting ? '再选 1 项开始检测' : '开始检测'}
        </span>
        <span className="po-test-count" aria-hidden="true">
          {count} 项
        </span>
        <ChevronRight className="po-test-chevron" size={14} strokeWidth={2.2} aria-hidden="true" />
      </button>
    </div>
  )
}

function Flight({
  flight,
  onDone,
}: {
  flight: FlightState
  onDone: (key: number) => void
}) {
  const imageRef = useRef<HTMLImageElement>(null)

  useLayoutEffect(() => {
    const element = imageRef.current
    if (!element) {
      onDone(flight.key)
      return
    }

    const scale = Math.max(0.1, flight.endSize / flight.start.w)
    const deltaX = flight.endX - flight.start.x - (flight.start.w * scale) / 2
    const deltaY = flight.endY - flight.start.y - (flight.start.h * scale) / 2
    const midX = deltaX * 0.55
    const midY = deltaY * 0.55 - 18

    const animation = element.animate(
      [
        { opacity: 1, transform: 'translate(0px, 0px) scale(1)' },
        {
          opacity: 1,
          offset: 0.55,
          transform: `translate(${midX}px, ${midY}px) scale(1.07)`,
        },
        {
          opacity: 1,
          transform: `translate(${deltaX}px, ${deltaY}px) scale(${scale})`,
        },
      ],
      {
        duration: 430,
        easing: 'cubic-bezier(.2,.8,.2,1)',
        fill: 'forwards',
      },
    )

    let finished = false
    const finish = () => {
      if (finished) return
      finished = true
      onDone(flight.key)
    }
    const fallback = window.setTimeout(finish, 540)
    animation.onfinish = finish

    return () => {
      animation.cancel()
      window.clearTimeout(fallback)
    }
  }, [flight, onDone])

  return (
    <img
      ref={imageRef}
      alt=""
      className="po-flight"
      draggable={false}
      src={flight.art}
      style={{
        height: flight.start.h,
        left: flight.start.x,
        top: flight.start.y,
        width: flight.start.w,
      }}
    />
  )
}