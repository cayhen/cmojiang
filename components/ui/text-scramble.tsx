'use client'

import { useState, useCallback, useRef, useEffect } from 'react'

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*'

interface TextScrambleProps {
  text: string
  className?: string
  /** Fire scramble on mount instead of on hover */
  autoPlay?: boolean
  /** Use a faster scramble (shorter duration, tighter interval) */
  fast?: boolean
}

export function TextScramble({ text, className = '', autoPlay = false, fast = false }: TextScrambleProps) {
  const [displayText, setDisplayText] = useState(text)
  const [isScrambling, setIsScrambling] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const frameRef = useRef(0)

  const scramble = useCallback(() => {
    setIsScrambling(true)
    frameRef.current = 0
    const duration = fast ? Math.ceil(text.length * 1.5) : text.length * 3
    const tick = 30

    if (intervalRef.current) clearInterval(intervalRef.current)

    intervalRef.current = setInterval(() => {
      frameRef.current++
      const progress = frameRef.current / duration
      const revealedLength = Math.floor(progress * text.length)

      const newText = text
        .split('')
        .map((char, i) => {
          if (char === ' ' || char === '—' || char === '-') return char
          if (i < revealedLength) return text[i]
          return CHARS[Math.floor(Math.random() * CHARS.length)]
        })
        .join('')

      setDisplayText(newText)

      if (frameRef.current >= duration) {
        if (intervalRef.current) clearInterval(intervalRef.current)
        setDisplayText(text)
        setIsScrambling(false)
      }
    }, tick)
  }, [text, fast])

  useEffect(() => {
    if (autoPlay) scramble()
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [autoPlay, scramble])

  return (
    <span
      className={`inline-block cursor-default select-none font-mono ${className}`}
      onMouseEnter={autoPlay ? undefined : scramble}
    >
      {displayText.split('').map((char, i) =>
        char === ' ' ? (
          <span key={i} className="inline-block w-[0.45em]" />
        ) : (
          <span
            key={i}
            className={`inline-block transition-opacity duration-75 ${
              isScrambling && char !== text[i] ? 'opacity-30' : 'opacity-100'
            }`}
          >
            {char}
          </span>
        )
      )}
    </span>
  )
}
