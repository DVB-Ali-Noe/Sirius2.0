#![cfg_attr(target_arch = "wasm32", no_std)]
#[cfg(not(target_arch = "wasm32"))]
extern crate std;

use risc0_verifier_xrpl_wasm::{Proof, risc0};

// Image ID of the dataset-certifier guest program.
// Regenerate after any guest code change with: cargo build (dev mode)
// Then copy from target/debug/build/methods-*/out/methods.rs
const DATASET_CERTIFIER_ID: [u32; 8] = [3220432657, 1101345105, 3117799654, 1976146688, 3286183643, 644141379, 4234568995, 1515115188];
use xrpl_wasm_stdlib::host::{Error, Result, Result::Err, Result::Ok};
use xrpl_wasm_stdlib::{core::locator::Locator, host::get_tx_nested_field, sfield};

const JOURNAL_SIZE: usize = 58;
const SEAL_SIZE: usize = 256;
const MIN_QUALITY_SCORE: u8 = 50;

/// Smart Escrow that verifies a ZK proof of dataset quality.
/// The proof must demonstrate a quality score >= 50 to unlock the escrow.
///
/// Memo layout:
///   Memo 0: journal (58 bytes) — quality certificate
///   Memo 1: seal (256 bytes) — Groth16 proof
#[unsafe(no_mangle)]
pub extern "C" fn finish() -> i32 {
    let journal: [u8; JOURNAL_SIZE] = get_memo(0).unwrap();
    let seal: [u8; SEAL_SIZE] = get_memo(1).unwrap();

    let quality_score = journal[0];
    assert!(quality_score >= MIN_QUALITY_SCORE, "quality score too low");

    let proof = Proof::from_seal_bytes(&seal).unwrap();
    let journal_digest = risc0::hash_journal(&journal);
    risc0::verify(&proof, &bytemuck::cast(DATASET_CERTIFIER_ID), &journal_digest).unwrap();

    1
}

fn get_memo<const LEN: usize>(idx: i32) -> Result<[u8; LEN]> {
    let mut buffer = [0; LEN];
    let mut locator = Locator::new();
    locator.pack(sfield::Memos);
    locator.pack(idx);
    locator.pack(sfield::MemoData);
    let result_code = unsafe {
        get_tx_nested_field(
            locator.as_ptr(),
            locator.num_packed_bytes(),
            buffer.as_mut_ptr(),
            buffer.len(),
        )
    };

    match result_code {
        result_code if result_code > 0 => Ok(buffer),
        0 => Err(Error::InternalError),
        result_code => Err(Error::from_code(result_code)),
    }
}
