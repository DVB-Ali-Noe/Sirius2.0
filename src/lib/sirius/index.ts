export {
  encrypt,
  decrypt,
  generateMasterKey,
  encodeKey,
  decodeKey,
  type EncryptedPayload,
} from "./encryption";

export {
  buildMerkleTree,
  chunkBuffer,
  verifyRoot,
  type MerkleTree,
} from "./merkle";

export {
  pinJson,
  pinBuffer,
  fetchFromIpfs,
  isPinataConfigured,
  type PinResult,
} from "./ipfs";

export {
  generateSeed,
  applyWatermark,
  detectWatermark,
  type WatermarkSeed,
  type WatermarkReport,
} from "./watermark";

export {
  generateQualityProof,
  verifyQualityProof,
  computeDatasetDigest,
  inferAssertions,
  type BoundlessProof,
  type QualityAssertions,
} from "./boundless";

export {
  issueBorrowerKey,
  revokeByLoan,
  getKey,
  getKeyByLoan,
  isKeyValid,
  listKeys,
  purgeExpired,
  type BorrowerKey,
  type IssueParams,
} from "./key-store";

export {
  registerDataset,
  attachMpt,
  attachVault,
  getDataset,
  getByMpt,
  listDatasets,
  type DatasetRecord,
  type DatasetDescription,
  type EncryptedDatasetManifest,
} from "./dataset-registry";

export {
  ingestDataset,
  decryptDatasetWithKey,
  type IngestInput,
  type IngestResult,
} from "./pipeline";
