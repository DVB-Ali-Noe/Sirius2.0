import {
  Wallet,
  MPTokenIssuanceCreate,
  MPTokenIssuanceCreateFlags,
  MPTokenAuthorize,
} from "xrpl";
import type { MPTokenIssuanceCreateMetadata } from "xrpl/dist/npm/models/transactions/MPTokenIssuanceCreate";
import { getClient } from "./client";

export interface DatasetDescription {
  name: string;
  description: string;
  category: "instruction-tuning" | "rlhf" | "medical" | "financial" | "legal" | "code" | "embeddings" | "other";
  language: string;
  format: string;
  sampleFields?: string[];
}

export interface DatasetMetadata {
  dataset: DatasetDescription;
  ipfsHash: string;
  zkProofRef: string;
  schemaHash: string;
  qualityCertificate: {
    entryCount: number;
    duplicateRate: string;
    schema: string;
    certifiedAt: number;
  };
  version: string;
}

export async function mintDatasetMPT(
  issuer: Wallet,
  metadata: DatasetMetadata
): Promise<{ mptIssuanceId: string }> {
  const client = await getClient();

  const metadataHex = Buffer.from(JSON.stringify(metadata)).toString("hex");

  const tx: MPTokenIssuanceCreate = {
    TransactionType: "MPTokenIssuanceCreate",
    Account: issuer.classicAddress,
    MaximumAmount: "1",
    AssetScale: 0,
    MPTokenMetadata: metadataHex,
    Flags: {
      tfMPTCanTransfer: true,
      tfMPTRequireAuth: true,
    },
  };

  const result = await client.submitAndWait(tx, { wallet: issuer });

  const meta = result.result.meta as MPTokenIssuanceCreateMetadata;
  const mptIssuanceId = meta.mpt_issuance_id;

  if (!mptIssuanceId) {
    throw new Error("MPT minting failed: no issuance ID in metadata");
  }

  return { mptIssuanceId };
}

export async function authorizeMPTHolder(
  issuer: Wallet,
  mptIssuanceId: string,
  holderAddress: string
): Promise<void> {
  const client = await getClient();

  const tx: MPTokenAuthorize = {
    TransactionType: "MPTokenAuthorize",
    Account: issuer.classicAddress,
    MPTokenIssuanceID: mptIssuanceId,
    Holder: holderAddress,
  };

  await client.submitAndWait(tx, { wallet: issuer });
}

export async function holderOptInMPT(
  holder: Wallet,
  mptIssuanceId: string
): Promise<void> {
  const client = await getClient();

  const tx: MPTokenAuthorize = {
    TransactionType: "MPTokenAuthorize",
    Account: holder.classicAddress,
    MPTokenIssuanceID: mptIssuanceId,
  };

  await client.submitAndWait(tx, { wallet: holder });
}
