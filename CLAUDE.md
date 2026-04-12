# CLAUDE.md — DataLend Protocol

## Projet

DataLend — Lending pool DeFi pour datasets IA, built on XRPL.
Hackathon PBW26.
**Track Boundless** : ZK proofs on-chain XRPL via Smart Escrow Wasm + RISC Zero.

## Stack

- **Frontend :** Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS v4
- **3D/Animations :** Three.js + React Three Fiber, GSAP + Lenis, Framer Motion
- **State :** Zustand (client, persist localStorage), React Query (server)
- **Backend :** API Routes Next.js (pas de serveur séparé)
- **XRPL :** xrpl.js@4.5.0-smartescrow.4, wasm devnet
- **XLS-66 (Loans) :** raw signing via ripple-keypairs (codec sait encoder, validate() rejette)
- **ZK Proofs :** RISC Zero zkVM, proving local. Guest program `dataset-certifier` (Rust)
- **Smart Escrow :** escrow-mini Wasm (3.3KB) vérifie quality_score >= 50 on-chain
- **Wallet :** xrpl-connect (Gem, Crossmark, Xaman)
- **Storage :** Pinata (IPFS) si PINATA_JWT, sinon mock in-memory
- **Encryption :** AES-256-GCM, clé dérivée par borrower/loan
- **Boundless (standby) :** Base Sepolia, config dans ~/.boundless/, provers testnet indisponibles

## Architecture

```
Frontend (Next.js 16)
  → API Routes
    ├── Sirius (encrypt, IPFS, keys, watermark, ZK mock)
    ├── XRPL (MPT, Vault, Lending, Credentials, Escrow)
    └── Fund (faucet proxy)
  → XRPL wasm devnet (all amendments + SmartEscrow)
  → Pinata (IPFS)
  → Boundless guest Rust (local proving)
```

## Réseaux

- **XRPL :** `wss://wasm.devnet.rippletest.net:51233`
- **Faucet :** `https://wasmfaucet.devnet.rippletest.net/accounts`
- **Explorer :** `https://devnet.xrpl.org`
- **Boundless (standby) :** Base Sepolia, chain 84532, BoundlessMarket `0x56da3786061c82214d18e634d2817e86ad42d7ce`

## XRPL Primitives

- **XLS-33** — MPT : tokenise un dataset on-chain avec metadata structurée
- **XLS-65** — Vault : pool les MPTs des providers, vault shares
- **XLS-66** — Lending : loans fixed-term (raw signing via ripple-keypairs)
- **XLS-70** — Credentials : DataProviderCertified, BorrowerKYB, TierOneCertified, DefaultBlacklist
- **XLS-80** — Permissioned Domains : contrôle d'accès au vault par credential
- **Smart Escrow (Wasm)** — vérifie le quality score ZK on-chain

## Signing strategy

| Tx type | Signé par | Méthode |
|---------|-----------|---------|
| MPT, Vault, Escrow, Credentials, Domains | User (wallet popup) ou serveur | `submitAndWait()` natif |
| LoanBrokerSet, LoanSet, LoanPay, LoanManage, LoanDelete | LoanBroker (serveur only) | `submitRawTx()` poll + validate |

## ZK Proof Flow

```
Dataset JSON → Guest Rust (RISC-V zkVM) → Journal 58 bytes :
  [0]      quality_score (u8, 0-100)
  [1..9]   entry_count (u64 BE)
  [9..17]  duplicate_count (u64 BE)
  [17]     schema_valid (u8)
  [18..26] field_completeness (u64 BE, scaled ×10000)
  [26..58] dataset_hash (SHA-256)

→ EscrowCreate avec FinishFunction = escrow-mini.wasm
→ EscrowFinish avec journal dans Memos
→ Wasm vérifie score >= 50 on-chain
→ MPT minté avec zk.proofTxHash = tx hash EscrowFinish
```

## État actuel (12 avril 2026)

### ✅ Fonctionne
- lib/xrpl/ (16 fichiers) : MPT, Vault, Lending, Credentials, Domains, Escrow, Events, State machine, Repayment, Distribution, Raw TX
- lib/sirius/ (10 fichiers) : Encryption, Merkle, Watermark, Pipeline, IPFS, Key-store, Registry, Bridge, Boundless mock
- lib/wallet/ : xrpl-connect multi-wallet
- API Routes : 10 XRPL + 7 Sirius + 1 Fund = 18 routes
- Frontend : 5 pages (Dashboard, Provider, Marketplace, Borrower, Admin), sidebar conditionnel, route guard
- Boundless Rust : guest (scores 100/74/34), host, escrow-mini déployé, 3 datasets de démo
- Sécurité : 7 passes d'audit, tous fix critiques appliqués

### ❌ Bloqué
- **EscrowFinish** : conflit codec ComputationAllowance / PreviousPaymentDueDate
- **Boundless réseau** : provers Base Sepolia testnet indisponibles
- **Vérification ZK complète on-chain** : Wasm 131KB > limite devnet (~100KB)

### ⬜ À faire
- Résoudre le conflit codec EscrowFinish
- Brancher le guest Rust dans le flow TS (remplacer boundless.ts mock)
- Ajouter champs zk.* dans MPT metadata
- Test end-to-end sur wasm devnet
- Préparer la démo + pitch

## Conventions

- TypeScript strict, pas de `any` (sauf raw-tx.ts pour bypass encode)
- Composants React : function components, PascalCase
- Fichiers : kebab-case
- API Routes dans `app/api/`
- XRPL logic dans `lib/xrpl/`
- Sirius logic dans `lib/sirius/`
- Boundless Rust dans `boundless/` (workspace Cargo)
- Auth : timing-safe SHA-256 hash comparison sur toutes les routes
- État in-memory (Maps) — accepté pour hackathon (pnpm dev local)

## Commandes

```bash
pnpm dev          # Dev server
pnpm build        # Build prod
pnpm lint         # Lint

# Boundless (depuis boundless/)
RISC0_DEV_MODE=1 cargo run --bin host -- --dataset datasets/tier1-premium.json --output receipt.json
cargo build --package escrow-mini --target wasm32v1-none --release
```

## Docs

- `Plan.md` — roadmap détaillée avec état de chaque tâche
- `audit.md` — audit exhaustif (7 passes, tous findings tracés)
- `Pitch.md` — script pitch 3min
- `README.md` — architecture détaillée
- xrpl-risc0-starter : https://github.com/boundless-xyz/xrpl-risc0-starter
- Boundless docs : https://docs.boundless.network
