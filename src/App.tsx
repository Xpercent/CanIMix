import { useCallback, useEffect, useRef, useState } from 'react'
import { Iphone } from '@/components/ui/iphone'
import { PairingApp, type PairingAppHandle } from '@/components/pairing/PairingApp'
import type { CategoryFilter } from '@/components/pairing/pairing-data'
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
import { TOUR_STEPS } from '@/onboarding/tour-steps'
import '@/onboarding/onboarding.css'

// 收尾页自动翻看的分类顺序：抗感染 → … → 激素专科
const TOUR_CATEGORY_CYCLE: readonly CategoryFilter[] = [
  'infection',
  'digestive',
  'cardio',
  'metabolic',
  'neuro',
  'hormone',
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
        if (TOUR_STEPS[index + 1]?.id === 'finish') {
          pairingRef.current?.setCategory(TOUR_CATEGORY_CYCLE[0])
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
  const finaleActive = activeStep?.id === 'finish'

  // 收尾页自动轮播分类：进入时先切到抗感染，之后每秒切下一个，到激素专科停住。
  // 点击「完成引导」或关闭引导时 finaleActive 变 false，清理定时器即停止。
  useEffect(() => {
    if (!finaleActive) return
    let tick = 0
    const timer = window.setInterval(() => {
      tick += 1
      if (tick >= TOUR_CATEGORY_CYCLE.length) {
        window.clearInterval(timer)
        return
      }
      pairingRef.current?.setCategory(TOUR_CATEGORY_CYCLE[tick])
    }, 1000)
    return () => window.clearInterval(timer)
  }, [finaleActive])

  return (
    <main className={cn('po-stage', activeStep && 'is-touring')} ref={stageRef}>
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
          onFinish={finishTour}
          onSkip={finishTour}
          phoneRef={phoneRef}
          stageRef={stageRef}
          step={activeStep}
          stepIndex={tourIndex}
          steps={TOUR_STEPS}
        />
      )}

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
    </main>
  )
}

export default App
