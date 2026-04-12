#![cfg_attr(target_arch = "wasm32", no_std)]
use xrpl_wasm_stdlib::host::{Error, Result};
use xrpl_wasm_stdlib::{core::locator::Locator, host::get_tx_nested_field, sfield};

const MIN_SCORE: u8 = 50;

#[unsafe(no_mangle)]
pub extern "C" fn finish() -> i32 {
    let journal: [u8; 58] = match get_memo(0) {
        Result::Ok(j) => j,
        Result::Err(_) => return -1,
    };
    let score = journal[0];
    if score < MIN_SCORE { return -2; }
    1
}

fn get_memo<const LEN: usize>(idx: i32) -> Result<[u8; LEN]> {
    let mut buffer = [0; LEN];
    let mut locator = Locator::new();
    locator.pack(sfield::Memos);
    locator.pack(idx);
    locator.pack(sfield::MemoData);
    let rc = unsafe { get_tx_nested_field(locator.as_ptr(), locator.num_packed_bytes(), buffer.as_mut_ptr(), buffer.len()) };
    match rc {
        rc if rc > 0 => Result::Ok(buffer),
        0 => Result::Err(Error::InternalError),
        rc => Result::Err(Error::from_code(rc)),
    }
}
