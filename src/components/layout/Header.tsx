"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ConnectButton } from "@/components/wallet/connect-button"
import { useSearchStore } from "@/stores/search"

export function TopBar({ onMenuClick, onMenuHover }: { onMenuClick: () => void; onMenuHover?: () => void }) {
  const pathname = usePathname()
  const { query, setQuery } = useSearchStore()
  const showSearch = pathname === "/marketplace"

  return (
    <header className="sticky top-0 z-30 flex h-20 items-center gap-4 px-4">
      <div className="flex shrink-0 items-center gap-4">
        <button
          onClick={onMenuClick}
          onMouseEnter={onMenuHover}
          className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full border border-white/80 bg-white/5 text-white backdrop-blur-sm transition-all duration-200"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <Link href="/dashboard" className="font-display text-2xl font-bold tracking-wider text-white">
          Sirius
        </Link>
      </div>

      {showSearch ? (
        <div className="flex-1 max-w-lg mx-auto">
          <input
            type="text"
            placeholder="Search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-full border border-white/10 bg-white/5 px-5 py-2 text-sm text-foreground placeholder-muted outline-none focus:border-white/30"
          />
        </div>
      ) : (
        <div className="flex-1" />
      )}

      <div className="shrink-0 flex items-center gap-3">
        <ConnectButton />
      </div>
    </header>
  )
}
