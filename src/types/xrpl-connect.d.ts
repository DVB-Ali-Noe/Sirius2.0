declare namespace React.JSX {
  interface IntrinsicElements {
    "xrpl-wallet-connector": React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & { "primary-wallet"?: string },
      HTMLElement
    >;
  }
}

declare module "xrpl-connect" {
  export interface WalletManagerOptions {
    adapters: unknown[];
    network: string;
    autoConnect?: boolean;
  }

  export interface AccountInfo {
    address: string;
    network?: { name?: string };
  }

  export class WalletManager {
    constructor(options: WalletManagerOptions);
    on(event: "connect", callback: (account: AccountInfo) => void): void;
    on(event: "disconnect", callback: () => void): void;
    on(event: "error", callback: (error: Error) => void): void;
    off(event: string, callback: (...args: unknown[]) => void): void;
    disconnect(): Promise<void>;
    signAndSubmit(transaction: Record<string, unknown>): Promise<{ hash: string }>;
    get account(): AccountInfo | null;
  }

  export class GemWalletAdapter {
    constructor();
  }

  export class CrossmarkAdapter {
    constructor();
  }

  export class XamanAdapter {
    constructor(options: { apiKey: string });
  }

  export class LedgerAdapter {
    constructor();
  }

  export class WalletConnectorElement extends HTMLElement {
    setWalletManager(manager: WalletManager): void;
  }
}
