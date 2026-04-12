use risc0_zkvm::guest::env;
use serde::Deserialize;
use sha2::{Digest, Sha256};
use std::collections::HashSet;
use std::io::Read;

// Journal format (58 bytes, fixed layout):
// [0]      quality_score: u8
// [1..9]   entry_count: u64 BE
// [9..17]  duplicate_count: u64 BE
// [17]     schema_valid: u8 (0 or 1)
// [18..26] field_completeness: u64 BE (scaled by 10000, e.g. 9850 = 98.50%)
// [26..58] dataset_hash: [u8; 32]
pub const JOURNAL_SIZE: usize = 58;

#[derive(Deserialize)]
struct DatasetInput {
    schema_fields: Vec<String>,
    rows: Vec<serde_json::Value>,
}

fn main() {
    let mut input_bytes = Vec::new();
    env::stdin().read_to_end(&mut input_bytes).expect("failed to read input from stdin");

    let input: DatasetInput = serde_json::from_slice(&input_bytes).expect("failed to parse dataset JSON");
    let rows = &input.rows;
    let schema = &input.schema_fields;

    let entry_count = rows.len() as u64;

    let mut hasher = Sha256::new();
    hasher.update(&input_bytes);
    let dataset_hash: [u8; 32] = hasher.finalize().into();

    let mut seen = HashSet::new();
    let mut duplicate_count: u64 = 0;
    for row in rows {
        let row_str = serde_json::to_string(row).expect("failed to serialize row");
        if !seen.insert(row_str) {
            duplicate_count += 1;
        }
    }
    let duplicate_rate = if entry_count > 0 {
        duplicate_count as f64 / entry_count as f64
    } else {
        0.0
    };

    let mut schema_violations = 0u64;
    let mut empty_fields = 0u64;
    let mut total_fields = 0u64;

    for row in rows {
        let obj = match row.as_object() {
            Some(o) => o,
            None => {
                schema_violations += 1;
                continue;
            }
        };

        for field in schema {
            total_fields += 1;
            match obj.get(field) {
                None => {
                    schema_violations += 1;
                    empty_fields += 1;
                }
                Some(v) => {
                    if v.is_null() || (v.is_string() && v.as_str().unwrap_or("").is_empty()) {
                        empty_fields += 1;
                    }
                }
            }
        }
    }

    let schema_valid = schema_violations == 0;
    let field_completeness = if total_fields > 0 {
        1.0 - (empty_fields as f64 / total_fields as f64)
    } else {
        0.0
    };

    let mut score: u8 = 0;

    if entry_count >= 1000 {
        score += 30;
    } else if entry_count >= 500 {
        score += 20;
    } else if entry_count >= 100 {
        score += 10;
    }

    if duplicate_rate < 0.001 {
        score += 30;
    } else if duplicate_rate < 0.01 {
        score += 25;
    } else if duplicate_rate < 0.05 {
        score += 15;
    } else if duplicate_rate < 0.1 {
        score += 5;
    }

    if schema_valid {
        score += 20;
    }

    score += (field_completeness * 20.0) as u8;

    if score > 100 {
        score = 100;
    }

    // Build fixed-size journal (58 bytes)
    let completeness_scaled = (field_completeness * 10000.0) as u64;

    let mut journal = [0u8; JOURNAL_SIZE];
    journal[0] = score;
    journal[1..9].copy_from_slice(&entry_count.to_be_bytes());
    journal[9..17].copy_from_slice(&duplicate_count.to_be_bytes());
    journal[17] = if schema_valid { 1 } else { 0 };
    journal[18..26].copy_from_slice(&completeness_scaled.to_be_bytes());
    journal[26..58].copy_from_slice(&dataset_hash);

    env::commit_slice(&journal);
}
