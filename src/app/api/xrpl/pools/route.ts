import { NextResponse } from "next/server";
import { getClient, getLoanBroker } from "@/lib/xrpl";
import { apiError } from "@/lib/api-utils";

interface PoolInfo {
  vaultId: string;
  vaultName: string | null;
  pricePerDay: string | null;
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
    pricePerDay: string | null;
  } | null;
  issuer: string;
  ledgerSeq: number;
}

function decodeVaultData(dataHex: unknown): { name: string | null; pricePerDay: string | null } {
  if (typeof dataHex !== "string" || dataHex.length === 0) {
    return { name: null, pricePerDay: null };
  }
  try {
    const raw = Buffer.from(dataHex, "hex").toString("utf-8");
    try {
      const parsed = JSON.parse(raw) as { name?: string; pricePerDay?: string };
      return {
        name: parsed.name ?? null,
        pricePerDay: parsed.pricePerDay ?? null,
      };
    } catch {
      return { name: raw, pricePerDay: null };
    }
  } catch {
    return { name: null, pricePerDay: null };
  }
}

export async function GET() {
  try {
    const client = await getClient();
    const loanBroker = getLoanBroker();

    // Query both admin and old loanBroker accounts for vaults
    const accounts = [loanBroker.classicAddress];
    const oldLoanBroker = process.env.NEXT_PUBLIC_LOANBROKER_ADDRESS;
    if (oldLoanBroker && oldLoanBroker !== loanBroker.classicAddress) {
      accounts.push(oldLoanBroker);
    }

    const allObjects: Array<Record<string, unknown>> = [];
    for (const acct of accounts) {
      try {
        const res = await client.request({ command: "account_objects", account: acct });
        const objs = (res.result as unknown as { account_objects: Array<Record<string, unknown>> }).account_objects;
        allObjects.push(...objs);
      } catch {}
    }

    const vaults = allObjects.filter((o) => o.LedgerEntryType === "Vault");
    const loanBrokers = allObjects.filter((o) => o.LedgerEntryType === "LoanBroker");

    // Map vault ID → LoanBroker ID
    const vaultToBroker = new Map<string, string>();
    for (const b of loanBrokers) {
      if (b.VaultID) vaultToBroker.set(b.VaultID as string, b.index as string);
    }

    // Pre-fetch MPT metadata: collect unique issuers from vault MPT IDs, then batch-load their MPTokenIssuances
    const mptIdSet = new Set<string>();
    for (const vault of vaults) {
      const mptId = (vault.Asset as { mpt_issuance_id?: string })?.mpt_issuance_id;
      if (mptId) mptIdSet.add(mptId);
    }

    // Build MPT metadata map by trying ledger_entry for each, with fallback
    const mptDataMap = new Map<string, { issuer: string; meta: Record<string, unknown> | null }>();
    for (const mptId of mptIdSet) {
      // Try ledger_entry first
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mptRes = await (client as any).request({ command: "ledger_entry", mpt_issuance: mptId });
        const node = mptRes.result.node as Record<string, unknown>;
        let meta: Record<string, unknown> | null = null;
        if (node.MPTokenMetadata) {
          try { meta = JSON.parse(Buffer.from(node.MPTokenMetadata as string, "hex").toString("utf-8")); } catch {}
        }
        mptDataMap.set(mptId, { issuer: (node.Issuer as string) ?? "", meta });
      } catch {
        // Fallback: try with object format
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const mptRes = await (client as any).request({ command: "ledger_entry", mpt_issuance: { mpt_issuance_id: mptId } });
          const node = mptRes.result.node as Record<string, unknown>;
          let meta: Record<string, unknown> | null = null;
          if (node.MPTokenMetadata) {
            try { meta = JSON.parse(Buffer.from(node.MPTokenMetadata as string, "hex").toString("utf-8")); } catch {}
          }
          mptDataMap.set(mptId, { issuer: (node.Issuer as string) ?? "", meta });
        } catch {
          mptDataMap.set(mptId, { issuer: "", meta: null });
        }
      }
    }

    const pools: PoolInfo[] = [];

    for (const vault of vaults) {
      const asset = vault.Asset as { mpt_issuance_id?: string };
      const mptId = asset?.mpt_issuance_id;
      if (!mptId) continue;

      const { name: vaultName, pricePerDay: vaultPricePerDay } = decodeVaultData(vault.Data);

      const mptData = mptDataMap.get(mptId);
      const meta = mptData?.meta as Record<string, unknown> | null | undefined;
      const issuer = mptData?.issuer ?? "";
      const qc = meta?.qc as Record<string, unknown> | undefined;

      let dataset: PoolInfo["dataset"] = null;
      if (meta) {
        dataset = {
          name: (meta.n as string) ?? "Unknown",
          ipfs: (meta.ipfs as string) ?? "",
          category: (meta.ac as string) ?? "",
          qualityCertificate: qc ?? {},
          qualityScore: (qc?.qualityScore as number) || (qc?.score as number) || ((qc?.entryCount as number) > 0 ? 92 : 0),
          zkProof: (meta.zk as string) ?? "",
          schema: (meta.schema as string) ?? "",
          pricePerDay: (qc?.ppd as string) ?? (meta.ppd as string) ?? null,
        };
      }

      // Skip vaults whose MPT was destroyed (no metadata = ghost vault)
      if (!dataset) continue;

      pools.push({
        vaultId: vault.index as string,
        vaultName: vaultName ?? dataset.name ?? null,
        pricePerDay: vaultPricePerDay ?? dataset.pricePerDay ?? null,
        mptIssuanceId: mptId,
        loanBrokerId: vaultToBroker.get(vault.index as string) ?? null,
        dataset,
        issuer,
        ledgerSeq: Number(vault.PreviousTxnLgrSeq ?? 0),
      });
    }

    pools.sort((a, b) => b.ledgerSeq - a.ledgerSeq);

    return NextResponse.json({ pools, count: pools.length });
  } catch (error) {
    return apiError(error);
  }
}
