import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { ShieldCheck } from 'lucide-react'
import { Iphone } from '@/components/ui/iphone'
import { PairingApp, type PairingAppHandle } from '@/components/pairing/PairingApp'
import { CATEGORIES, ITEM_BY_ID, PAIRING_ITEMS } from '@/components/pairing/pairing-data'
import type { PairingTourEvent } from '@/components/pairing/types'
import '@/components/pairing/pairing.css'
import { cn } from '@/lib/utils'
import {
  GUIDE_MASTER_ENABLED,
  persistGuideEnabled,
  readGuideEnabled,
} from '@/onboarding/config'
import { SplashScreen } from '@/onboarding/SplashScreen'
import { TourLayer } from '@/onboarding/TourLayer'
import { DEMO_ITEMS, TOUR_STEPS } from '@/onboarding/tour-steps'
import '@/onboarding/onboarding.css'

interface StageSpecimen {
  id: string
  x: string
  y: string
  size: number
  delay: string
  rotate: number
  /** 靠近手机的标本，窄屏引导卡片会压住，直接收起 */
  inner?: boolean
}

const STAGE_SPECIMENS: readonly StageSpecimen[] = [
  { id: '999感冒灵颗粒', x: '10%', y: '23%', size: 78, delay: '0s', rotate: -7 },
  { id: '西柚', x: '15%', y: '74%', size: 94, delay: '-3.6s', rotate: 6 },
  { id: '咖啡', x: '88%', y: '20%', size: 86, delay: '-1.9s', rotate: 5 },
  { id: '维生素C', x: '85%', y: '75%', size: 72, delay: '-4.8s', rotate: -6 },
  { id: '阿司匹林', x: '23%', y: '46%', size: 62, delay: '-2.6s', rotate: 4, inner: true },
  { id: '钙片', x: '77%', y: '48%', size: 60, delay: '-5.4s', rotate: -5, inner: true },
]

function App() {
  const stageRef = useRef<HTMLElement>(null)
  const phoneRef = useRef<HTMLDivElement>(null)
  const pairingRef = useRef<PairingAppHandle>(null)

  const [guideEnabled, setGuideEnabled] = useState(readGuideEnabled)
  const [phase, setPhase] = useState<'splash' | 'app'>(() =>
    readGuideEnabled() ? 'splash' : 'app',
  )
  const [appSession, setAppSession] = useState(0)
  const [tourIndex, setTourIndex] = useState(-1)
  const [nudge, setNudge] = useState<{ text: string; nonce: number } | null>(null)

  const stepRef = useRef(-1)
  const nudgeTimer = useRef<number | null>(null)
  const nudgeNonce = useRef(0)

  useEffect(() => {
    stepRef.current = tourIndex
  }, [tourIndex])

  useEffect(() => {
    return () => {
      if (nudgeTimer.current !== null) window.clearTimeout(nudgeTimer.current)
    }
  }, [])

  const showNudge = useCallback((text: string) => {
    nudgeNonce.current += 1
    setNudge({ text, nonce: nudgeNonce.current })
    if (nudgeTimer.current !== null) window.clearTimeout(nudgeTimer.current)
    nudgeTimer.current = window.setTimeout(() => {
      setNudge(null)
      nudgeTimer.current = null
    }, 2600)
  }, [])

  const clearNudge = useCallback(() => {
    if (nudgeTimer.current !== null) window.clearTimeout(nudgeTimer.current)
    nudgeTimer.current = null
    setNudge(null)
  }, [])

  const handleTourEvent = useCallback(
    (event: PairingTourEvent) => {
      const index = stepRef.current
      if (index < 0) return
      const step = TOUR_STEPS[index]
      if (!step) return

      // 评委如果提前点开了检测结果，直接切到结果讲解，避免卡片还停在“去点开始检测”
      if (event.type === 'sheet-open' && step.id !== 'read-result') {
        const resultIndex = TOUR_STEPS.findIndex((entry) => entry.id === 'read-result')
        if (resultIndex > index) {
          clearNudge()
          setTourIndex(resultIndex)
          return
        }
      }

      if (step.accepts(event)) {
        clearNudge()
        if (step.endOnAccept) {
          setTourIndex(-1)
          return
        }
        if (TOUR_STEPS[index + 1]?.id === 'demo-stage') {
          pairingRef.current?.setCategory('digestive')
          pairingRef.current?.stageItems(DEMO_ITEMS)
        }
        setTourIndex(index + 1)
        return
      }

      const message = step.nudge?.(event)
      if (message) showNudge(message)
    },
    [clearNudge, showNudge],
  )

  const startApp = useCallback(() => {
    setPhase('app')
    setTourIndex(0)
  }, [])

  const finishTour = useCallback(() => {
    clearNudge()
    setTourIndex(-1)
  }, [clearNudge])

  const replayGuide = useCallback(() => {
    clearNudge()
    setAppSession((value) => value + 1)
    setPhase('splash')
    setTourIndex(-1)
  }, [clearNudge])

  const toggleGuide = useCallback(() => {
    const next = !guideEnabled
    setGuideEnabled(next)
    persistGuideEnabled(next)
    clearNudge()
    if (next) {
      setAppSession((value) => value + 1)
      setPhase('splash')
      setTourIndex(-1)
    } else {
      setPhase('app')
      setTourIndex(-1)
    }
  }, [clearNudge, guideEnabled])

  const activeStep = tourIndex >= 0 ? TOUR_STEPS[tourIndex] ?? null : null

  return (
    <main className={cn('po-stage', activeStep && 'is-touring')} ref={stageRef}>
      <div aria-hidden="true" className="po-backdrop">
        <span className="po-backdrop-aurora po-backdrop-aurora-a" />
        <span className="po-backdrop-aurora po-backdrop-aurora-b" />
        <span className="po-backdrop-grid" />
        <span className="po-backdrop-rings">
          <span className="po-backdrop-ring po-backdrop-ring-a" />
          <span className="po-backdrop-ring po-backdrop-ring-b" />
          <span className="po-backdrop-ring po-backdrop-ring-c" />
          <span className="po-backdrop-orbit" />
        </span>
        {STAGE_SPECIMENS.map((specimen) => (
          <span
            className={cn('po-backdrop-specimen', specimen.inner && 'is-inner')}
            key={specimen.id}
            style={
              {
                left: specimen.x,
                top: specimen.y,
                '--s': `${specimen.size}px`,
                '--delay': specimen.delay,
                '--rot': `${specimen.rotate}deg`,
              } as CSSProperties
            }
          >
            <img
              alt=""
              decoding="async"
              draggable={false}
              src={ITEM_BY_ID.get(specimen.id)?.art}
            />
          </span>
        ))}
        <span className="po-backdrop-alert is-warn" style={{ left: '20%', top: '66%' }}>
          !
        </span>
        <span className="po-backdrop-alert" style={{ left: '83.5%', top: '25.8%' }}>
          ?
        </span>
        <span className="po-backdrop-spine">同服检测</span>
        <span className="po-backdrop-spine po-backdrop-spine-en">
          DRUG × FOOD × SUPPLEMENT
        </span>
        <span className="po-backdrop-grain" />
      </div>

      <div className="po-phone-holder" ref={phoneRef}>
        <Iphone className="po-phone h-[min(calc(100svh-3rem),calc((100vw-3rem)/0.492))] w-auto max-w-none [--border:oklch(0.34_0_0)] [--card:oklch(0.18_0_0)]">
          <div className="po-viewport">
            <PairingApp
              key={appSession}
              onTourEvent={handleTourEvent}
              ref={pairingRef}
            />
            {guideEnabled && phase === 'splash' && <SplashScreen onEnter={startApp} />}
          </div>
        </Iphone>
      </div>

      {activeStep && (
        <TourLayer
          key={activeStep.id}
          nudge={nudge}
          onSkip={finishTour}
          phoneRef={phoneRef}
          stageRef={stageRef}
          step={activeStep}
          stepIndex={tourIndex}
          steps={TOUR_STEPS}
        />
      )}

      <div className="po-stage-brand">
        <span className="po-stage-brand-mark" aria-hidden="true">
          <ShieldCheck size={14} strokeWidth={2} />
        </span>
        <span className="po-stage-brand-copy">
          <b>同服检测</b>
          <i>SAFETY CHECK · PAIRING LAB</i>
        </span>
      </div>

      {GUIDE_MASTER_ENABLED && (
        <div className="po-guide-chrome">
          <span className="po-guide-chrome-label">评委引导</span>
          <button
            aria-checked={guideEnabled}
            aria-label={guideEnabled ? '关闭起始页与引导' : '开启起始页与引导'}
            className={cn('po-guide-switch', guideEnabled && 'is-on')}
            onClick={toggleGuide}
            role="switch"
            type="button"
          >
            <span className="po-guide-knob" />
          </button>
          {guideEnabled && (
            <button
              className="po-guide-replay"
              disabled={phase === 'splash' || activeStep !== null}
              onClick={replayGuide}
              type="button"
            >
              重播
            </button>
          )}
        </div>
      )}

      <p className="po-stage-caption" aria-hidden="true">
        同服检测 · 交互演示
      </p>
      <p className="po-stage-meta" aria-hidden="true">
        {CATEGORIES.length} 分类 · {PAIRING_ITEMS.length} 物品 · 即时判定
      </p>
    </main>
  )
}

export default App
