import { NextRequest, NextResponse } from "next/server";
import { getClient } from "@/lib/xrpl";
import { apiError, validationError } from "@/lib/api-utils";

interface OnChainDataset {
  mptIssuanceId: string;
  name: string;
  category: string;
  ipfs: string;
  entryCount: number;
  duplicateRate: string;
  qualityScore: number;
  schema: string;
  zkProof: string;
  createdAt: number;
}

export const maxDuration = 120;

export async function GET(request: NextRequest) {
  try {
    const address = request.nextUrl.searchParams.get("address");
    if (!address) return validationError("address");

    const client = await getClient();

    const res = await client.request({
      command: "account_objects",
      account: address,
    });

    const allObjects = (res.result as unknown as { account_objects: Array<Record<string, unknown>> }).account_objects;
    const mpts = allObjects.filter((o) => o.LedgerEntryType === "MPTokenIssuance");

    const datasets: OnChainDataset[] = [];

    for (const mpt of mpts) {
      const metaHex = mpt.MPTokenMetadata as string | undefined;
      if (!metaHex) continue;

      try {
        const meta = JSON.parse(Buffer.from(metaHex, "hex").toString("utf-8"));
        datasets.push({
          mptIssuanceId: mpt.mpt_issuance_id as string,
          name: meta.n ?? "Unknown",
          category: meta.ac ?? "defi",
          ipfs: meta.ipfs ?? "",
          entryCount: meta.qc?.entryCount ?? 0,
          duplicateRate: meta.qc?.duplicateRate ?? "0%",
          qualityScore: meta.qc?.qualityScore ?? 0,
          schema: meta.schema ?? "",
          zkProof: meta.zk ?? "",
          createdAt: meta.qc?.certifiedAt ?? 0,
        });
      } catch {}
    }

    datasets.sort((a, b) => b.createdAt - a.createdAt);

    return NextResponse.json({ datasets, count: datasets.length });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("Account not found") || msg.includes("actNotFound")) {
      return NextResponse.json({ datasets: [], count: 0 });
    }
    return apiError(error);
  }
}
