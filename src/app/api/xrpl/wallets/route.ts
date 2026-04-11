import { NextResponse } from "next/server";
import { getDemoWallets } from "@/lib/xrpl";

export async function GET() {
  const { provider, borrower, loanBroker } = getDemoWallets();

  return NextResponse.json({
    provider: provider.classicAddress,
    borrower: borrower.classicAddress,
    loanBroker: loanBroker.classicAddress,
  });
}
