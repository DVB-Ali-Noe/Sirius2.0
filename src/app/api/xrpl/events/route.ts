import { NextRequest, NextResponse } from "next/server";
import { getDemoWallets } from "@/lib/xrpl";
import { subscribeToAccounts, onXRPLEvent, type EventType } from "@/lib/xrpl/events";
import { requireAuth, apiError } from "@/lib/api-utils";

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

export async function GET(request: NextRequest) {
  const authErr = requireAuth(request);
  if (authErr) return authErr;

  try {
    await initEventListeners();
    return NextResponse.json({ events: eventLog });
  } catch (error) {
    return apiError(error);
  }
}
