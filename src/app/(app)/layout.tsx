"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { usePathname, useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Sidebar, SIDEBAR_COLLAPSED, SIDEBAR_EXPANDED } from "@/components/layout/Sidebar"
import { TopBar } from "@/components/layout/Header"
import { Footer, FOOTER_H } from "@/components/layout/Footer"

const TOPBAR_H = 80

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [dezooming, setDezooming] = useState(false)
  const [phase, setPhase] = useState<"pre" | "idle" | "exit" | "enter" | "settle">("pre")
  const [navKey, setNavKey] = useState(0)
  const contentRef = useRef<HTMLDivElement>(null)
  const newPageRef = useRef<HTMLDivElement>(null)
  const cloneRef = useRef<HTMLElement | null>(null)
  const rafRef = useRef<number>(0)
  const hasInitialized = useRef(false)

  useEffect(() => {
    window.history.scrollRestoration = "auto"
    const reset = () => {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior })
      document.documentElement.scrollTop = 0
      document.body.scrollTop = 0
    }
    reset()
    const t1 = setTimeout(reset, 0)
    const t2 = setTimeout(reset, 50)
    const t3 = setTimeout(reset, 150)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [pathname])

  const handleNavClick = useCallback(() => {
    if (cloneRef.current) {
      cloneRef.current.remove()
      cloneRef.current = null
    }
    cancelAnimationFrame(rafRef.current)

    const el = contentRef.current
    if (!el) return

    el.style.visibility = "hidden"

    const clone = el.cloneNode(true) as HTMLElement
    clone.style.visibility = "visible"
    clone.style.position = "fixed"
    clone.style.top = el.getBoundingClientRect().top + "px"
    clone.style.left = "0"
    clone.style.right = "0"
    clone.style.zIndex = "10"
    clone.style.pointerEvents = "none"
    clone.style.transformOrigin = "center center"
    clone.style.transition = "transform 1.5s ease"
    clone.style.border = "1px solid white"
    clone.style.borderRadius = "16px"
    document.body.appendChild(clone)

    requestAnimationFrame(() => {
      clone.style.transform = "scale(0.85)"
    })

    cloneRef.current = clone
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest("a[href]")
      if (!anchor) return
      const href = anchor.getAttribute("href")
      if (!href || href.startsWith("http") || href.startsWith("#")) return
      if (href === "/") {
        e.preventDefault()
        setSidebarOpen(false)
        setDezooming(true)
        return
      }
      handleNavClick()
      setSidebarOpen(false)
      setPhase("exit")
      setNavKey(k => k + 1)
    }
    document.addEventListener("click", handler, true)
    return () => document.removeEventListener("click", handler, true)
  }, [handleNavClick])

  useEffect(() => {
    if (phase !== "enter") return
    const clone = cloneRef.current
    if (!clone) return

    const tick = () => {
      const newPage = newPageRef.current
      if (!newPage || !clone.parentElement) return

      if (newPage.style.visibility === "hidden") {
        newPage.style.visibility = ""
      }

      const pageTop = newPage.getBoundingClientRect().top
      const cloneRect = clone.getBoundingClientRect()

      const screenClip = cloneRect.bottom - pageTop
      if (screenClip > 0) {
        const scale = cloneRect.height / clone.offsetHeight
        const elementClip = screenClip / scale
        clone.style.clipPath = `inset(0 0 ${elementClip}px 0)`
      }

      if (pageTop <= cloneRect.top) {
        clone.remove()
        cloneRef.current = null
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [phase])

  useEffect(() => {
    if (navKey === 0) {
      if (hasInitialized.current) return
      hasInitialized.current = true
      requestAnimationFrame(() => {
        setPhase("enter")
        setTimeout(() => setPhase("settle"), 1400)
        setTimeout(() => setPhase("idle"), 2000)
      })
      return
    }

    const t1 = setTimeout(() => {
      window.scrollTo(0, 0)
      setPhase("enter")
    }, 600)

    const t2 = setTimeout(() => {
      if (cloneRef.current) {
        cloneRef.current.remove()
        cloneRef.current = null
      }
      if (contentRef.current) contentRef.current.style.visibility = ""
      setPhase("settle")
    }, 2000)

    const t3 = setTimeout(() => setPhase("idle"), 2600)

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [navKey])

  useEffect(() => {
    (window as any).__blobTargetZ = 0.1;
    return () => { delete (window as any).__blobTargetZ; };
  }, [])

  useEffect(() => {
    const handler = () => {
      setSidebarOpen(false)
      setDezooming(true)
    }
    window.addEventListener("sirius:exit", handler)
    return () => window.removeEventListener("sirius:exit", handler)
  }, [])

  useEffect(() => {
    if (!dezooming) return
    delete (window as any).__blobTargetZ;
    (window as any).__blobDezoom = {
      active: true,
      onComplete: () => router.push("/"),
    }
    return () => {
      delete (window as any).__blobDezoom;
      delete (window as any).__blobDezoomProgress;
    }
  }, [dezooming, router])

  const dezoomOverlayRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!dezooming) return
    const tick = () => {
      const progress = (window as any).__blobDezoomProgress ?? 0
      if (dezoomOverlayRef.current) {
        const inv = 1 - progress
        const zoom = 1 + inv * inv * 8
        dezoomOverlayRef.current.style.transform = `scale(${zoom})`
      }
      rafId = requestAnimationFrame(tick)
    }
    let rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [dezooming])

  return (
    <div className={`h-screen bg-background text-foreground overflow-hidden`}>
      <div className="transition-opacity duration-1000" style={{ opacity: dezooming ? 0 : 1, pointerEvents: dezooming ? "none" : "auto" }}>
        <Sidebar open={sidebarOpen} onOpen={() => setSidebarOpen(true)} onClose={() => setSidebarOpen(false)} hiding={phase === "pre" || phase === "exit" || phase === "enter"} />

        <motion.div
          className="fixed top-0 left-0 right-0 z-[60] border border-white rounded-2xl"
          initial={false}
          animate={{
            y: phase === "exit" || phase === "enter" || phase === "pre" ? "-100%" : "0%"
          }}
          transition={{ duration: phase === "pre" ? 0 : 0.8, ease: [0.4, 0, 0.2, 1] }}
        >
          <TopBar onMenuClick={() => setSidebarOpen(s => !s)} onMenuHover={() => setSidebarOpen(true)} />
        </motion.div>

        <div
          className="transition-[margin-left] duration-300 ease-out"
          style={{ marginLeft: sidebarOpen ? SIDEBAR_EXPANDED - 1 : SIDEBAR_COLLAPSED - 1, paddingTop: TOPBAR_H + 1 }}
        >
          <motion.div
            ref={(el) => { contentRef.current = el; newPageRef.current = el }}
            className="relative z-20 border border-white rounded-2xl flex flex-col"
            style={{ height: `calc(100vh - ${TOPBAR_H + 1}px)` }}
            initial={false}
            animate={{
              y: phase === "exit" || phase === "pre" ? "100vh"
                : phase === "enter" ? -TOPBAR_H
                : 0
            }}
            transition={
              phase === "pre" || phase === "exit" || phase === "idle"
                ? { duration: 0 }
                : { duration: phase === "settle" ? 0.6 : 1.2, ease: phase === "settle" ? [0.25, 0.1, 0.25, 1] : [0.45, 0, 0.1, 1] }
            }
          >
            <main className="mx-auto w-full max-w-7xl flex-1 min-h-0 px-6 py-3" style={{ paddingBottom: FOOTER_H }}>
              {children}
            </main>
          </motion.div>
        </div>
      </div>

      {!dezooming && <Footer />}

      {dezooming && (
        <div
          ref={dezoomOverlayRef}
          className="fixed inset-0 z-[70] pointer-events-none flex flex-col justify-between"
          style={{ transformOrigin: "center center" }}
        >
          <div className="flex items-start justify-between p-8 md:p-12">
            <h1 className="font-display text-4xl tracking-wider text-foreground md:text-5xl">
              Sirius
            </h1>
          </div>
          <div className="w-full">
            <div className="overflow-hidden bg-white py-0.5">
              <div
                className="flex whitespace-nowrap text-xs uppercase tracking-wider text-background md:text-sm"
                style={{ animation: "marquee 20s linear infinite" }}
              >
                {[0, 1].map((k) => (
                  <span key={k} className="flex shrink-0 items-center">
                    {["Sirius Protocol", "Decentralized Data Lending", "Built on XRPL"].map((item, j) =>
                      Array.from({ length: 6 }, (_, i) => (
                        <span key={`${k}-${i}-${j}`} className="flex items-center">
                          <span>{item}</span>
                          <span className="mx-8 inline-block h-1.5 w-1.5 rounded-full bg-current" />
                        </span>
                      ))
                    )}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
