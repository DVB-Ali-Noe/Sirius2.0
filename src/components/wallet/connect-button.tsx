"use client";

import { useState, useRef, useEffect } from "react";
import { useWalletStore } from "@/stores/wallet";
import { truncateAddress } from "@/lib/utils";
import { getWalletManager } from "@/lib/wallet/manager";

type WalletOption = "crossmark" | "gemwallet" | "xaman";

const WALLET_OPTIONS: { id: WalletOption; name: string }[] = [
  { id: "crossmark", name: "Crossmark / Otsu" },
  { id: "gemwallet", name: "GemWallet" },
  { id: "xaman", name: "Xaman" },
];

export function ConnectButton() {
  const { connected, address, connecting, setConnecting } = useWalletStore();
  const [open, setOpen] = useState(false);
  const [showWalletPicker, setShowWalletPicker] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setShowWalletPicker(false);
    }

    if (open || showWalletPicker) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, showWalletPicker]);

  const { setConnected } = useWalletStore();

  const handleWalletSelect = async (wallet: WalletOption) => {
    setShowWalletPicker(false);
    setConnecting(true);
    try {
      if (wallet === "crossmark") {
        const w = (window as unknown as { xrpl?: { disconnect: () => Promise<void>; connect: () => Promise<{ address: string }> } }).xrpl;
        if (!w) throw new Error("Otsu not detected");
        try { await w.disconnect(); } catch {}
        const res = await w.connect();
        const addr = res?.address;
        if (!addr) throw new Error("No address returned");
        setConnected(addr, "wasm-devnet");
      } else {
        const manager = getWalletManager();
        await manager.connect(wallet);
      }
    } catch {
      setConnecting(false);
    }
  };

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
      <div ref={pickerRef} className="relative">
        <button onClick={() => setShowWalletPicker(!showWalletPicker)} className={`${baseStyle} uppercase tracking-widest`}>
          Connect
        </button>
        {showWalletPicker && (
          <div className="absolute right-0 top-full mt-2 min-w-[220px] overflow-hidden rounded-xl border border-border bg-surface shadow-lg z-50">
            <div className="px-4 py-3 text-xs text-muted uppercase tracking-wider border-b border-border">Connect Wallet</div>
            {WALLET_OPTIONS.map((w) => (
              <button
                key={w.id}
                onClick={() => handleWalletSelect(w.id)}
                className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left text-sm text-foreground transition-colors hover:bg-white/5"
              >
                {w.name}
              </button>
            ))}
          </div>
        )}
      </div>
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
              useWalletStore.getState().setDisconnected();
              getWalletManager().disconnect().catch(() => {});
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
