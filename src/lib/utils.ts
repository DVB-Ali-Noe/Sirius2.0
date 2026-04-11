export function truncateAddress(address: string, chars: number = 4): string {
  if (!address) return ""
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`
}

export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp * 1000)
  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export function timeFromNow(timestamp: number): string {
  const now = Date.now()
  const target = timestamp * 1000
  const diff = target - now
  const absDiff = Math.abs(diff)

  const minutes = Math.floor(absDiff / (1000 * 60))
  const hours = Math.floor(absDiff / (1000 * 60 * 60))
  const days = Math.floor(absDiff / (1000 * 60 * 60 * 24))

  let relative: string
  if (days > 0) relative = `${days}d`
  else if (hours > 0) relative = `${hours}h`
  else relative = `${minutes}m`

  return diff > 0 ? `${relative} left` : `${relative} ago`
}
