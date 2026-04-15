"use client";

interface WindowXrpl {
  isOtsu: boolean;
  isConnected(): boolean;
  connect(params?: { scopes?: string[] }): Promise<{ address: string }>;
  disconnect(): Promise<void>;
  getAddress(): Promise<{ address: string }>;
  getNetwork(): Promise<{ network: string }>;
  getBalance(): Promise<{ available: string; total: string; reserved: string }>;
  signAndSubmit(tx: Record<string, unknown>): Promise<{ tx_blob: string; hash: string }>;
  switchNetwork(networkId: string): Promise<{ network: string }>;
  on(event: string, callback: (data: unknown) => void): void;
  off(event: string, callback: (data: unknown) => void): void;
}

declare global {
  interface Window {
    xrpl?: WindowXrpl;
  }
}

export const REQUIRED_NETWORK = "wasm-devnet";

export function isOtsuInstalled(): boolean {
  return typeof window !== "undefined" && !!window.xrpl?.isOtsu;
}

export function getOtsu(): WindowXrpl {
  if (typeof window === "undefined") {
    throw new Error("Otsu must be used in the browser");
  }
  if (!window.xrpl?.isOtsu) {
    throw new Error("Otsu Wallet is not installed");
  }
  return window.xrpl;
}

export async function connectOtsu(): Promise<{ address: string; network: string }> {
  const otsu = getOtsu();
  const { address } = await otsu.connect({ scopes: ["read", "sign", "submit"] });
  const { network } = await otsu.getNetwork();
  if (network !== REQUIRED_NETWORK) {
    try {
      await otsu.switchNetwork(REQUIRED_NETWORK);
    } catch {
      throw new Error(
        `Please switch Otsu to "Wasm Devnet" (current: ${network}) and try again`
      );
    }
  }
  return { address, network: REQUIRED_NETWORK };
}

export async function disconnectOtsu(): Promise<void> {
  if (!isOtsuInstalled()) return;
  try {
    await getOtsu().disconnect();
  } catch {
    // ignore
  }
}

export interface PaymentRequest {
  from: string;
  to: string;
  amountDrops: string;
  memo?: string;
}

function toHex(s: string): string {
  return Buffer.from(s, "utf-8").toString("hex").toUpperCase();
}

export async function signAndSubmitCredentialAccept(params: {
  subject: string;
  issuer: string;
  credentialType: string;
}): Promise<{ hash: string }> {
  const otsu = getOtsu();
  const tx: Record<string, unknown> = {
    TransactionType: "CredentialAccept",
    Account: params.subject,
    Issuer: params.issuer,
    CredentialType: toHex(params.credentialType),
  };
  const result = await otsu.signAndSubmit(tx);
  return { hash: result.hash };
}

export async function signAndSubmitPayment(req: PaymentRequest): Promise<{ hash: string }> {
  const otsu = getOtsu();
  const tx: Record<string, unknown> = {
    TransactionType: "Payment",
    Account: req.from,
    Destination: req.to,
    Amount: req.amountDrops,
  };
  if (req.memo) {
    tx.Memos = [
      {
        Memo: {
          MemoData: Buffer.from(req.memo, "utf-8").toString("hex").toUpperCase(),
        },
      },
    ];
  }
  const result = await otsu.signAndSubmit(tx);
  return { hash: result.hash };
}
