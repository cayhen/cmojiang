'use client'

import * as React from 'react'
import { motion, Variants } from 'framer-motion'
import { cn } from '@/lib/utils'

interface AnimatedTextProps extends React.HTMLAttributes<HTMLDivElement> {
  text: string
  textClassName?: string
  underlineClassName?: string
  underlinePath?: string
  underlineHoverPath?: string
  underlineDuration?: number
}

const AnimatedText = React.forwardRef<HTMLDivElement, AnimatedTextProps>(
  (
    {
      text,
      textClassName,
      underlineClassName,
      underlinePath = 'M 0,10 Q 75,0 150,10 Q 225,20 300,10',
      underlineHoverPath = 'M 0,10 Q 75,20 150,10 Q 225,0 300,10',
      underlineDuration = 0.8,
      ...props
    },
    ref
  ) => {
    const pathVariants: Variants = {
      hidden: { pathLength: 0, opacity: 0 },
      visible: {
        pathLength: 1,
        opacity: 1,
        transition: { duration: underlineDuration, ease: 'easeInOut' },
      },
    }

    return (
      <div
        ref={ref}
        className={cn('flex flex-col items-center justify-center', props.className)}
      >
        <div className="relative pb-5">
          <h1 className={cn('font-light text-[#bbb] text-center', textClassName)}>
            {text}
          </h1>

          <motion.svg
            width="100%"
            height="16"
            viewBox="0 0 300 20"
            className={cn('absolute -bottom-1 left-0', underlineClassName)}
          >
            <motion.path
              d={underlinePath}
              stroke="currentColor"
              strokeWidth="1.5"
              fill="none"
              variants={pathVariants}
              initial="hidden"
              animate="visible"
              whileHover={{
                d: underlineHoverPath,
                transition: { duration: 0.6 },
              }}
            />
          </motion.svg>
        </div>
      </div>
    )
  }
)

AnimatedText.displayName = 'AnimatedText'

export { AnimatedText }
