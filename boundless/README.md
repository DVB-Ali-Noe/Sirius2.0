# DataLend — RISC Zero / Boundless Layer

This crate is the **zero-knowledge quality certification layer** of [DataLend](../README.md), an XRPL-native lending protocol for AI datasets.

It proves, in a zkVM, that a dataset matches a set of structural quality assertions (entry count, duplicate rate, schema validity, field completeness) — then verifies the resulting RISC Zero receipt **on-chain on XRPL** through a Wasm `FinishFunction` attached to a Smart Escrow.

The proof is the gating mechanism: an MPT representing dataset access cannot be deposited into a vault unless a `quality_score >= 50` was certified by the zkVM and the receipt was verified by the XRPL ledger itself.

---

## Layout

```
boundless/
├── methods/guest/        Guest program (zkVM) — computes quality, commits a 58-byte journal
├── methods/              Host-facing build of the guest (image ID + ELF)
├── host/                 CLI runner: prove a dataset, write {image_id, journal, seal} to disk
├── escrow/               XRPL Wasm escrow — full RISC Zero verifier (~131 KB)
├── escrow-mini/          XRPL Wasm escrow — score-only check (~3.3 KB, devnet-deployed)
└── datasets/             Three demo datasets + their generated receipts (tier1/2/3)
```

Workspace pinned to `risc0-zkvm ^3.0.5`, stable Rust toolchain.

---

## What the guest proves

Input: a JSON object `{ schema_fields: [string], rows: [object] }` piped through stdin.

The guest deterministically computes:

| Metric | Source |
|---|---|
| `entry_count` | `rows.len()` |
| `duplicate_count` | `serde_json::to_string(row)` collected into a `HashSet` |
| `schema_valid` | every row is an object containing every `schema_field` |
| `field_completeness` | non-null, non-empty rate across all `schema_fields × rows` |
| `dataset_hash` | `sha256(input_bytes)` |
| `quality_score` | weighted sum, clamped to 100 (see `guest/src/main.rs`) |

Output: a fixed-size **58-byte journal** committed to the receipt:

```
[0]      quality_score        u8
[1..9]   entry_count          u64 BE
[9..17]  duplicate_count      u64 BE
[17]     schema_valid         u8 (0|1)
[18..26] field_completeness   u64 BE (×100, e.g. 9850 = 98.50%)
[26..58] dataset_hash         [u8; 32]
```

Fixed layout matters because the Wasm escrow on XRPL parses bytes by offset — no serde, no allocator.

---

## Quick start

```bash
# from boundless/
cargo run --release -- \
  --dataset datasets/tier1-premium.json \
  --output  datasets/receipt-tier1.json
```

Three demo datasets are bundled. Reproducible scores:

| Dataset | Rows | Score | Receipt |
|---|---:|---:|---|
| `tier1-premium.json` | 1000 | **100** | `datasets/receipt-tier1.json` |
| `tier2-standard.json` | 500 | **74** | `datasets/receipt-tier2.json` |
| `tier3-lowquality.json` | 200 | **34** | `datasets/receipt-tier3.json` |

Each receipt contains `image_id`, `journal_hex`, `seal_hex` (bincoded `InnerReceipt`) and a parsed `certificate` block.

Local dev mode (skip proving, useful for iterating on the guest):

```bash
RISC0_DEV_MODE=1 RUST_LOG="[executor]=info" cargo run --release -- --dataset datasets/tier1-small.json
```

---

## On-chain verification — two escrow flavors

The Wasm `FinishFunction` is what makes this **on-chain ZK on XRPL**: the ledger itself runs the verifier before releasing the escrow, no off-chain trust needed.

### `escrow/` — full verifier (production target)

Calls `risc0_verifier_xrpl_wasm::risc0::verify(seal, image_id, journal_digest)` against memos `[0]` (journal) and `[1]` (seal) of the `EscrowFinish` transaction. Hardcoded `DATASET_CERTIFIER_ID` so a borrower cannot swap the guest. Returns the XRPL Wasm result codes (`-1..-5` on failure, `1` on success).

Compiled size: **~131 KB**.

### `escrow-mini/` — score-only fallback (deployed)

Reads the same 58-byte journal but only checks `journal[0] >= 50`. **Does not** cryptographically verify the seal. Used to fit XRPL devnet's effective Wasm size budget.

Compiled size: **~3.3 KB**. Deployed on `wasm.devnet.rippletest.net` at sequence `1707429`.

This is a deliberate, documented compromise — the guest, host, and full escrow are production-grade; the on-chain verifier was downsized to land within the devnet's practical limits during the hackathon. Swapping `escrow-mini` for `escrow` is a one-line change in the deployment script once the Wasm budget allows.

---

## ⚠️ The xrpl.js compatibility constraint

This is the single most important integration note. Anyone trying to reproduce the on-chain verification flow will hit it.

**Two XRPL features the project depends on live in two incompatible client builds:**

| Feature | Where it lives | Why |
|---|---|---|
| Smart Escrow `FinishFunction` (Wasm verifier) | `xrpl.js@4.5.0-smartescrow.4` + `ripple-binary-codec@2.6.0-smartescrow.3` | Encodes the `FinishFunction` field and the `ComputationAllowance` field on `EscrowFinish` |
| XLS-66 Lending (`LoanSet`, `LoanPay`, `LoanBrokerSet`, ...) | `xrpl.js@4.6.0+` | Adds the XLS-66 transaction types to `definitions.json` and the validator |

**There is no published xrpl.js version that ships both.** This is a hard constraint, not a config issue.

### How DataLend lives with it

The Next.js app pins:

```jsonc
"xrpl": "4.6.0",                                  // gets XLS-66 types
"ripple-binary-codec": "2.6.0-smartescrow.3",     // gets Smart Escrow encoding
"ripple-keypairs": "^2.0.0"                       // raw signing for either side
```

Then it bypasses `xrpl.js`'s `validate()` and signs everything via the codec + keypairs directly (`src/lib/xrpl/raw-tx.ts`):

```
build tx as plain JS object
  → ripple-binary-codec.encode(tx)              // accepts both Smart Escrow + XLS-66 fields
  → ripple-keypairs.sign("53545800" + blob)     // STX\0 prefix, SHA-512-Half, secp256k1/Ed25519
  → tx.TxnSignature = signature
  → ripple-binary-codec.encode(tx)              // signed blob
  → client.request({ command: "submit", tx_blob })
```

This is the same flow the official client uses internally; we just skip the `validate()` step that would reject either family of fields depending on which build you picked.

### Known field-ID collision

`ComputationAllowance` (Smart Escrow `EscrowFinish`) and `PreviousPaymentDueDate` (XLS-66 `LoanSet`) currently share the same field ID in the smartescrow codec. Co-encoding them in the same `definitions.json` makes one shadow the other.

**Status:** the `EscrowFinish` step that calls the Wasm verifier is blocked on this. We hand-encoded the rest of the XLS-66 traffic around the codec and the proving / receipt generation / local verification pipeline runs end-to-end. Resolving the collision (separate codec build, or manual binary patching of that one field) is the remaining gap to a fully on-chain ZK-gated loan.

If you're from the Boundless or XRPL devrel side reading this — **this is the conversation we'd love to have at the hackathon.**

---

## Where this plugs into the app

The TypeScript layer (`src/lib/sirius/boundless.ts`) currently exposes a stable `BoundlessProof` interface backed by a SHA-256 placeholder. It is intentionally a stand-in: the real receipt is the one this crate produces. Swapping the placeholder for a call into the host binary (or a hosted Boundless prover) is a drop-in replacement — the interface, the journal layout, and the MPT metadata fields (`zk.qualityScore`, `zk.imageId`, `zk.proofTxHash`) are already wired through the upload pipeline.

Why a placeholder ships in the app: the proving step takes seconds-to-minutes locally and is not feasible inside a Vercel function during a live demo. The receipt is generated **ahead of time** with the host CLI, committed to `datasets/`, and what the demo needs to show on-chain is the `EscrowFinish` verification — which is where the xrpl.js constraint above lives.

---

## References

- [RISC Zero zkVM docs](https://dev.risczero.com/zkvm)
- [Boundless](https://beboundless.xyz/)
- [`risc0-verifier-xrpl-wasm`](https://crates.io/crates/risc0-verifier-xrpl-wasm)
- [`xrpl-wasm-stdlib`](https://crates.io/crates/xrpl-wasm-stdlib)
- XRPL Smart Escrow / Wasm `FinishFunction` (XLS draft on the wasm devnet)
- XLS-66 — XRPL native lending protocol
