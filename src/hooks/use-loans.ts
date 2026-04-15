"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiGet, apiPost } from "@/lib/api-client"

export type LoanStatus = "PENDING" | "ACTIVE" | "REPAYING" | "COMPLETED" | "DEFAULTED" | "DISPUTED"

export interface LoanRecord {
  loanId: string
  borrower: string
  provider: string
  loanBroker: string
  vaultId: string
  mptIssuanceId: string
  datasetId?: string
  principalAmount: string
  pricePerDay?: string
  interestRate: number
  paymentTotal: number
  durationDays?: number
  paymentInterval: number
  gracePeriod: number
  status: LoanStatus
  createdAt: number
  expiresAt?: number
  completedAt?: number
  payments: Array<{ amount: string; timestamp: number; txHash: string }>
  activatedAt?: number
}

export interface RepaymentInfo {
  totalOwed: number
  totalPaid: number
  remaining: number
  payments: Array<{ amount: string; paidAt: number; txHash?: string }>
}

const LOCAL_LOANS_KEY = "sirius-loans-cache"

function getLocalLoans(): LoanRecord[] {
  if (typeof window === "undefined") return []
  try {
    return JSON.parse(localStorage.getItem(LOCAL_LOANS_KEY) || "[]")
  } catch { return [] }
}

function saveLocalLoans(loans: LoanRecord[]) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(LOCAL_LOANS_KEY, JSON.stringify(loans))
  } catch {}
}

export function addLocalLoan(loan: LoanRecord) {
  const existing = getLocalLoans()
  const updated = existing.filter((l) => l.loanId !== loan.loanId)
  updated.push(loan)
  saveLocalLoans(updated)
}

export function useLoans() {
  return useQuery({
    queryKey: ["loans"],
    queryFn: async () => {
      const serverLoans = await apiGet<{ loans: LoanRecord[] }>("/api/xrpl/loan/status").then((r) => r.loans)
      const localLoans = getLocalLoans()
      // Merge: server wins on duplicates, local fills gaps
      const byId = new Map<string, LoanRecord>()
      for (const l of localLoans) byId.set(l.loanId, l)
      for (const l of serverLoans) byId.set(l.loanId, l)
      const merged = Array.from(byId.values())
      // Sync local cache with merged result
      saveLocalLoans(merged)
      return merged
    },
    refetchInterval: 10_000,
  })
}

export function useLoan(loanId: string | null) {
  return useQuery({
    queryKey: ["loan", loanId],
    queryFn: () =>
      apiGet<{ loan: LoanRecord; repayment: RepaymentInfo }>(`/api/xrpl/loan/status?loanId=${loanId}`),
    enabled: !!loanId,
    refetchInterval: 10_000,
  })
}

export function useCreateLoan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      vaultId: string
      mptIssuanceId: string
      loanBrokerId?: string
      borrowerAddress?: string
      principalAmount?: string
      interestRate?: number
    }) => apiPost("/api/xrpl/loan", { action: "create", ...input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["loans"] }),
  })
}

export function useRepayLoan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { loanId: string; amountXrp: string }) =>
      apiPost("/api/xrpl/loan/repay", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["loans"] }),
  })
}
