"use client";

import { useEffect, useRef } from "react";
import { getWalletManager } from "@/lib/wallet/manager";
import { useWalletStore } from "@/stores/wallet";
import type { WalletManager as WalletManagerType } from "xrpl-connect";

const THEME_VARS: Record<string, string> = {
  "--xc-background-color": "#0B0B0B",
  "--xc-background-secondary": "#131313",
  "--xc-background-tertiary": "#1E1E1E",
  "--xc-text-color": "#E8E8E8",
  "--xc-text-muted-color": "#888888",
  "--xc-primary-color": "#FF4D00",
  "--xc-success-color": "#34D399",
  "--xc-danger-color": "#F87171",
  "--xc-font-family": "'Satoshi', sans-serif",
  "--xc-border-radius": "12px",
  "--xc-modal-border-radius": "16px",
  "--xc-modal-background": "#0B0B0B",
  "--xc-modal-box-shadow": "0 10px 40px rgba(0, 0, 0, 0.5)",
  "--xc-overlay-background": "rgba(0, 0, 0, 0.7)",
  "--xc-overlay-backdrop-filter": "blur(8px)",
};

export function WalletConnector() {
  const connectorRef = useRef<HTMLElement>(null);
  const { setConnected, setDisconnected } = useWalletStore();

  useEffect(() => {
    const manager = getWalletManager();

    const onConnect = (account: { address: string; network?: { name?: string } }) => {
      setConnected(account.address, account.network?.name ?? "devnet");
    };

    const onDisconnect = () => {
      setDisconnected();
    };

    manager.on("connect", onConnect);
    manager.on("disconnect", onDisconnect as () => void);

    const setup = async () => {
      await customElements.whenDefined("xrpl-wallet-connector");
      if (connectorRef.current) {
        (connectorRef.current as unknown as { setWalletManager: (m: WalletManagerType) => void }).setWalletManager(manager);
      }
    };

    setup();

    return () => {
      manager.off("connect", onConnect as unknown as (...args: unknown[]) => void);
      manager.off("disconnect", onDisconnect as unknown as (...args: unknown[]) => void);
    };
  }, [setConnected, setDisconnected]);

  return (
    <xrpl-wallet-connector
      ref={connectorRef}
      style={{
        ...THEME_VARS,
        position: "absolute",
        opacity: "0",
        pointerEvents: "none",
        width: "0",
        height: "0",
        overflow: "hidden",
      } as React.CSSProperties}
    />
  );
}

export function triggerWalletConnect() {
  const el = document.querySelector("xrpl-wallet-connector");
  if (!el?.shadowRoot) return;
  const btn = el.shadowRoot.querySelector("button");
  if (btn) btn.click();
}
