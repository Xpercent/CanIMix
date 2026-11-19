import { useLayoutEffect, useRef } from 'react'

interface Box {
  x: number
  y: number
  w: number
  h: number
}

export interface FlightState {
  key: number
  itemId: string
  art: string
  start: Box
  endX: number
  endY: number
  endSize: number
}

export function Flight({
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
