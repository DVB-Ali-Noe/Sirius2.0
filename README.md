# DataLend Protocol — XRPL Native Dataset Lending

> **DeFi applied to data.** Borrow and lend access to AI datasets using XRPL's native lending infrastructure. Providers earn XRP yield. Borrowers get time-limited, ZK-certified dataset access. No one owns the data permanently.

**🌐 Live Demo:** _coming soon on Vercel_
**🔗 Built on:** XRPL wasm devnet (`wss://wasm.devnet.rippletest.net:51233`)

---

## Quick Start (local dev)

```bash
git clone https://github.com/DVB-Ali-Noe/Sirius2.0.git
cd Sirius2.0
npm install
cp .env.example .env       # then fill in the values
npm run dev                # http://localhost:3000
```

Required env vars are listed in [.env.example](.env.example).

---

## Table of Contents

- [Overview](#overview)
- [The Problem](#the-problem)
- [The Solution](#the-solution)
- [Architecture](#architecture)
  - [Stack Overview](#stack-overview)
  - [System Components](#system-components)
  - [Data Flow](#data-flow)
- [Core Primitives](#core-primitives)
  - [XLS-33 — Multi-Purpose Token (MPT)](#xls-33--multi-purpose-token-mpt)
  - [XLS-65 — Single Asset Vault](#xls-65--single-asset-vault)
  - [XLS-66 — Lending Protocol](#xls-66--lending-protocol)
  - [XLS-70 — Credentials](#xls-70--credentials)
  - [XLS-80 — Permissioned Domains](#xls-80--permissioned-domains)
- [Access Control & Encryption — Sirius Architecture](#access-control--encryption--sirius-architecture)
- [Quality Certification — Boundless ZK](#quality-certification--boundless-zk)
- [Watermarking — Differential Fingerprinting](#watermarking--differential-fingerprinting)
- [Dispute Resolution](#dispute-resolution)
- [Loan Lifecycle](#loan-lifecycle)
- [Economic Model](#economic-model)
- [Security Model](#security-model)
- [Why XRPL — And Not Ethereum](#why-xrpl--and-not-ethereum)
- [Limitations & Open Problems](#limitations--open-problems)
- [Glossary](#glossary)

---

## Overview

DataLend is a protocol for lending and borrowing access to AI datasets, built on XRPL's native DeFi primitives.

Instead of selling a dataset once (one-shot, permanent transfer, provider loses control), DataLend lets **data providers deposit their datasets into a vault and earn recurring XRP yield**, while **AI companies and research labs borrow time-limited access** with cryptographic guarantees on data quality.

The mechanism mirrors DeFi liquidity pools — but the asset is not currency. It's a tokenized, encrypted, ZK-certified AI dataset.

```
Provider deposits dataset MPT → Vault pools datasets → LoanBroker underwrites borrowers
→ Borrower gets time-limited access → Pays XRP interest → Interests distributed to providers
→ Access expires or defaults → Access revoked onchain
```

---

## The Problem

Today's AI dataset market is broken in two directions:

**For providers:**
- You sell a dataset once. You lose control immediately.
- No recurring revenue. No usage tracking. No quality enforcement.
- Buyers hoard datasets. The same dataset circulates forever after one purchase.

**For borrowers:**
- No quality guarantees before purchase. Marketplaces are opaque.
- You either buy a dataset you don't need forever, or you don't get access at all.
- No standardized trust layer. No way to verify freshness, uniqueness, or schema compliance without downloading first.

The result: a market stuck in one-shot transactions, with no liquidity, no yield, and no trust infrastructure.

---

## The Solution

Treat datasets like financial assets:

| Financial DeFi | DataLend |
|---|---|
| Deposit RLUSD into a lending pool | Deposit a dataset MPT into a vault |
| Earn yield in XRP on your deposit | Earn yield in XRP on your dataset |
| Borrower takes a fixed-term loan | Borrower takes time-limited dataset access |
| Collateral or credit-based underwriting | LoanBroker underwrites borrowers offchain |
| Repayment schedule enforced onchain | Repayment schedule enforced onchain |
| Default → collateral seized | Default → access revoked, First-Loss Capital covers |

The key insight: **access to a dataset can be lent without transferring ownership.** The data stays encrypted. The MPT (onchain key) moves temporarily. When the loan expires, the key is revoked.

---

## Architecture

### Stack Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        XRPL Ledger                          │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌──────────┐  │
│  │ XLS-33   │  │ XLS-65   │  │ XLS-66    │  │ XLS-70   │  │
│  │   MPT    │  │  Vault   │  │  Lending  │  │  Creds   │  │
│  └──────────┘  └──────────┘  └───────────┘  └──────────┘  │
│                        XLS-80 (Permissioned Domains)        │
└─────────────────────────────────────────────────────────────┘
         │                              │
         ▼                              ▼
┌─────────────────┐          ┌──────────────────────┐
│  Sirius Layer   │          │   Boundless ZK        │
│  (Encryption)   │          │   (Quality Proofs)    │
│  IPFS Storage   │          │                       │
└─────────────────┘          └──────────────────────┘
         │
         ▼
┌─────────────────┐
│  Differential   │
│  Watermarking   │
│  (Fingerprint)  │
└─────────────────┘
```

### System Components

| Component | Role |
|---|---|
| **Data Provider** | Creates, encrypts, certifies, and deposits datasets |
| **LoanBroker** | Operates the vault, underwrites borrowers offchain, holds First-Loss Capital |
| **Borrower** | AI startup, research lab, or enterprise requesting dataset access |
| **Vault (XLS-65)** | Pools dataset MPTs from multiple providers |
| **Lending Protocol (XLS-66)** | Creates and enforces fixed-term loans onchain |
| **Sirius** | Handles encryption, decryption, key management, versioning, IPFS storage |
| **Boundless** | Generates ZK proofs of dataset quality without revealing content |
| **Watermark Oracle** | Generates and verifies borrower-specific fingerprints |
| **Kleros-like Arbitration** | Resolves disputes between quality certificates and actual data |

### Data Flow

#### Phase 1 — Dataset Preparation (Provider)

```
1. Provider creates dataset
2. Dataset versioned & Merkle-tree structured (Sirius)
3. Dataset encrypted with master key (Sirius / IPFS)
4. ZK proof generated: "100K entries, 0% duplicates, schema X" (Boundless)
5. Watermark seed registered for this dataset (Watermark Oracle)
6. MPT minted on XRPL:
     - Metadata URI → IPFS hash of encrypted dataset
     - Metadata fields → ZK proof reference, quality certificate, schema hash
7. Provider deposits MPT into Vault → receives vault shares
```

#### Phase 2 — Loan Request (Borrower)

```
1. Borrower (with valid credential via XLS-70) requests access
2. LoanBroker screens borrower offchain (KYB, use-case review)
3. LoanBroker fixes loan terms:
     - Duration: e.g., 30 days
     - Interest rate: e.g., 5% in XRP
     - Repayment schedule: e.g., weekly
4. LoanBroker deposits First-Loss Capital into protocol
5. XLS-66 creates Loan onchain:
     - MPT dataset transferred from Vault to Borrower account
     - Repayment obligations recorded onchain
```

#### Phase 3 — Active Loan (Access)

```
1. Sirius detects MPT transfer event onchain
2. Sirius generates borrower-specific watermarked version of dataset
3. Sirius issues time-limited decryption key to borrower
4. Borrower accesses dataset via API or direct decryption
5. Borrower pays XRP interest per repayment schedule
6. Sirius monitors for key expiry & repayment status
```

#### Phase 4 — Loan Termination

```
Option A — Normal expiry:
  - Loan term ends
  - XLS-66 returns MPT to Vault
  - Sirius revokes decryption key
  - Interests distributed to providers proportional to vault shares

Option B — Default:
  - Borrower misses payment
  - LoanBroker triggers default onchain (XLS-66)
  - MPT immediately returned to Vault
  - Sirius revokes key immediately
  - First-Loss Capital covers provider losses
  - Borrower credential flagged / revoked (XLS-70)
```

---

## Core Primitives

### XLS-33 — Multi-Purpose Token (MPT)

Each dataset is represented as an MPT — XRPL's native token standard for flexible, low-overhead tokenization.

**Why MPT and not a trust-line token?**
- MPTs support rich metadata fields natively
- Lower reserve requirements
- Native support for transfer restrictions and permissions
- Can be configured as non-transferable except by authorized parties

**MPT structure for a dataset:**

```json
{
  "mpt_issuance_id": "...",
  "issuer": "provider_address",
  "maximum_amount": "1",
  "metadata": {
    "dataset_ipfs_hash": "bafybeig...",
    "zk_proof_ref": "boundless://proof/abc123",
    "schema_hash": "0xdeadbeef...",
    "quality_certificate": {
      "entry_count": 100000,
      "duplicate_rate": "0%",
      "schema": "openai-chat-v1",
      "certified_at": 1234567890
    },
    "version": "2024-Q4-v3"
  },
  "flags": {
    "can_transfer": true,
    "transfer_requires_auth": true
  }
}
```

**What the MPT is and is not:**
- ✅ It is the onchain representation of access rights to the dataset
- ✅ It carries quality metadata and IPFS pointer
- ✅ It is the asset that moves during a loan
- ❌ It is not the dataset itself (dataset stays encrypted on IPFS)
- ❌ Holding the MPT does not grant access without the corresponding decryption key (issued separately by Sirius)

---

### XLS-65 — Single Asset Vault

The Vault aggregates MPTs from multiple providers and makes them available to the lending protocol.

**Key properties:**
- Single asset type per vault (all MPTs in a given vault must be of the same issuance, or vaults are segmented by dataset tier)
- Depositors receive vault shares proportional to their contribution
- Vault shares represent claim on future interest distributions
- Vault operator = LoanBroker (controls which loans are created)

**Vault segmentation strategy:**

Since datasets have heterogeneous quality, vaults are segmented:

| Vault Tier | Criteria | Example |
|---|---|---|
| Tier 1 — Premium | >1M entries, <0.1% duplicates, schema certified | GPT-4 RLHF datasets |
| Tier 2 — Standard | 100K–1M entries, <1% duplicates | General instruction tuning |
| Tier 3 — Specialized | Domain-specific, any size, verified schema | Medical imaging, legal documents |

A provider deposits into the tier matching their dataset's ZK-certified quality level. Borrowers borrow from a specific tier vault. Interest rates differ by tier.

**Share calculation:**

When Provider A deposits an MPT valued at V_A into a vault with total value V_total, their share fraction is:

```
shares_A = (V_A / V_total) × total_shares_outstanding
```

Valuation of each MPT is set by the LoanBroker based on the ZK quality certificate at deposit time.

---

### XLS-66 — Lending Protocol

XLS-66 is the XRPL-native fixed-term lending protocol. It handles the financial rails of the loan.

**What XLS-66 manages onchain:**
- Loan creation (asset transfer from Vault to Borrower)
- Repayment schedule tracking
- Default detection (missed payment → automatic trigger)
- Interest accrual and distribution logic
- First-Loss Capital accounting

**What XLS-66 does not manage:**
- What the asset is (it sees an MPT, not a dataset)
- Decryption key issuance (Sirius responsibility)
- Borrower screening (LoanBroker responsibility offchain)
- Quality verification (Boundless responsibility)

**Loan object structure (simplified):**

```
Loan {
  borrower:          <address>
  vault:             <vault_id>
  asset:             <mpt_issuance_id>
  amount:            1
  term:              30 days
  interest_rate:     5% (in XRP)
  repayment_schedule: weekly
  loan_broker:       <loanbroker_address>
  first_loss_capital: 500 XRP
  status:            active | repaid | defaulted
}
```

**The mapping: "lending money" → "lending data access"**

In a standard money lending protocol, the asset that moves is currency. Here the asset is an MPT dataset token. XLS-66 is agnostic to this — it moves whatever asset the vault holds. The intelligence (encryption, access control) sits above XLS-66 and listens to its events.

```
XLS-66 event: MPT transferred to borrower
    → Sirius: activate decryption key for borrower

XLS-66 event: loan repaid / expired
    → Sirius: revoke decryption key

XLS-66 event: default triggered
    → Sirius: revoke key immediately
    → First-Loss Capital: cover provider losses
```

---

### XLS-70 — Credentials

XRPL-native verifiable credentials, issued by authorized credential authorities and attached to accounts.

**Used in DataLend for:**

1. **Provider certification** — Before depositing a dataset, a provider must hold a credential issued by a trusted authority (e.g., a data quality certifier, a legal compliance authority, or the LoanBroker itself). This guarantees that datasets entering the vault come from verified, accountable entities.

2. **Borrower KYB** — Borrowers hold credentials proving their identity has been verified (KYB/KYC). If a borrower defaults or misuses data, their credential can be revoked, blacklisting them from the ecosystem.

3. **Accountability chain** — Because credentials are onchain, the full chain of trust is auditable: who certified whom, when, and on what basis.

**Credential types in DataLend:**

| Credential | Issued by | Required for |
|---|---|---|
| `DataProviderCertified` | LoanBroker or accreditation authority | Depositing into any vault |
| `BorrowerKYB` | LoanBroker | Taking a loan |
| `TierOneCertified` | Quality auditor | Depositing into Tier 1 vault |
| `DefaultBlacklist` | LoanBroker | Prevents new loans after default |

---

### XLS-80 — Permissioned Domains

Permissioned Domains allow vault owners to restrict who can deposit and borrow based on credential requirements.

**In DataLend:**

```
Vault Tier 1 Domain {
  accepted_credential_authorities: [LoanBrokerAddress, AuditFirmAddress]
  required_credentials: [DataProviderCertified, TierOneCertified]
}
```

Anyone attempting to deposit into Tier 1 vault without the required credentials from the right authorities is rejected at the protocol level — no middleware, no external check.

**Effect:** Quality control is enforced at the ledger level. A low-quality dataset literally cannot enter a Tier 1 vault because the account depositing it won't have the required credential.

---

## Access Control & Encryption — Sirius Architecture

Sirius is the off-ledger layer handling the actual data and keys. It bridges onchain loan events to offchain access control.

### Encryption Model

**At deposit time:**
1. Dataset split into a Merkle tree of chunks
2. Each chunk encrypted with a symmetric key K_master
3. K_master stored in a secure key management system (HSM or threshold MPC)
4. IPFS hash of encrypted Merkle root stored in MPT metadata

**At loan activation:**
1. Sirius detects MPT transfer event from Vault to Borrower
2. Sirius generates a **borrower-specific encrypted version** of the dataset (with watermark, see below)
3. Sirius issues a time-limited derived key K_borrower to the borrower
4. K_borrower is valid only for the loan duration

**At loan expiry/default:**
1. Sirius detects onchain event
2. K_borrower is revoked (TTL expires or explicit revocation)
3. Borrower can no longer decrypt

### Versioning

Datasets are versioned continuously. Each version is a new Merkle state. The IPFS pointer in the MPT metadata updates with each version.

**Why this matters for security:**
- A borrower who copies the dataset on day 1 has a snapshot
- By day 30, the dataset has been updated multiple times
- The copied version is partially stale and depreciating in value
- The incentive to copy is reduced because the value is in the live, versioned feed — not the snapshot

### API-Only Mode (Recommended)

In the highest-security configuration, borrowers never receive a decryption key at all. Instead:
- Dataset stays fully encrypted on IPFS
- Borrower submits queries to a Sirius-operated API endpoint
- Sirius decrypts server-side, executes the query, returns only the result
- The borrower never sees bulk plaintext data

**Tradeoff:** Requires trust in the Sirius API operator. Works well for structured datasets (SQL-like queries, embedding lookups). Less suitable for unstructured bulk datasets where the borrower needs to run local training.

---

## Quality Certification — Boundless ZK

Boundless generates zero-knowledge proofs of dataset quality metrics without revealing any data.

### What the ZK Proof Asserts

A Boundless proof for a dataset can attest to:

| Metric | Example Assertion |
|---|---|
| Entry count | "Exactly 100,000 rows" |
| Duplicate rate | "< 0.1% duplicates by hash" |
| Schema compliance | "All rows match schema version openai-chat-v1" |
| Label distribution | "Labels balanced within ±5%" |
| Temporal range | "All timestamps between 2022-01-01 and 2024-12-31" |
| Language distribution | "≥ 95% English content" |
| Toxicity rate | "< 0.01% flagged by classifier X" |

The proof is a cryptographic commitment. The verifier (borrower) can check the proof against the MPT's metadata hash without seeing a single data point.

### Borrower Flow

```
1. Borrower reviews MPT metadata:
     - ZK proof reference
     - Quality certificate summary
     - Schema hash

2. Borrower fetches and verifies Boundless proof:
     - Proof verified against IPFS hash in MPT
     - Assertions confirmed cryptographically

3. Borrower knows EXACTLY what they're getting before paying

4. Loan is created. Borrower accesses data.

5. If data doesn't match proof → dispute (see Dispute Resolution)
```

---

## Watermarking — Differential Fingerprinting

Watermarking is the main deterrence mechanism against unauthorized copying and redistribution.

### The Problem It Solves

If a borrower copies the dataset during their loan period and sells it or uses it beyond the agreed scope, the provider has no way to prove which borrower was the source of the leak.

Differential watermarking solves this by giving every borrower a **unique, imperceptible version** of the dataset. If the data appears elsewhere, the watermark reveals the source.

### How It Works

**At loan creation:**

1. The Watermark Oracle generates a unique fingerprint seed for this specific `(borrower_address, loan_id, dataset_mpt_id)` tuple
2. This seed is registered onchain (or in a trusted offchain registry with onchain commitment)
3. Sirius uses the seed to modify a small, deterministic subset of the dataset entries before encrypting the borrower's copy

**The modifications are:**
- Imperceptible to model training (statistically insignificant noise in a small fraction of entries)
- Deterministic: given the seed, you can always reproduce which entries were modified and how
- Non-overlapping: two borrowers never get the same modifications

```
Dataset (1M entries)
    ↓
Seed: hash(borrower_addr || loan_id || dataset_id)
    ↓
Modified entries: rows [42, 1337, 87654, ...] ← pseudo-random selection from seed
    ↓
Modification: subtle value shift, rounding, synonym substitution (schema-dependent)
    ↓
Borrower A gets version A
Borrower B gets version B
Both appear identical to the naked eye and to most training pipelines
```

**At detection time:**

If a dataset appears in the wild (redistributed, leaked, found in a public repo):

1. The Watermark Oracle runs detection on the suspect dataset
2. Detection checks all active and historical watermark patterns
3. Match found → seed identified → `(borrower_address, loan_id)` identified
4. Evidence submitted to Kleros arbitration or legal process

### Watermark Robustness

| Attack | Watermark robustness |
|---|---|
| Minor edits (add/remove rows) | High — statistical patterns survive |
| Schema transformation | Medium — needs schema-aware watermarking |
| Mixing with another dataset | Medium — detectable if ≥30% of original remains |
| Re-training on the data and extracting | Low — model extraction attacks can defeat data-level watermarks |
| Full dataset re-generation based on patterns | Very low — not practical at scale |

**The key insight:** Watermarking doesn't need to be unbreakable. It needs to make unauthorized redistribution more costly and risky than legitimate use. For commercial AI datasets, the economics favor compliance.

### Watermark Types by Dataset Type

| Dataset Type | Watermark Method |
|---|---|
| Text / instruction tuning | Synonym substitution in low-frequency tokens |
| Tabular / structured | Micro-perturbation of numeric values within tolerance |
| Image captions | Insertion of specific rare phrase patterns |
| Code datasets | Insertion of semantically equivalent but unique code comments |
| Embedding datasets | Subtle vector shifts below perception threshold |

---

## Dispute Resolution

If a borrower accesses a dataset and it does not match the ZK-certified quality certificate, a dispute can be raised.

### Dispute Triggers

- Entry count is materially different from the proof assertion
- Schema doesn't match the certified schema
- Duplicate rate exceeds the certified threshold
- Data is demonstrably corrupted, malformed, or fraudulent

### Resolution Flow

```
1. Borrower raises dispute within dispute window (e.g., 48h after loan activation)
2. Dispute registered onchain (or with arbitration oracle)
3. Independent verifiers (Kleros-style jury) receive:
     - The ZK proof and its assertions
     - A random sample of the actual dataset (provider must reveal sample)
     - The schema definition
4. Jury verifies sample against assertions
5. Resolution:
     - If dataset matches proof → dispute rejected, borrower pays penalty
     - If dataset doesn't match proof → loan cancelled, borrower refunded,
       provider's credential flagged, vault stake slashed
```

### Incentive Alignment

- Providers have strong incentive to certify accurately — fraudulent certification leads to credential revocation and vault slash
- Borrowers have incentive to raise disputes promptly — dispute window limits gaming
- Arbitrators are incentivized correctly via stake-based Kleros mechanism

---

## Loan Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│                     LOAN LIFECYCLE                              │
├──────────────┬──────────────────────────────────────────────────┤
│ State        │ What happens                                     │
├──────────────┼──────────────────────────────────────────────────┤
│ PENDING      │ LoanBroker has approved borrower offchain        │
│              │ Waiting for onchain loan creation                │
├──────────────┼──────────────────────────────────────────────────┤
│ ACTIVE       │ MPT transferred to borrower account             │
│              │ Sirius issues borrower decryption key            │
│              │ Watermarked dataset copy generated               │
│              │ Repayment schedule starts                        │
├──────────────┼──────────────────────────────────────────────────┤
│ REPAYING     │ Borrower making periodic XRP payments           │
│              │ Each missed payment → warning / grace period     │
├──────────────┼──────────────────────────────────────────────────┤
│ COMPLETED    │ All payments made, term expired                  │
│              │ MPT returned to Vault                            │
│              │ Key revoked by Sirius                            │
│              │ Interests distributed to vault depositors        │
├──────────────┼──────────────────────────────────────────────────┤
│ DEFAULTED    │ Payment missed beyond grace period               │
│              │ LoanBroker triggers default                      │
│              │ MPT immediately returned to Vault                │
│              │ Key immediately revoked                          │
│              │ First-Loss Capital covers provider losses        │
│              │ Borrower credential flagged                      │
├──────────────┼──────────────────────────────────────────────────┤
│ DISPUTED     │ Borrower raised quality dispute                  │
│              │ Access suspended pending arbitration             │
│              │ Resolved by Kleros jury                          │
└──────────────┴──────────────────────────────────────────────────┘
```

---

## Economic Model

### Provider Revenue

A provider depositing a Tier 1 dataset MPT valued at 10,000 XRP into a vault with 100,000 XRP total value owns 10% of the vault.

If the vault earns 5,000 XRP in interest during a quarter, the provider receives 500 XRP — purely from lending their data access, without selling a single byte.

### Borrower Cost

Borrower pays a fixed APR in XRP on the notional value of the dataset loan. Example:

- Dataset valuation: 10,000 XRP (set by LoanBroker at loan creation)
- APR: 60% (annualized for high-value, scarce datasets)
- Loan term: 30 days
- Interest owed: 10,000 × 0.60 × (30/365) ≈ 493 XRP

This is cheaper than buying the dataset outright, and the borrower doesn't risk accumulating a permanent liability.

### LoanBroker Revenue

LoanBroker takes a spread:
- Charges borrower 60% APR
- Pays providers 45% APR equivalent
- Keeps 15% spread as operating fee + risk premium

First-Loss Capital represents the LoanBroker's skin in the game. It's at risk before any provider losses occur, incentivizing rigorous borrower screening.

### Interest Distribution to Providers

At loan completion, XLS-66 distributes collected interest to the vault. XLS-65 then allocates to depositors pro-rata to their shares:

```
Provider A share fraction × total interest = Provider A payout
```

---

## Security Model

### What is Secured Onchain (XRPL native)

| Guarantee | Mechanism |
|---|---|
| MPT moves only to credentialed borrowers | XLS-80 Permissioned Domains |
| Repayment schedule enforced | XLS-66 native protocol |
| Default triggers automatic MPT return | XLS-66 native protocol |
| Provider credentials verified | XLS-70 + XLS-80 |
| Audit trail of all loan events | XRPL ledger history |

### What is Secured Offchain (Sirius + Boundless)

| Guarantee | Mechanism |
|---|---|
| Dataset content never revealed without key | Sirius encryption |
| Key revoked on loan end/default | Sirius event listener on XRPL |
| Quality assertions verifiable before borrowing | Boundless ZK proof |
| Unauthorized copy traceable | Differential watermarking |

### Residual Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Borrower copies dataset during loan | Medium | API-only mode, watermarking, versioning, legal accountability via credentials |
| Sirius key management compromised | High | HSM / threshold MPC, no single point of failure |
| LoanBroker acts maliciously | High | First-Loss Capital at stake, credential revocation, protocol-level limits |
| ZK proof forged or incorrect | Low | Boundless is cryptographically verifiable by anyone |
| Watermark defeated by adversarial scrubbing | Low | Increases cost of misuse; combined with legal risk |
| Smart contract risk | Very Low | XRPL primitives are protocol-native, not external smart contracts |

---

## Why XRPL — And Not Ethereum

This protocol cannot be faithfully replicated on Ethereum without assembling 8+ external protocols, each introducing attack surface.

| Capability | XRPL | Ethereum |
|---|---|---|
| Lending protocol | Native (XLS-66), audited as ledger code | External protocol (Aave, Compound) — hackable, upgradeable by governance |
| Asset vault | Native (XLS-65) | External protocol (ERC-4626 vaults) — varies by implementation |
| Custom asset tokenization | Native MPT (XLS-33) | ERC-20 or ERC-1155 — no native permission layer |
| Credentials | Native (XLS-70) | No equivalent — requires Soulbound Token standards + external issuers |
| Permissioned access | Native (XLS-80) | Requires external middleware (e.g., Lit Protocol, Unlock Protocol) |
| Composability attack surface | Low — all primitives in one protocol | High — each external protocol is an attack vector |
| Finality | 3–5 seconds | 12+ seconds (post-Merge), variable with L2s |
| Transaction cost | Sub-cent | Variable, often dollars during congestion |

**The critical point:** On Ethereum, each additional external protocol you compose with is an additional governance attack, upgrade risk, or exploit surface. If Aave is compromised, your dataset vault is compromised. On XRPL, the lending and vault protocols are in the ledger code itself — the same code audited by Immunefi with a 60,000-researcher security program.

---

## Limitations & Open Problems

**1. The copy problem**
If a borrower receives bulk decryption access, they can copy the data. The system provides deterrents (watermarking, versioning, legal accountability, API-only mode) but not cryptographic prevention. The strongest configuration is API-only access. This limits use cases where borrowers need to run local training on raw data.

**2. MPT valuation heterogeneity**
A vault pools MPTs but treats them as equal units for share calculation. The LoanBroker must manually value each MPT at deposit time. There is no automated, decentralized pricing mechanism for dataset MPTs yet. This is a research-open problem.

**3. Key management is centralized**
Sirius, as described, requires a trusted key manager. A compromise of Sirius compromises all active keys. The mitigation is threshold MPC (no single key holder) but this adds operational complexity.

**4. ZK proof coverage**
Boundless proves structural quality (counts, schema, duplicates). It does not prove semantic quality (are the answers correct? is the labeling accurate?). For some AI datasets, semantic quality is the main value driver and cannot be ZK-proven today.

**5. Versioning coordination**
If a dataset is updated mid-loan, the borrower expects to receive updates. The protocol for versioning notifications, key rotation for updated versions, and pricing differential for versioned access is not yet fully specified.

**6. Watermark defeat by model extraction**
An adversary who uses the dataset for training and then extracts the model's knowledge cannot be traced via data-level watermarks. This is a fundamental limitation of data watermarking versus model watermarking — a separate and open research area.

---

## Glossary

| Term | Definition |
|---|---|
| **MPT** | Multi-Purpose Token. XRPL-native token representing the access rights to a specific dataset |
| **Vault** | XLS-65 Single Asset Vault. Aggregates dataset MPTs from multiple providers |
| **Vault Shares** | Proportional ownership claim on the vault's future interest distributions |
| **LoanBroker** | The entity operating the vault, screening borrowers, and holding First-Loss Capital |
| **First-Loss Capital** | XRP deposited by LoanBroker to absorb initial losses before providers are affected |
| **Sirius** | The encryption and key management layer. Handles IPFS storage, Merkle tree versioning, and key issuance/revocation |
| **Boundless** | ZK proof system that certifies dataset quality metrics without revealing data |
| **Differential Watermarking** | Per-borrower imperceptible dataset modifications enabling leak attribution |
| **Watermark Oracle** | Service generating and verifying borrower-specific fingerprint patterns |
| **XLS-33** | XRPL amendment defining the Multi-Purpose Token standard |
| **XLS-65** | XRPL amendment defining the Single Asset Vault primitive |
| **XLS-66** | XRPL amendment defining the native Lending Protocol |
| **XLS-70** | XRPL amendment defining onchain Credentials |
| **XLS-80** | XRPL amendment defining Permissioned Domains for access control |
| **Fixed-Term Loan** | A loan with a defined duration and repayment schedule, as created by XLS-66 |
| **Non-Collateralized Loan** | XLS-66 loan type where no asset is seized at default — First-Loss Capital covers instead |
| **Merkle Tree** | Cryptographic structure used to represent dataset chunks, enabling integrity verification of individual pieces |
| **API-Only Mode** | Access configuration where borrowers query data via API rather than receiving decryption keys |
| **Dispute Window** | Time period after loan activation during which a borrower can raise a quality dispute |
```