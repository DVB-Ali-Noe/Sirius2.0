import { writeFileSync } from "fs";
import { createHash } from "crypto";
import { join } from "path";

interface Row {
  id: number;
  instruction: string;
  response: string;
  category: string;
  difficulty: string;
  score: number;
  language: string;
  source: string;
}

const CATEGORIES = ["reasoning", "coding", "math", "knowledge", "writing", "analysis", "creative"];
const DIFFICULTIES = ["easy", "medium", "hard"];
const LANGUAGES = ["en"];
const SOURCES = ["human", "synthetic", "augmented"];

function generateRow(i: number, addDefects: boolean): Partial<Row> {
  const row: Partial<Row> = {
    id: i,
    instruction: `Given a ${CATEGORIES[i % CATEGORIES.length]} task about topic #${i}, explain the key concepts and provide a step-by-step solution.`,
    response: `Here is a detailed explanation for task #${i}. The main concepts involve ${CATEGORIES[i % CATEGORIES.length]} principles applied to scenario ${Math.floor(i / 10)}.`,
    category: CATEGORIES[i % CATEGORIES.length],
    difficulty: DIFFICULTIES[i % DIFFICULTIES.length],
    score: Math.round((0.7 + (i % 30) / 100) * 1000) / 1000,
    language: LANGUAGES[0],
    source: SOURCES[i % SOURCES.length],
  };

  if (addDefects) {
    const defectType = i % 5;
    if (defectType === 0) row.instruction = "";
    if (defectType === 1) row.response = undefined as unknown as string;
    if (defectType === 2) row.score = undefined as unknown as number;
    if (defectType === 3) row.language = "";
    if (defectType === 4) delete row.source;
  }

  return row;
}

// Tier 1 — Premium: 1000 rows, 0 doublons, 100% complet
function generateTier1(): Row[] {
  const rows: Row[] = [];
  for (let i = 0; i < 1000; i++) {
    rows.push(generateRow(i, false) as Row);
  }
  return rows;
}

// Tier 2 — Standard: 500 rows, ~2% doublons, 98% complet
function generateTier2(): Partial<Row>[] {
  const rows: Partial<Row>[] = [];
  for (let i = 0; i < 490; i++) {
    rows.push(generateRow(i, i % 50 === 0) as Row);
  }
  for (let i = 0; i < 10; i++) {
    rows.push(generateRow(i, false) as Row);
  }
  return rows;
}

// Tier 3 — Low quality: 200 rows, ~10% doublons, champs vides
function generateTier3(): Partial<Row>[] {
  const rows: Partial<Row>[] = [];
  for (let i = 0; i < 180; i++) {
    rows.push(generateRow(i, i % 4 === 0));
  }
  for (let i = 0; i < 20; i++) {
    rows.push(generateRow(i % 10, false) as Row);
  }
  return rows;
}

const dir = new URL(".", import.meta.url).pathname;

const tier1 = generateTier1();
const tier2 = generateTier2();
const tier3 = generateTier3();

writeFileSync(join(dir, "tier1-premium.json"), JSON.stringify(tier1, null, 2));
writeFileSync(join(dir, "tier2-standard.json"), JSON.stringify(tier2, null, 2));
writeFileSync(join(dir, "tier3-lowquality.json"), JSON.stringify(tier3, null, 2));

console.log(`Tier 1: ${tier1.length} rows, hash: ${createHash("sha256").update(JSON.stringify(tier1)).digest("hex").slice(0, 16)}`);
console.log(`Tier 2: ${tier2.length} rows, hash: ${createHash("sha256").update(JSON.stringify(tier2)).digest("hex").slice(0, 16)}`);
console.log(`Tier 3: ${tier3.length} rows, hash: ${createHash("sha256").update(JSON.stringify(tier3)).digest("hex").slice(0, 16)}`);
