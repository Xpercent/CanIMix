import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
} from 'react'
import { ChevronDown, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  CATEGORIES,
  type CategoryFilter,
  type PairingItem,
} from './pairing-data'
import { prefersReducedMotion } from './motion'
import { useScrollMask } from './use-scroll-mask'

export interface RailEntry {
  id: CategoryFilter
  label: string
  count: number
}

interface LibraryPanelProps {
  items: PairingItem[]
  query: string
  onQueryChange: (value: string) => void
  activeCategory: CategoryFilter
  onCategoryChange: (value: CategoryFilter) => void
  onShowAll: () => void
  railEntries: RailEntry[]
  slotIndexById: Map<string, number>
  onAdd: (item: PairingItem, source: HTMLElement | null) => void
}

export function LibraryPanel({
  items,
  query,
  onQueryChange,
  activeCategory,
  onCategoryChange,
  onShowAll,
  railEntries,
  slotIndexById,
  onAdd,
}: LibraryPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const railScrollRef = useRef<HTMLDivElement>(null)
  const gridScrollRef = useRef<HTMLDivElement>(null)
  const [focused, setFocused] = useState(false)
  const [pill, setPill] = useState<{ top: number; height: number; needleTop: number } | null>(null)

  const railKey = railEntries.map((entry) => `${entry.id}:${entry.count}`).join('|')
  useScrollMask(railScrollRef, railKey)
  useScrollMask(gridScrollRef, `${items.length}:${activeCategory}:${query}`)

  useLayoutEffect(() => {
    const container = railScrollRef.current
    const button = container?.querySelector<HTMLElement>(`[data-rail-id="${activeCategory}"]`)
    if (!container || !button) return

    const measure = () => {
      const scale = button.getBoundingClientRect().width / 74 || 1
      const top = button.offsetTop + 2 * scale
      const height = button.offsetHeight - 4 * scale
      setPill({ top, height, needleTop: top + height / 2 - 8 * scale })
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(container)
    return () => observer.disconnect()
  }, [activeCategory, railKey])

  useEffect(() => {
    const container = railScrollRef.current
    const button = container?.querySelector<HTMLElement>(`[data-rail-id="${activeCategory}"]`)
    if (!container || !button) return

    const topEdge = button.offsetTop
    const bottomEdge = topEdge + button.offsetHeight
    const visibleTop = container.scrollTop
    const visibleBottom = visibleTop + container.clientHeight
    if (topEdge < visibleTop + 4 || bottomEdge > visibleBottom - 4) {
      container.scrollTo({
        top: Math.max(0, topEdge - (container.clientHeight - button.offsetHeight) / 2),
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      })
    }
  }, [activeCategory, railKey])

  const showQuery = query.trim().length > 0
  const sectionMode = activeCategory === 'all' && items.length >= 24
  const sections = sectionMode
    ? CATEGORIES.map((category) => ({
        category,
        items: items.filter((item) => item.categoryId === category.id),
      })).filter((section) => section.items.length > 0)
    : []

  const clearSearch = () => {
    onQueryChange('')
    inputRef.current?.focus()
  }

  const dismissKeyboard = () => {
    inputRef.current?.blur()
  }

  const handleCardAdd = useCallback(
    (item: PairingItem, event: MouseEvent<HTMLButtonElement>) => {
      onAdd(item, event.currentTarget.querySelector('img'))
    },
    [onAdd],
  )

  const renderCard = (item: PairingItem, index: number) => (
    <ItemCard
      index={index}
      item={item}
      key={item.id}
      onAdd={handleCardAdd}
      query={query}
      slotIndex={slotIndexById.get(item.id)}
    />
  )

  return (
    <section className="po-library" aria-label="物品资产库">
      <div className={cn('po-search', focused && 'is-focused')}>
        <Search className="po-search-icon" size={14} strokeWidth={1.8} aria-hidden="true" />
        <input
          ref={inputRef}
          aria-label="搜索药品、食物或饮品，支持拼音"
          autoComplete="off"
          className="po-search-input"
          enterKeyHint="search"
          inputMode="search"
          onBlur={() => setFocused(false)}
          onChange={(event) => onQueryChange(event.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') dismissKeyboard()
          }}
          placeholder="搜索药品、食物或饮品（拼音）"
          spellCheck={false}
          type="search"
          value={query}
        />
        <div className="po-search-actions">
          <span className="po-search-count" aria-hidden="true">
            {items.length} 项
          </span>
          {showQuery && (
            <button
              type="button"
              aria-label="清除搜索"
              className="po-search-clear"
              onClick={clearSearch}
              onPointerDown={(event) => event.preventDefault()}
            >
              <X size={10} strokeWidth={2.2} aria-hidden="true" />
            </button>
          )}
          {focused && (
            <button
              type="button"
              aria-label="收起键盘"
              className="po-search-dismiss"
              onClick={dismissKeyboard}
              onPointerDown={(event) => {
                event.preventDefault()
                dismissKeyboard()
              }}
            >
              <ChevronDown size={12} strokeWidth={2} aria-hidden="true" />
            </button>
          )}
        </div>
        <span className="po-sr-only" role="status" aria-live="polite">
          {showQuery ? `找到 ${items.length} 项` : ''}
        </span>
      </div>

      <div className="po-library-body">
        <nav className="po-rail" aria-label="物品分类">
          <div className="po-rail-scroll" ref={railScrollRef}>
            <div className="po-rail-track">
              {pill && (
                <>
                  <span
                    className="po-rail-pill"
                    aria-hidden="true"
                    style={{ height: pill.height, transform: `translateY(${pill.top}px)` }}
                  />
                  <span
                    className="po-rail-needle"
                    aria-hidden="true"
                    style={{ transform: `translateY(${pill.needleTop}px)` }}
                  />
                </>
              )}
              {railEntries.map((entry) => {
                const active = activeCategory === entry.id
                return (
                  <button
                    key={entry.id}
                    type="button"
                    aria-label={`${entry.label}，${entry.count} 项`}
                    aria-pressed={active}
                    className={cn('po-rail-item', active && 'is-active')}
                    data-rail-id={entry.id}
                    onClick={() => {
                      dismissKeyboard()
                      onCategoryChange(entry.id)
                    }}
                  >
                    <span className="po-rail-label">{entry.label}</span>
                    <span className="po-rail-count">{entry.count}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </nav>

        <div
          className="po-grid-scroll"
          ref={gridScrollRef}
          onPointerDown={() => {
            if (document.activeElement === inputRef.current) inputRef.current?.blur()
          }}
        >
          {items.length > 0 &&
            (sectionMode ? (
              sections.map((section) => (
                <section className="po-grid-section" key={section.category.id}>
                  <h3 className="po-grid-section-head">
                    <span>{section.category.shortName}</span>
                    <span className="po-grid-section-count">{section.items.length}</span>
                  </h3>
                  <div className="po-grid">
                    {section.items.map((item, index) => renderCard(item, index))}
                  </div>
                </section>
              ))
            ) : (
              <div className="po-grid">
                {items.map((item, index) => renderCard(item, index))}
                {activeCategory !== 'all' && items.length < 3 && (
                  <button type="button" className="po-sparse-note" onClick={onShowAll}>
                    <span>此分类仅 {items.length} 项 · </span>
                    <span className="po-sparse-action">查看全部</span>
                  </button>
                )}
              </div>
            ))}
        </div>

        {items.length === 0 && (
          <div className="po-empty-overlay">
            <GridEmpty
              hasCategoryEntries={railEntries.some((entry) => entry.id !== 'all')}
              onClear={clearSearch}
              onShowAll={onShowAll}
              query={query}
            />
          </div>
        )}
      </div>
    </section>
  )
}

interface ItemCardProps {
  item: PairingItem
  query: string
  slotIndex?: number
  index: number
  onAdd: (item: PairingItem, event: MouseEvent<HTMLButtonElement>) => void
}

function useSlotBadge(slotNumber: number | null) {
  const [state, setState] = useState({
    number: slotNumber,
    mounted: slotNumber !== null,
    exiting: false,
  })

  if (slotNumber !== null) {
    if (!state.mounted || state.number !== slotNumber || state.exiting) {
      setState({ number: slotNumber, mounted: true, exiting: false })
    }
  } else if (state.mounted && !state.exiting) {
    setState({ ...state, exiting: true })
  }

  const finishExit = () => {
    setState((current) =>
      current.exiting ? { number: null, mounted: false, exiting: false } : current,
    )
  }

  return { ...state, finishExit }
}

const ItemCard = memo(function ItemCard({
  item,
  query,
  slotIndex,
  index,
  onAdd,
}: ItemCardProps) {
  const slotNumber = slotIndex === undefined ? null : slotIndex + 1
  const selected = slotNumber !== null
  const badge = useSlotBadge(slotNumber)
  const style = { '--i': Math.min(index, 8) } as CSSProperties

  return (
    <button
      type="button"
      aria-label={
        selected
          ? `${item.name}，已放入检测台，第 ${slotNumber} 位，再次点击移出`
          : `将 ${item.name} 放入检测台`
      }
      className={cn('po-item-card', selected && 'is-stacked')}
      data-selected={selected || undefined}
      onClick={(event) => onAdd(item, event)}
      style={style}
    >
      <span className="po-item-halo">
        <img
          alt=""
          className="po-item-art"
          decoding="async"
          draggable={false}
          loading="lazy"
          src={item.art}
        />
      </span>
      <span className="po-item-name">
        <HighlightedName query={query} text={item.displayName} />
      </span>
      {badge.mounted && badge.number !== null && (
        <svg
          className={cn('po-item-badge', badge.exiting && 'is-exiting')}
          viewBox="0 0 22 22"
          aria-hidden="true"
          onAnimationEnd={(event) => {
            if (event.animationName === 'po-badge-out' && slotNumber === null) {
              badge.finishExit()
            }
          }}
        >
          <circle className="po-item-badge-ring" cx="11" cy="11" r="11" />
          <circle className="po-item-badge-disc" cx="11" cy="11" r="9" />
          <text className="po-item-badge-num" dominantBaseline="central" textAnchor="middle" x="10.7" y="10.5">{String(badge.number).padStart(2, '0')}</text>
        </svg>
      )}
    </button>
  )
})

function HighlightedName({ text, query }: { text: string; query: string }) {
  const needle = query.trim()
  if (!needle) return <>{text}</>

  const index = text.toLocaleLowerCase('zh-CN').indexOf(needle.toLocaleLowerCase('zh-CN'))
  if (index < 0) return <>{text}</>

  return (
    <>
      {text.slice(0, index)}
      <mark>{text.slice(index, index + needle.length)}</mark>
      {text.slice(index + needle.length)}
    </>
  )
}

function GridEmpty({
  query,
  onClear,
  onShowAll,
  hasCategoryEntries,
}: {
  query: string
  onClear: () => void
  onShowAll: () => void
  hasCategoryEntries: boolean
}) {
  const searching = query.trim().length > 0
  const shown = query.trim().length > 10 ? `${query.trim().slice(0, 10)}…` : query.trim()

  return (
    <div className="po-grid-empty">
      <div className="po-empty-lens" aria-hidden="true">
        <span className="po-lens-ring po-lens-ring-outer" />
        <span className="po-lens-ring po-lens-ring-mid" />
        <span className="po-lens-ring po-lens-ring-inner" />
        <span className="po-lens-core" />
      </div>
      <p className="po-empty-title">
        {searching ? `没有找到「${shown}」` : '这个分类还没有物品'}
      </p>
      <p className="po-empty-sub">
        {searching
          ? hasCategoryEntries
            ? '试试更短的词，或浏览左侧分类'
            : '试试更短的词，或清除搜索后浏览全部物品'
          : '先看看全部物品吧'}
      </p>
      <button
        type="button"
        className="po-empty-action"
        onClick={searching ? onClear : onShowAll}
      >
        {searching ? '清除搜索' : '查看全部'}
      </button>
    </div>
  )
}