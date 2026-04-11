import { randomBytes } from "crypto";
import { encrypt, decrypt, generateMasterKey, encodeKey, decodeKey } from "./encryption";
import { buildMerkleTree, chunkBuffer } from "./merkle";
import { pinJson, fetchFromIpfs, type PinResult } from "./ipfs";
import {
  generateQualityProof,
  computeDatasetDigest,
  inferAssertions,
  type BoundlessProof,
} from "./boundless";
import {
  registerDataset,
  type DatasetDescription,
  type DatasetRecord,
  type EncryptedDatasetManifest,
} from "./dataset-registry";

export interface IngestInput {
  providerAddress: string;
  description: DatasetDescription;
  rows: unknown[];
  schema: string;
  version?: string;
  chunkSize?: number;
}

export interface IngestResult {
  datasetId: string;
  manifestCid: string;
  merkleRoot: string;
  boundlessProof: BoundlessProof;
  entryCount: number;
  masterKeyEncoded: string;
  pin: PinResult;
}

export async function ingestDataset(input: IngestInput): Promise<IngestResult> {
  if (!Array.isArray(input.rows) || input.rows.length === 0) {
    throw new Error("rows must be a non-empty array");
  }

  const chunkSize = input.chunkSize ?? 64 * 1024;
  const serialized = Buffer.from(
    input.rows.map((r) => JSON.stringify(r)).join("\n"),
    "utf8"
  );

  const masterKey = generateMasterKey();
  const chunks = chunkBuffer(serialized, chunkSize);
  const encryptedChunks = chunks.map((chunk, index) => {
    const payload = encrypt(chunk, masterKey);
    return {
      index,
      iv: payload.iv,
      tag: payload.tag,
      ciphertext: payload.ciphertext,
    };
  });

  const merkle = buildMerkleTree(serialized, chunkSize);

  const manifest: EncryptedDatasetManifest = {
    version: "sirius-v1",
    chunks: encryptedChunks,
    merkleRoot: merkle.root,
    chunkSize,
    totalBytes: serialized.length,
  };

  const datasetId = `ds_${randomBytes(8).toString("hex")}`;
  const pin = await pinJson(manifest, `${datasetId}.manifest.json`);

  const digest = computeDatasetDigest(input.rows, input.schema);
  const assertions = inferAssertions(input.rows, input.schema);
  const boundlessProof = generateQualityProof(digest, assertions);

  const record: DatasetRecord = {
    datasetId,
    providerAddress: input.providerAddress,
    description: input.description,
    manifestCid: pin.cid,
    merkleRoot: merkle.root,
    entryCount: input.rows.length,
    schemaHash: assertions.schemaHash,
    boundlessProof,
    masterKeyEncoded: encodeKey(masterKey),
    version: input.version ?? `${new Date().toISOString().slice(0, 10)}-v1`,
    createdAt: Date.now(),
  };

  registerDataset(record);

  return {
    datasetId,
    manifestCid: pin.cid,
    merkleRoot: merkle.root,
    boundlessProof,
    entryCount: input.rows.length,
    masterKeyEncoded: record.masterKeyEncoded,
    pin,
  };
}

export async function decryptDatasetWithKey(
  manifestCid: string,
  encodedKey: string
): Promise<unknown[]> {
  const raw = await fetchFromIpfs(manifestCid);
  const manifest = JSON.parse(raw.toString("utf8")) as EncryptedDatasetManifest;

  if (manifest.version !== "sirius-v1") {
    throw new Error(`Unsupported manifest version: ${manifest.version}`);
  }

  const key = decodeKey(encodedKey);
  const buffers: Buffer[] = [];

  const ordered = [...manifest.chunks].sort((a, b) => a.index - b.index);
  for (const c of ordered) {
    const plaintext = decrypt(
      { iv: c.iv, tag: c.tag, ciphertext: c.ciphertext },
      key
    );
    buffers.push(plaintext);
  }

  const full = Buffer.concat(buffers).toString("utf8");
  if (full.length === 0) return [];

  return full
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line));
}
