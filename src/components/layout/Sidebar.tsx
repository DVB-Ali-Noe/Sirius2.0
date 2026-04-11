"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion } from "framer-motion"

const NAV_ITEMS = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
      </svg>
    ),
  },
  {
    href: "/",
    label: "Exit",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
      </svg>
    ),
  },
]

export const SIDEBAR_COLLAPSED = 82
export const SIDEBAR_EXPANDED = 260

export function Sidebar({ open, onOpen, onClose, hiding }: { open: boolean; onOpen: () => void; onClose: () => void; hiding?: boolean }) {
  const pathname = usePathname()

  return (
    <motion.aside
      onMouseEnter={onOpen}
      onMouseLeave={onClose}
      className="fixed left-0 top-0 z-50 flex h-screen flex-col transition-[width] duration-300 ease-out"
      style={{ width: open ? SIDEBAR_EXPANDED : SIDEBAR_COLLAPSED }}
      initial={false}
      animate={{ x: hiding ? "-100%" : 0 }}
      transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
    >
      <div className="h-[82px] pointer-events-none" />

      <nav className="flex flex-1 flex-col gap-2 border border-white rounded-t-2xl border-b-0 bg-background -mt-px px-4 py-2">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(item.href + "/")

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={`relative flex h-12 w-full items-center rounded-full border overflow-hidden backdrop-blur-sm transition-all duration-300 ease-out ${
                isActive
                  ? "border-white bg-white/10 text-white"
                  : "border-white/80 bg-white/5 text-white/70 hover:text-white"
              }`}
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center">
                {item.icon}
              </div>
              <span
                className="whitespace-nowrap text-xs uppercase tracking-widest text-current transition-opacity duration-300 pointer-events-none"
                style={{ opacity: open ? 1 : 0 }}
              >
                {item.label}
              </span>
            </Link>
          )
        })}
      </nav>
    </motion.aside>
  )
}
