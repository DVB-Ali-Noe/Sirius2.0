import type { TransactionStream } from "xrpl";
import { getClient } from "./client";

type EventType = "MPTokenAuthorize" | "VaultDeposit" | "VaultWithdraw" | "LoanSet" | "LoanDelete" | "Payment";

type EventCallback = (tx: TransactionStream) => void;

const listeners = new Map<EventType, EventCallback[]>();
let subscribed = false;
let subscribedAccounts: string[] = [];

export function onXRPLEvent(eventType: EventType, callback: EventCallback): () => void {
  const existing = listeners.get(eventType) ?? [];
  existing.push(callback);
  listeners.set(eventType, existing);

  return () => {
    const cbs = listeners.get(eventType) ?? [];
    const idx = cbs.indexOf(callback);
    if (idx !== -1) cbs.splice(idx, 1);
  };
}

export async function subscribeToAccounts(accounts: string[]): Promise<void> {
  if (subscribed) return;

  const client = await getClient();

  await client.request({
    command: "subscribe",
    accounts,
  });

  client.on("transaction", (tx: TransactionStream) => {
    const txType = tx.tx_json?.TransactionType as EventType | undefined;
    if (!txType) return;

    const callbacks = listeners.get(txType);
    if (callbacks) {
      callbacks.forEach((cb) => cb(tx));
    }
  });

  subscribedAccounts = accounts;
  subscribed = true;
}

export async function unsubscribeAll(): Promise<void> {
  if (!subscribed) return;

  const client = await getClient();
  if (subscribedAccounts.length > 0) {
    await client.request({ command: "unsubscribe", accounts: subscribedAccounts });
  }
  listeners.clear();
  subscribedAccounts = [];
  subscribed = false;
}

export { type EventType, type EventCallback };
