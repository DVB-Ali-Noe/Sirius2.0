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
  pricePerDay?: string;
}

import { loadStore, saveStore } from "@/lib/persistence";

const g = globalThis as unknown as { __sirius_datasets?: Map<string, DatasetRecord>; __sirius_byMpt?: Map<string, string> };
const datasets: Map<string, DatasetRecord> = g.__sirius_datasets ?? loadStore<DatasetRecord>("datasets");
const byMpt: Map<string, string> = g.__sirius_byMpt ?? loadStore<string>("datasets-byMpt");
g.__sirius_datasets = datasets;
g.__sirius_byMpt = byMpt;

function persist() {
  saveStore("datasets", datasets);
  saveStore("datasets-byMpt", byMpt);
}

export function registerDataset(record: DatasetRecord): DatasetRecord {
  datasets.set(record.datasetId, record);
  if (record.mptIssuanceId) {
    byMpt.set(record.mptIssuanceId, record.datasetId);
  }
  persist();
  return record;
}

export function attachMpt(datasetId: string, mptIssuanceId: string): DatasetRecord {
  const r = datasets.get(datasetId);
  if (!r) throw new Error(`Dataset ${datasetId} not found`);
  r.mptIssuanceId = mptIssuanceId;
  byMpt.set(mptIssuanceId, datasetId);
  persist();
  return r;
}

export function attachVault(datasetId: string, vaultId: string): DatasetRecord {
  const r = datasets.get(datasetId);
  if (!r) throw new Error(`Dataset ${datasetId} not found`);
  r.vaultId = vaultId;
  persist();
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

export function unregisterDataset(datasetId: string): boolean {
  const record = datasets.get(datasetId);
  if (!record) return false;
  if (record.mptIssuanceId) byMpt.delete(record.mptIssuanceId);
  datasets.delete(datasetId);
  persist();
  return true;
}

export function clearAllDatasets(): number {
  const count = datasets.size;
  datasets.clear();
  byMpt.clear();
  persist();
  return count;
}
