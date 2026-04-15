import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const DATA_DIR = join(process.cwd(), ".sirius-data");

try { mkdirSync(DATA_DIR, { recursive: true }); } catch {}

function filePath(name: string): string {
  return join(DATA_DIR, `${name}.json`);
}

export function loadStore<V>(name: string): Map<string, V> {
  try {
    const raw = readFileSync(filePath(name), "utf-8");
    const entries: [string, V][] = JSON.parse(raw);
    return new Map(entries);
  } catch {
    return new Map();
  }
}

export function saveStore<V>(name: string, map: Map<string, V>): void {
  try {
    writeFileSync(filePath(name), JSON.stringify([...map.entries()]), "utf-8");
  } catch (e) {
    console.warn(`[persistence] Failed to save ${name}:`, (e as Error).message);
  }
}
