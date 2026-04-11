import { NextResponse } from "next/server";
import { getDemoWallets } from "@/lib/xrpl";
import { subscribeToAccounts, onXRPLEvent, type EventType } from "@/lib/xrpl/events";

const eventLog: Array<{ type: string; timestamp: number; data: unknown }> = [];
let initialized = false;

async function initEventListeners() {
  if (initialized) return;

  const { provider, borrower, loanBroker } = getDemoWallets();

  await subscribeToAccounts([
    provider.classicAddress,
    borrower.classicAddress,
    loanBroker.classicAddress,
  ]);

  const trackedEvents: EventType[] = [
    "MPTokenAuthorize",
    "VaultDeposit",
    "VaultWithdraw",
    "LoanSet",
    "LoanDelete",
    "Payment",
  ];

  for (const eventType of trackedEvents) {
    onXRPLEvent(eventType, (tx) => {
      eventLog.push({
        type: eventType,
        timestamp: Date.now(),
        data: {
          hash: tx.tx_json?.hash,
          account: tx.tx_json?.Account,
        },
      });
      if (eventLog.length > 100) eventLog.shift();
    });
  }

  initialized = true;
}

export async function GET() {
  await initEventListeners();

  return NextResponse.json({ events: eventLog });
}
