"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useWalletStore, type WalletRole } from "@/stores/wallet"

const ROLE_ROUTES: Record<NonNullable<WalletRole>, string[]> = {
  provider: ["/dashboard", "/provider"],
  borrower: ["/dashboard", "/marketplace", "/borrower"],
  loanbroker: ["/dashboard", "/provider", "/marketplace", "/borrower", "/admin"],
}

export function useRouteGuard(currentPath: string) {
  const router = useRouter()
  const { connected, role } = useWalletStore()

  useEffect(() => {
    if (!connected) {
      if (currentPath !== "/dashboard") {
        router.replace("/dashboard")
      }
      return
    }

    if (!role) {
      if (currentPath !== "/dashboard") {
        router.replace("/dashboard")
      }
      return
    }

    const allowed = ROLE_ROUTES[role]
    if (!allowed.includes(currentPath)) {
      router.replace("/dashboard")
    }
  }, [connected, role, currentPath, router])

  if (!connected) return currentPath === "/dashboard"
  if (!role) return currentPath === "/dashboard"
  return ROLE_ROUTES[role].includes(currentPath)
}
