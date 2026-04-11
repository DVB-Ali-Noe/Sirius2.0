import { createHash } from "crypto";

/**
 * Boundless ZK Proof — PLACEHOLDER / MOCK
 *
 * This module is intentionally a mocked stand-in for Boundless ZK proofs.
 * The real Boundless integration will live here. Keep the interface stable
 * so that swapping this out for the real SDK does not require rewiring
 * the upload pipeline.
 *
 * Replace generateQualityProof / verifyQualityProof with real Boundless
 * calls when the SDK is integrated.
 */

export interface QualityAssertions {
  entryCount: number;
  duplicateRate: string;
  schema: string;
  schemaHash: string;
  languages?: string[];
  temporalRange?: { from: string; to: string };
  toxicityRate?: string;
}

export interface BoundlessProof {
  version: "mock-v1";
  proofId: string;
  assertions: QualityAssertions;
  commitment: string;
  generatedAt: number;
  verifierUri: string;
}

function commitAssertions(datasetDigest: string, a: QualityAssertions): string {
  return createHash("sha256")
    .update(datasetDigest)
    .update(JSON.stringify(a))
    .digest("hex");
}

export function generateQualityProof(
  datasetDigest: string,
  assertions: QualityAssertions
): BoundlessProof {
  const commitment = commitAssertions(datasetDigest, assertions);
  const proofId = `boundless-mock-${commitment.slice(0, 16)}`;

  return {
    version: "mock-v1",
    proofId,
    assertions,
    commitment,
    generatedAt: Date.now(),
    verifierUri: `boundless://mock/${proofId}`,
  };
}

export function verifyQualityProof(
  proof: BoundlessProof,
  datasetDigest: string
): { valid: boolean; reason?: string } {
  if (proof.version !== "mock-v1") {
    return { valid: false, reason: "unsupported proof version" };
  }
  const expected = commitAssertions(datasetDigest, proof.assertions);
  if (expected !== proof.commitment) {
    return { valid: false, reason: "commitment mismatch" };
  }
  return { valid: true };
}

export function computeDatasetDigest(rows: unknown[], schema: string): string {
  return createHash("sha256")
    .update(schema)
    .update(String(rows.length))
    .update(JSON.stringify(rows.slice(0, 32)))
    .digest("hex");
}

export function inferAssertions(rows: unknown[], schema: string): QualityAssertions {
  const seen = new Set<string>();
  let duplicates = 0;
  for (const row of rows) {
    const sig = createHash("sha1").update(JSON.stringify(row)).digest("hex");
    if (seen.has(sig)) duplicates++;
    else seen.add(sig);
  }

  const duplicateRate =
    rows.length === 0 ? "0%" : `${((duplicates / rows.length) * 100).toFixed(2)}%`;

  const schemaHash = createHash("sha256").update(schema).digest("hex").slice(0, 32);

  return {
    entryCount: rows.length,
    duplicateRate,
    schema,
    schemaHash: `0x${schemaHash}`,
  };
}
