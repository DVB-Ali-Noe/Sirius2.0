interface RepaymentProgressProps {
  totalOwed: number
  totalPaid: number
}

export function RepaymentProgress({ totalOwed, totalPaid }: RepaymentProgressProps) {
  const pct = totalOwed > 0 ? Math.min(100, (totalPaid / totalOwed) * 100) : 0
  const remaining = Math.max(0, totalOwed - totalPaid)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs text-muted">
        <span>{totalPaid.toFixed(2)} XRP paid</span>
        <span>{remaining.toFixed(2)} XRP left</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-positive transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
