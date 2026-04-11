import { NextRequest, NextResponse } from "next/server";
import { getKeyByLoan, isKeyValid, listKeys, purgeExpired } from "@/lib/sirius";
import { requireAuth, apiError } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  const authErr = requireAuth(request);
  if (authErr) return authErr;

  try {
    purgeExpired();

    const loanId = request.nextUrl.searchParams.get("loanId");

    if (!loanId) {
      const all = listKeys().map((k) => ({
        keyId: k.keyId,
        borrower: k.borrower,
        loanId: k.loanId,
        datasetId: k.datasetId,
        issuedAt: k.issuedAt,
        expiresAt: k.expiresAt,
        revoked: k.revoked,
        revokedReason: k.revokedReason,
      }));
      return NextResponse.json({ keys: all });
    }

    const key = getKeyByLoan(loanId);
    if (!key) {
      return NextResponse.json({ error: "No key for this loan" }, { status: 404 });
    }

    const validation = isKeyValid(key.keyId);

    return NextResponse.json({
      keyId: key.keyId,
      borrower: key.borrower,
      loanId: key.loanId,
      datasetId: key.datasetId,
      issuedAt: key.issuedAt,
      expiresAt: key.expiresAt,
      revoked: key.revoked,
      revokedAt: key.revokedAt,
      revokedReason: key.revokedReason,
      valid: validation.valid,
      reason: validation.reason,
    });
  } catch (error) {
    return apiError(error);
  }
}
