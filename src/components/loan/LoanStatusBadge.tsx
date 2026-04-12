import type { LoanStatus } from "@/hooks/use-loans"

const STATUS_STYLES: Record<LoanStatus, string> = {
  PENDING: "border-muted/40 bg-muted/10 text-muted",
  ACTIVE: "border-accent/40 bg-accent/10 text-accent",
  REPAYING: "border-blue-400/40 bg-blue-400/10 text-blue-400",
  COMPLETED: "border-positive/40 bg-positive/10 text-positive",
  DEFAULTED: "border-negative/40 bg-negative/10 text-negative",
  DISPUTED: "border-yellow-400/40 bg-yellow-400/10 text-yellow-400",
}

export function LoanStatusBadge({ status }: { status: LoanStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium tracking-wider uppercase ${STATUS_STYLES[status]}`}>
      {status}
    </span>
  )
}
