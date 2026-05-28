'use client'

import { useEffect } from 'react'
import { cn } from '@/lib/utils'
import {
  motion,
  useMotionValue,
  useMotionTemplate,
  useAnimationFrame,
  type MotionValue,
} from 'framer-motion'

function GridLayer({
  patternId,
  offsetX,
  offsetY,
}: {
  patternId: string
  offsetX: MotionValue<number>
  offsetY: MotionValue<number>
}) {
  return (
    <svg className="w-full h-full">
      <defs>
        <motion.pattern
          id={patternId}
          width="40"
          height="40"
          patternUnits="userSpaceOnUse"
          x={offsetX}
          y={offsetY}
        >
          <path
            d="M 40 0 L 0 0 0 40"
            fill="none"
            stroke="white"
            strokeWidth="1"
          />
        </motion.pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  )
}

export function InfiniteGrid({ className }: { className?: string }) {
  const mouseX = useMotionValue(-9999)
  const mouseY = useMotionValue(-9999)
  const gridOffsetX = useMotionValue(0)
  const gridOffsetY = useMotionValue(0)

  useEffect(() => {
    function onMove(e: MouseEvent) {
      mouseX.set(e.clientX)
      mouseY.set(e.clientY)
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [mouseX, mouseY])

  useAnimationFrame(() => {
    gridOffsetX.set((gridOffsetX.get() + 0.2) % 40)
    gridOffsetY.set((gridOffsetY.get() + 0.2) % 40)
  })

  const maskImage = useMotionTemplate`radial-gradient(220px circle at ${mouseX}px ${mouseY}px, black, transparent)`

  return (
    <div className={cn('absolute inset-0 pointer-events-none overflow-hidden', className)}>
      {/* base grid — very faint */}
      <div className="absolute inset-0 opacity-[0.04]">
        <GridLayer patternId="igp-base" offsetX={gridOffsetX} offsetY={gridOffsetY} />
      </div>
      {/* mouse-revealed grid */}
      <motion.div
        className="absolute inset-0 opacity-[0.22]"
        style={{ maskImage, WebkitMaskImage: maskImage }}
      >
        <GridLayer patternId="igp-reveal" offsetX={gridOffsetX} offsetY={gridOffsetY} />
      </motion.div>
    </div>
  )
}
