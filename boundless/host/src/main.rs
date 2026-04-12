use clap::Parser;
use methods::{DATASET_CERTIFIER_ELF, DATASET_CERTIFIER_ID};
use risc0_zkvm::{default_prover, ExecutorEnv};
use serde::Serialize;
use std::fs;

#[derive(Parser)]
struct Args {
    #[arg(short, long)]
    dataset: String,

    #[arg(short, long, default_value = "id,instruction,response,category,difficulty,score,language,source")]
    schema: String,

    #[arg(short, long, default_value = "receipt.json")]
    output: String,
}

#[derive(Serialize, Debug)]
struct QualityCertificate {
    quality_score: u8,
    entry_count: u64,
    duplicate_count: u64,
    schema_valid: bool,
    field_completeness_pct: f64,
    dataset_hash: String,
}

#[derive(Serialize)]
struct ReceiptOutput {
    image_id: String,
    journal_hex: String,
    seal_hex: String,
    certificate: QualityCertificate,
}

fn parse_journal(journal: &[u8]) -> QualityCertificate {
    assert_eq!(journal.len(), 58, "unexpected journal size: {}", journal.len());

    let quality_score = journal[0];
    let entry_count = u64::from_be_bytes(journal[1..9].try_into().unwrap());
    let duplicate_count = u64::from_be_bytes(journal[9..17].try_into().unwrap());
    let schema_valid = journal[17] == 1;
    let completeness_scaled = u64::from_be_bytes(journal[18..26].try_into().unwrap());
    let field_completeness_pct = completeness_scaled as f64 / 100.0;

    let mut dataset_hash = [0u8; 32];
    dataset_hash.copy_from_slice(&journal[26..58]);

    QualityCertificate {
        quality_score,
        entry_count,
        duplicate_count,
        schema_valid,
        field_completeness_pct,
        dataset_hash: hex_encode(&dataset_hash),
    }
}

fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::filter::EnvFilter::from_default_env())
        .init();

    let args = Args::parse();

    let dataset_json = fs::read_to_string(&args.dataset)
        .unwrap_or_else(|e| panic!("Failed to read '{}': {}", args.dataset, e));

    let rows: Vec<serde_json::Value> = serde_json::from_str(&dataset_json)
        .unwrap_or_else(|e| panic!("Failed to parse JSON: {}", e));

    let schema_fields: Vec<String> = args.schema.split(',').map(|s| s.trim().to_string()).collect();

    let input = serde_json::json!({
        "schema_fields": schema_fields,
        "rows": rows,
    });

    let input_bytes = serde_json::to_vec(&input).unwrap();

    println!("Dataset: {} ({} rows)", args.dataset, rows.len());

    let env = ExecutorEnv::builder()
        .stdin(std::io::Cursor::new(input_bytes))
        .build()
        .unwrap();

    let prover = default_prover();

    println!("Proving...");
    let prove_info = prover.prove(env, DATASET_CERTIFIER_ELF).unwrap();
    let receipt = prove_info.receipt;

    let journal = &receipt.journal.bytes;
    let certificate = parse_journal(journal);

    println!("\n=== Quality Certificate ===");
    println!("Quality score:      {}/100", certificate.quality_score);
    println!("Entry count:        {}", certificate.entry_count);
    println!("Duplicates:         {}", certificate.duplicate_count);
    println!("Schema valid:       {}", certificate.schema_valid);
    println!("Field completeness: {:.1}%", certificate.field_completeness_pct);
    println!("Dataset hash:       0x{}", certificate.dataset_hash);

    receipt.verify(DATASET_CERTIFIER_ID).unwrap();
    println!("\n✓ Proof verified locally");

    let image_id_hex = hex_encode(
        &DATASET_CERTIFIER_ID.iter().flat_map(|w: &u32| w.to_le_bytes()).collect::<Vec<u8>>()
    );

    let output = ReceiptOutput {
        image_id: image_id_hex,
        journal_hex: hex_encode(journal),
        seal_hex: hex_encode(&bincode::serialize(&receipt.inner).expect("failed to serialize proof seal")),
        certificate,
    };

    fs::write(&args.output, serde_json::to_string_pretty(&output).unwrap()).unwrap();
    println!("Receipt saved to {}", args.output);
}

fn hex_encode(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}
