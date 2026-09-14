import { useEffect, useRef, useState } from 'react'

/** Eases a number from 0 → target over `duration` ms with requestAnimationFrame.
 *  Respects prefers-reduced-motion (jumps straight to the value). */
function useCountUp(target: number, duration = 500) {
  const [value, setValue] = useState(0)
  const frameRef = useRef<number | undefined>(undefined)
  const startedRef = useRef(false)

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) {
      setValue(target)
      return
    }

    // Only animate the first meaningful reveal; subsequent target changes snap
    // (avoids distracting re-tweens on every refetch).
    if (startedRef.current) {
      setValue(target)
      return
    }
    startedRef.current = true

    const start = performance.now()
    const from = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(from + (target - from) * eased)
      if (t < 1) frameRef.current = requestAnimationFrame(tick)
    }
    frameRef.current = requestAnimationFrame(tick)

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
    }
  }, [target, duration])

  return value
}

interface CountUpProps {
  value: number
  format?: (n: number) => string
  duration?: number
  className?: string
}

export function CountUp({ value, format, duration, className }: CountUpProps) {
  const animated = useCountUp(value, duration)
  const display = format ? format(animated) : Math.round(animated).toLocaleString('en-IN')
  return <span className={className}>{display}</span>
}
