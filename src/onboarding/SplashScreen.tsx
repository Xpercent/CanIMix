import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { ArrowRight, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CATEGORIES, ITEM_BY_ID, PAIRING_ITEMS } from '@/components/pairing/pairing-data'
import { StatusBar } from '@/components/pairing/StatusBar'

interface OrbitItem {
  id: string
  x: string
  y: string
  delay: string
  scale?: number
}

const ORBIT_ITEMS: readonly OrbitItem[] = [
  { id: '999感冒灵颗粒', x: '0%', y: '5%', delay: '0s' },
  { id: '阿司匹林', x: '0%', y: '38%', delay: '-2.2s', scale: 0.97 },
  { id: '维生素C', x: '5%', y: '70%', delay: '-3.4s', scale: 0.95 },
  { id: '酒精饮品', x: '78%', y: '1%', delay: '-1.6s' },
  { id: '西柚', x: '80%', y: '36%', delay: '-3.1s', scale: 0.95 },
  { id: '咖啡', x: '70%', y: '68%', delay: '-4.4s', scale: 0.94 },
]

const PAIN_POINTS = [
  { pair: '感冒药 × 酒精', note: '嗜睡 · 呼吸抑制' },
  { pair: '降压药 × 西柚', note: '血压过低' },
  { pair: '钙片 × 抗生素', note: '药效打折' },
]

const FLOW_STEPS = [
  { index: '01', title: '挑两样', note: '药、食物或饮品' },
  { index: '02', title: '看结论', note: '风险分级说明' },
  { index: '03', title: '按建议', note: '错开时间服用' },
]

interface SplashScreenProps {
  onEnter: () => void
}

export function SplashScreen({ onEnter }: SplashScreenProps) {
  const [leaving, setLeaving] = useState(false)
  const timer = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
    }
  }, [])

  const enter = () => {
    if (leaving) return
    setLeaving(true)
    timer.current = window.setTimeout(onEnter, 460)
  }

  return (
    <section
      aria-label="同服检测介绍"
      className={cn('po-splash', leaving && 'is-leaving')}
    >
      <span className="po-splash-halo po-splash-halo-a" aria-hidden="true" />
      <span className="po-splash-halo po-splash-halo-b" aria-hidden="true" />
      <StatusBar />

      <div className="po-splash-body">
        <header className="po-splash-head">
          <p className="po-splash-eyebrow" style={{ '--d': '40ms' } as CSSProperties}>
            <span className="po-splash-glyph" aria-hidden="true">
              <svg fill="none" viewBox="0 0 12 12">
                <circle cx="6" cy="6" fill="currentColor" r="1.6" />
                <path
                  d="M6 .8v2.4M6 8.8v2.4M.8 6h2.4M8.8 6h2.4"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeWidth="1"
                />
              </svg>
            </span>
            SAFETY CHECK
            <span className="po-splash-eyebrow-dot">·</span>
            <span>同服检测</span>
            <span className="po-splash-eyebrow-dot">·</span>
            <span>2026 QODER</span>
          </p>
          <h1 className="po-splash-title" style={{ '--d': '110ms' } as CSSProperties}>
            一起吃，安全吗？
          </h1>
          <p className="po-splash-lede" style={{ '--d': '180ms' } as CSSProperties}>
            药、保健品、蔬果、饮品……随手同服也可能相互打架。
            <br />
            把任意两样放上台面，几秒看清该不该一起用。
          </p>
        </header>

        <div className="po-splash-orbit" aria-hidden="true" style={{ '--d': '240ms' } as CSSProperties}>
          <svg className="po-splash-orbit-path" viewBox="0 0 340 244">
            <ellipse
              cx="170"
              cy="122"
              fill="none"
              rx="150"
              ry="102"
              stroke="currentColor"
              strokeDasharray="2 7"
              strokeLinecap="round"
              strokeWidth="1"
            />
            <ellipse
              cx="170"
              cy="122"
              fill="none"
              opacity="0.55"
              rx="98"
              ry="66"
              stroke="currentColor"
              strokeDasharray="1 6"
              strokeLinecap="round"
              strokeWidth="1"
            />
          </svg>

          <div className="po-splash-core">
            <span className="po-splash-core-ring" />
            <span className="po-splash-core-ring po-splash-core-ring-b" />
            <span className="po-splash-core-disc">
              <ShieldCheck size={28} strokeWidth={1.7} />
            </span>
            <span className="po-splash-core-label">同服检测</span>
          </div>

          {ORBIT_ITEMS.map((entry) => {
            const art = ITEM_BY_ID.get(entry.id)?.art
            return (
              <span
                className="po-splash-orbit-item"
                key={entry.id}
                style={
                  {
                    left: entry.x,
                    top: entry.y,
                    '--delay': entry.delay,
                    '--scale': entry.scale ?? 1,
                  } as CSSProperties
                }
              >
                {art ? <img alt="" decoding="async" draggable={false} src={art} /> : null}
              </span>
            )
          })}

          <span className="po-splash-alert" style={{ left: '62%', top: '22%' }}>
            ?
          </span>
          <span className="po-splash-alert is-warn" style={{ left: '18%', top: '54%' }}>
            !
          </span>
        </div>

        <div className="po-splash-stats" style={{ '--d': '320ms' } as CSSProperties}>
          <div className="po-splash-stat">
            <b>{CATEGORIES.length}</b>
            <span>物品分类</span>
          </div>
          <span className="po-splash-stat-divider" aria-hidden="true" />
          <div className="po-splash-stat">
            <b>{PAIRING_ITEMS.length}</b>
            <span>常见物品</span>
          </div>
          <span className="po-splash-stat-divider" aria-hidden="true" />
          <div className="po-splash-stat">
            <b className="po-splash-stat-word">即时</b>
            <span>搭配检测</span>
          </div>
        </div>

        <div className="po-splash-pains" style={{ '--d': '400ms' } as CSSProperties}>
          <p className="po-splash-pains-title">常被忽略的组合</p>
          <ul>
            {PAIN_POINTS.map((point) => (
              <li key={point.pair}>
                <span className="po-splash-pain-dot" aria-hidden="true" />
                <span className="po-splash-pain-pair">{point.pair}</span>
                <span className="po-splash-pain-note">{point.note}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="po-splash-flow" style={{ '--d': '450ms' } as CSSProperties}>
          {FLOW_STEPS.map((flow, index) => (
            <div className="po-splash-flow-step" key={flow.index}>
              {index > 0 && <span className="po-splash-flow-link" aria-hidden="true" />}
              <span className="po-splash-flow-index">{flow.index}</span>
              <span className="po-splash-flow-copy">
                <b>{flow.title}</b>
                <span>{flow.note}</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      <footer className="po-splash-foot" style={{ '--d': '480ms' } as CSSProperties}>
        <button className="po-splash-cta" disabled={leaving} onClick={enter} type="button">
          <span className="po-splash-cta-sheen" aria-hidden="true" />
          <span>开始使用</span>
          <ArrowRight size={16} strokeWidth={2.1} aria-hidden="true" />
        </button>
        <p className="po-splash-note">约 30 秒 · 跟着卡片点几下就能上手</p>
      </footer>
    </section>
  )
}
