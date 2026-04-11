import { createHash } from "crypto";

export interface MerkleNode {
  hash: string;
  left?: MerkleNode;
  right?: MerkleNode;
}

export interface MerkleTree {
  root: string;
  leaves: string[];
  chunkSize: number;
}

function hashBuffer(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

function hashPair(a: string, b: string): string {
  return createHash("sha256").update(a).update(b).digest("hex");
}

export function chunkBuffer(data: Buffer, chunkSize: number): Buffer[] {
  if (chunkSize <= 0) throw new Error("chunkSize must be positive");
  const chunks: Buffer[] = [];
  for (let i = 0; i < data.length; i += chunkSize) {
    chunks.push(data.subarray(i, Math.min(i + chunkSize, data.length)));
  }
  return chunks.length > 0 ? chunks : [Buffer.alloc(0)];
}

export function buildMerkleTree(data: Buffer, chunkSize: number = 64 * 1024): MerkleTree {
  const chunks = chunkBuffer(data, chunkSize);
  const leaves = chunks.map(hashBuffer);

  if (leaves.length === 1) {
    return { root: leaves[0], leaves, chunkSize };
  }

  let level = [...leaves];
  while (level.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = i + 1 < level.length ? level[i + 1] : left;
      next.push(hashPair(left, right));
    }
    level = next;
  }

  return { root: level[0], leaves, chunkSize };
}

export function verifyRoot(data: Buffer, expectedRoot: string, chunkSize: number): boolean {
  const tree = buildMerkleTree(data, chunkSize);
  return tree.root === expectedRoot;
}
