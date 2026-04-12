import type { BoundlessProof } from "./boundless";
import type { DatasetDescription } from "@/lib/xrpl/mpt";

export type { DatasetDescription };

export interface EncryptedDatasetManifest {
  version: "sirius-v1";
  chunks: Array<{
    index: number;
    iv: string;
    tag: string;
    ciphertext: string;
  }>;
  merkleRoot: string;
  chunkSize: number;
  totalBytes: number;
}

export interface DatasetRecord {
  datasetId: string;
  providerAddress: string;
  description: DatasetDescription;
  manifestCid: string;
  merkleRoot: string;
  entryCount: number;
  schemaHash: string;
  boundlessProof: BoundlessProof;
  masterKeyEncoded: string;
  version: string;
  createdAt: number;
  mptIssuanceId?: string;
  vaultId?: string;
}

const datasets = new Map<string, DatasetRecord>();
const byMpt = new Map<string, string>();

export function registerDataset(record: DatasetRecord): DatasetRecord {
  datasets.set(record.datasetId, record);
  if (record.mptIssuanceId) {
    byMpt.set(record.mptIssuanceId, record.datasetId);
  }
  return record;
}

export function attachMpt(datasetId: string, mptIssuanceId: string): DatasetRecord {
  const r = datasets.get(datasetId);
  if (!r) throw new Error(`Dataset ${datasetId} not found`);
  r.mptIssuanceId = mptIssuanceId;
  byMpt.set(mptIssuanceId, datasetId);
  return r;
}

export function attachVault(datasetId: string, vaultId: string): DatasetRecord {
  const r = datasets.get(datasetId);
  if (!r) throw new Error(`Dataset ${datasetId} not found`);
  r.vaultId = vaultId;
  return r;
}

export function getDataset(datasetId: string): DatasetRecord | undefined {
  return datasets.get(datasetId);
}

export function getByMpt(mptIssuanceId: string): DatasetRecord | undefined {
  const id = byMpt.get(mptIssuanceId);
  return id ? datasets.get(id) : undefined;
}

export function listDatasets(): DatasetRecord[] {
  return [...datasets.values()];
}
