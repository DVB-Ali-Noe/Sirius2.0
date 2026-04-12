import { createHash } from "crypto";

export interface WatermarkSeed {
  borrower: string;
  loanId: string;
  datasetId: string;
  seed: string;
}

export interface WatermarkReport {
  seed: string;
  totalRows: number;
  modifiedRows: number;
  modifiedIndices: number[];
  method: "numeric-perturbation" | "synonym-shift" | "field-injection";
}

export function generateSeed(borrower: string, loanId: string, datasetId: string): WatermarkSeed {
  const seed = createHash("sha256")
    .update(borrower)
    .update("|")
    .update(loanId)
    .update("|")
    .update(datasetId)
    .digest("hex");

  return { borrower, loanId, datasetId, seed };
}

function seededRandom(seed: string, index: number): number {
  const h = createHash("sha256")
    .update(seed)
    .update(String(index))
    .digest();
  return h.readUInt32BE(0) / 0x100000000;
}

function pickIndices(seed: string, totalRows: number, count: number): number[] {
  const picked = new Set<number>();
  let attempts = 0;
  const max = Math.min(count, totalRows);
  while (picked.size < max && attempts < max * 10) {
    const r = seededRandom(seed, attempts);
    const idx = Math.floor(r * totalRows);
    picked.add(idx);
    attempts++;
  }
  return [...picked].sort((a, b) => a - b);
}

function applyRowWatermark(row: unknown, seed: string, index: number): unknown {
  if (row === null || typeof row !== "object") return row;

  const clone = Array.isArray(row) ? [...row] : { ...(row as Record<string, unknown>) };
  const entries = Object.entries(clone as Record<string, unknown>);

  for (const [key, value] of entries) {
    if (typeof value === "number") {
      const base = Math.round(value * 1e6) / 1e6;
      const noise = (seededRandom(seed, index * 31 + key.length) - 0.5) * 1e-6;
      (clone as Record<string, unknown>)[key] = base + noise;
      return clone;
    }
  }

  for (const [key, value] of entries) {
    if (typeof value === "string" && value.length > 0) {
      const marker = "\u200B";
      const pos = Math.floor(seededRandom(seed, index * 53) * value.length);
      (clone as Record<string, unknown>)[key] = value.slice(0, pos) + marker + value.slice(pos);
      return clone;
    }
  }

  (clone as Record<string, unknown>).__wm = seed.slice(0, 8);
  return clone;
}

export function applyWatermark(
  rows: unknown[],
  seed: WatermarkSeed,
  fraction: number = 0.01
): { rows: unknown[]; report: WatermarkReport } {
  const count = Math.max(1, Math.floor(rows.length * fraction));
  const indices = pickIndices(seed.seed, rows.length, count);

  const out = [...rows];
  for (const idx of indices) {
    out[idx] = applyRowWatermark(out[idx], seed.seed, idx);
  }

  return {
    rows: out,
    report: {
      seed: seed.seed,
      totalRows: rows.length,
      modifiedRows: indices.length,
      modifiedIndices: indices,
      method: "numeric-perturbation",
    },
  };
}

export function detectWatermark(
  suspectRows: unknown[],
  candidateSeeds: WatermarkSeed[]
): WatermarkSeed | null {
  for (const candidate of candidateSeeds) {
    const fraction = 0.01;
    const count = Math.max(1, Math.floor(suspectRows.length * fraction));
    const indices = pickIndices(candidate.seed, suspectRows.length, count);

    let matches = 0;
    for (const idx of indices) {
      const row = suspectRows[idx];
      if (row && typeof row === "object" && isWatermarkedRow(row, candidate.seed, idx)) {
        matches++;
      }
    }

    if (matches >= Math.max(1, Math.floor(indices.length * 0.5))) {
      return candidate;
    }
  }
  return null;
}

function stripRow(row: unknown): unknown {
  if (!row || typeof row !== "object") return row;
  const record = row as Record<string, unknown>;
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (key === "__wm") continue;
    if (typeof value === "number") {
      clean[key] = Math.round(value * 1e6) / 1e6;
    } else if (typeof value === "string") {
      clean[key] = value.replace(/\u200B/g, "");
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

function isWatermarkedRow(row: unknown, seed: string, index: number): boolean {
  const cleaned = stripRow(row);
  const reWatermarked = applyRowWatermark(cleaned, seed, index);
  return JSON.stringify(reWatermarked) === JSON.stringify(row);
}
