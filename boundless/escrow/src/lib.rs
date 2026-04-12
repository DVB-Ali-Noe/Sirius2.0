#![cfg_attr(target_arch = "wasm32", no_std)]
#[cfg(not(target_arch = "wasm32"))]
extern crate std;

use risc0_verifier_xrpl_wasm::{Proof, risc0};
use xrpl_wasm_stdlib::host::Error;
use xrpl_wasm_stdlib::{core::locator::Locator, host::get_tx_nested_field, sfield};

const DATASET_CERTIFIER_ID: [u32; 8] = [3220432657, 1101345105, 3117799654, 1976146688, 3286183643, 644141379, 4234568995, 1515115188];

const JOURNAL_SIZE: usize = 58;
const SEAL_SIZE: usize = 256;
const MIN_QUALITY_SCORE: u8 = 50;

#[unsafe(no_mangle)]
pub extern "C" fn finish() -> i32 {
    let journal: [u8; JOURNAL_SIZE] = match get_memo(0) {
        xrpl_wasm_stdlib::host::Result::Ok(j) => j,
        xrpl_wasm_stdlib::host::Result::Err(_) => return -1,
    };
    let seal: [u8; SEAL_SIZE] = match get_memo(1) {
        xrpl_wasm_stdlib::host::Result::Ok(s) => s,
        xrpl_wasm_stdlib::host::Result::Err(_) => return -2,
    };

    let proof = match Proof::from_seal_bytes(&seal) {
        core::result::Result::Ok(p) => p,
        core::result::Result::Err(_) => return -3,
    };
    let journal_digest = risc0::hash_journal(&journal);
    match risc0::verify(&proof, &bytemuck::cast(DATASET_CERTIFIER_ID), &journal_digest) {
        core::result::Result::Ok(_) => {}
        core::result::Result::Err(_) => return -4,
    }

    let quality_score = journal[0];
    if quality_score < MIN_QUALITY_SCORE {
        return -5;
    }

    1
}

fn get_memo<const LEN: usize>(idx: i32) -> xrpl_wasm_stdlib::host::Result<[u8; LEN]> {
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
        result_code if result_code > 0 => xrpl_wasm_stdlib::host::Result::Ok(buffer),
        0 => xrpl_wasm_stdlib::host::Result::Err(Error::InternalError),
        result_code => xrpl_wasm_stdlib::host::Result::Err(Error::from_code(result_code)),
    }
}
