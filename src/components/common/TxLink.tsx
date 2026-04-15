import { truncateAddress } from "@/lib/utils"

const EXPLORER_BASE = "https://custom.xrpl.org/wasm.devnet.rippletest.net"

function isOnChainHash(hash: string): boolean {
  return /^[0-9A-Fa-f]{64}$/.test(hash)
}

const LinkIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
)

export function TxLink({ hash, label }: { hash: string; label?: string }) {
  const text = label ?? truncateAddress(hash, 6)

  if (!isOnChainHash(hash)) {
    return <span className="inline-flex items-center gap-1 font-mono text-xs text-accent">{text}</span>
  }

  return (
    <a
      href={`${EXPLORER_BASE}/transactions/${hash}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 font-mono text-xs text-accent hover:underline"
    >
      {text}
      <LinkIcon />
    </a>
  )
}

export function ObjectLink({ id, type, label }: { id: string; type?: string; label?: string }) {
  const text = label ?? truncateAddress(id, 6)

  if (!isOnChainHash(id)) {
    return <span className="inline-flex items-center gap-1 font-mono text-xs text-muted">{text}</span>
  }

  const path = type === "account" ? "accounts" : "transactions"
  return (
    <a
      href={`${EXPLORER_BASE}/${path}/${id}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 font-mono text-xs text-muted hover:text-foreground hover:underline"
    >
      {text}
      <LinkIcon />
    </a>
  )
}
