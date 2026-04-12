"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion } from "framer-motion"
import { useWalletStore, type WalletRole } from "@/stores/wallet"

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
  roles: WalletRole[] | "all"
}

const NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    roles: "all",
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
    href: "/provider",
    label: "My Datasets",
    roles: ["provider", "loanbroker"],
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
    ),
  },
  {
    href: "/marketplace",
    label: "Marketplace",
    roles: ["borrower", "loanbroker"],
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
      </svg>
    ),
  },
  {
    href: "/borrower",
    label: "My Loans",
    roles: ["borrower", "loanbroker"],
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },
  {
    href: "/admin",
    label: "Admin",
    roles: ["loanbroker"],
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
  {
    href: "/",
    label: "Exit",
    roles: "all",
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
  const { role, connected } = useWalletStore()

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (item.roles === "all") return true
    if (!connected || !role) return false
    return item.roles.includes(role)
  })

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
        {visibleItems.map((item) => {
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
