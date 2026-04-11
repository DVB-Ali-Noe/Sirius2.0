"use client"

import { useState, useEffect, useRef } from "react"

interface LoadingBarProps {
  isLoading: boolean
  children: React.ReactNode
}

const STEPS = [
  { target: 40, delay: 0 },
  { target: 65, delay: 400 },
  { target: 77, delay: 900 },
  { target: 85, delay: 1500 },
]

export function LoadingBar({ isLoading, children }: LoadingBarProps) {
  const [progress, setProgress] = useState(0)
  const [visible, setVisible] = useState(true)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    if (isLoading) {
      setProgress(0)
      setVisible(true)
      timersRef.current = STEPS.map(({ target, delay }) =>
        setTimeout(() => setProgress(target), delay)
      )
      return () => timersRef.current.forEach(clearTimeout)
    } else {
      timersRef.current.forEach(clearTimeout)
      setProgress(100)
      const timer = setTimeout(() => setVisible(false), 400)
      return () => clearTimeout(timer)
    }
  }, [isLoading])

  if (!visible) return <>{children}</>

  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-56 h-[2px] overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-white"
          style={{
            width: `${progress}%`,
            transition: progress === 100 ? "width 350ms ease-out" : "width 500ms ease-out",
          }}
        />
      </div>
    </div>
  )
}

export function LoadingSpinner({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const widths = { sm: "w-24", md: "w-40", lg: "w-56" }
  return (
    <div className="flex items-center justify-center py-20">
      <div className={`${widths[size]} h-[2px] overflow-hidden rounded-full bg-white/10`}>
        <div className="h-full w-1/3 animate-loading-bar rounded-full bg-white" />
      </div>
    </div>
  )
}
