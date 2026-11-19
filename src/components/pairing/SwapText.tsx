import { useState } from 'react'
import { cn } from '@/lib/utils'

interface SwapTextProps {
  text: string
  className?: string
}

export function SwapText({ text, className }: SwapTextProps) {
  const [swap, setSwap] = useState<{ current: string; previous: string | null }>({
    current: text,
    previous: null,
  })

  if (swap.current !== text) {
    // 旧文本同帧保留，避免切换瞬间闪空一帧
    setSwap({ current: text, previous: swap.current })
  }

  const finishExit = () => {
    setSwap((state) =>
      state.previous === null ? state : { ...state, previous: null },
    )
  }

  return (
    <span className={cn('po-swap', className)}>
      {swap.previous !== null && (
        <span
          aria-hidden="true"
          className="po-swap-old"
          key={swap.previous}
          onAnimationEnd={finishExit}
        >
          {swap.previous}
        </span>
      )}
      <span className="po-swap-new" key={swap.current}>
        {swap.current}
      </span>
    </span>
  )
}