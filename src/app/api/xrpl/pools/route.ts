import { NextResponse } from "next/server";
import { getClient, getLoanBroker } from "@/lib/xrpl";
import { apiError } from "@/lib/api-utils";

interface PoolInfo {
  vaultId: string;
  mptIssuanceId: string;
  loanBrokerId: string | null;
  dataset: {
    name: string;
    ipfs: string;
    category: string;
    qualityCertificate: Record<string, unknown>;
    qualityScore: number;
    zkProof: string;
    schema: string;
  } | null;
  issuer: string;
}

export async function GET() {
  try {
    const client = await getClient();
    const loanBroker = getLoanBroker();

    // Get all objects owned by loanbroker (vaults live here)
    const lbObjects = await client.request({
      command: "account_objects",
      account: loanBroker.classicAddress,
    });

    const allObjects = (lbObjects.result as unknown as { account_objects: Array<Record<string, unknown>> }).account_objects;
    const vaults = allObjects.filter((o) => o.LedgerEntryType === "Vault");
    const loanBrokers = allObjects.filter((o) => o.LedgerEntryType === "LoanBroker");

    // Map vault ID → LoanBroker ID
    const vaultToBroker = new Map<string, string>();
    for (const b of loanBrokers) {
      if (b.VaultID) vaultToBroker.set(b.VaultID as string, b.index as string);
    }

    const pools: PoolInfo[] = [];

    for (const vault of vaults) {
      const asset = vault.Asset as { mpt_issuance_id?: string };
      const mptId = asset?.mpt_issuance_id;
      if (!mptId) continue;

      // Fetch the MPT issuance from the ledger to get issuer + metadata
      let dataset: PoolInfo["dataset"] = null;
      let issuer = "";

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mptRes = await (client as any).request({
          command: "ledger_entry",
          mpt_issuance: mptId,
        });
        const node = mptRes.result.node as Record<string, unknown>;
        issuer = (node.Issuer as string) ?? "";

        if (node.MPTokenMetadata) {
          try {
            const meta = JSON.parse(
              Buffer.from(node.MPTokenMetadata as string, "hex").toString("utf-8")
            );
            dataset = {
              name: meta.n ?? "Unknown",
              ipfs: meta.ipfs ?? "",
              category: meta.ac ?? "",
              qualityCertificate: meta.qc ?? {},
              qualityScore: meta.qc?.qualityScore ?? 0,
              zkProof: meta.zk ?? "",
              schema: meta.schema ?? "",
            };
          } catch {}
        }
      } catch {}

      pools.push({
        vaultId: vault.index as string,
        mptIssuanceId: mptId,
        loanBrokerId: vaultToBroker.get(vault.index as string) ?? null,
        dataset,
        issuer,
      });
    }

    return NextResponse.json({ pools, count: pools.length });
  } catch (error) {
    return apiError(error);
  }
}
