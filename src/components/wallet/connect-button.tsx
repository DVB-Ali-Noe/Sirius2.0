"use client";

import { useState, useRef, useEffect } from "react";
import { useWalletStore } from "@/stores/wallet";
import { truncateAddress } from "@/lib/utils";
import { getWalletManager } from "@/lib/wallet/manager";
import { triggerWalletConnect } from "@/components/wallet/wallet-connector";

export function ConnectButton() {
  const { connected, address, connecting } = useWalletStore();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const baseStyle =
    "cursor-pointer rounded-full border border-white/80 bg-white/5 px-7 py-2.5 text-sm text-white backdrop-blur-sm transition-all duration-200";

  if (connecting) {
    return (
      <button disabled className={`${baseStyle} cursor-wait opacity-50`}>
        Connecting...
      </button>
    );
  }

  if (!connected || !address) {
    return (
      <button onClick={triggerWalletConnect} className={`${baseStyle} uppercase tracking-widest`}>
        Connect
      </button>
    );
  }

  return (
    <div ref={menuRef} className="relative flex items-center gap-3">
      <span className="rounded-full bg-positive/20 px-3 py-1 text-xs text-positive">
        Devnet
      </span>
      <button onClick={() => setOpen(!open)} className={baseStyle}>
        {truncateAddress(address)}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 min-w-[180px] overflow-hidden rounded-xl border border-border bg-surface shadow-lg">
          <button
            onClick={() => {
              navigator.clipboard.writeText(address);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="flex w-full cursor-pointer items-center gap-2 px-4 py-3 text-left text-sm text-foreground transition-colors hover:bg-white/5"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            {copied ? "Copied!" : "Copy Address"}
          </button>
          <div className="border-t border-border" />
          <button
            onClick={() => {
              getWalletManager().disconnect();
              setOpen(false);
            }}
            className="flex w-full cursor-pointer items-center gap-2 px-4 py-3 text-left text-sm text-negative transition-colors hover:bg-white/5"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
