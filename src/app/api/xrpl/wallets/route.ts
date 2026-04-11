import { NextRequest, NextResponse } from "next/server";
import { getDemoWallets } from "@/lib/xrpl";
import { requireAuth, apiError } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  const authErr = requireAuth(request);
  if (authErr) return authErr;

  try {
    const { provider, borrower, loanBroker } = getDemoWallets();

    return NextResponse.json({
      provider: provider.classicAddress,
      borrower: borrower.classicAddress,
      loanBroker: loanBroker.classicAddress,
    });
  } catch (error) {
    return apiError(error);
  }
}
