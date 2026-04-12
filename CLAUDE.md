# CLAUDE.md — DataLend Protocol

## Projet

DataLend — Lending pool DeFi pour datasets IA, built on XRPL.
Hackathon PBW26.
**Track Boundless** : ZK proofs vérifiées on-chain XRPL via Smart Escrow Wasm.

## Stack

- **Frontend :** Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS v4
- **3D/Animations :** Three.js + React Three Fiber, GSAP + Lenis, Framer Motion
- **State :** Zustand (client), React Query (server)
- **Charts :** Recharts
- **Backend :** API Routes Next.js (pas de serveur séparé)
- **XRPL :** xrpl.js@4.5.0-smartescrow.4, wasm devnet
- **XLS-66 (Loans) :** raw signing via ripple-keypairs (le codec sait encoder, mais xrpl.js validate() rejette)
- **ZK Proofs :** RISC Zero zkVM, proving local (Boundless Base Sepolia en standby)
- **Smart Escrow :** Wasm sur XRPL (vérifie le quality score on-chain)
- **Wallet :** xrpl-connect (Gem, Crossmark, Xaman)
- **Storage :** Pinata (IPFS)
- **Encryption :** AES-256-GCM (Node.js crypto)

## Architecture

```
Frontend (Next.js 16)
  → API Routes (Sirius + Loan logic + IPFS)
    → XRPL wasm devnet (MPT, Vault, Lending, Credentials, Smart Escrow)
    → Boundless (Base Sepolia, standby) → proving network
    → Pinata (IPFS storage)
```

## Conventions

- TypeScript strict, pas de `any` (sauf raw-tx.ts pour bypass encode)
- Composants React : function components, pas de class
- Nommage fichiers : kebab-case
- Nommage composants : PascalCase
- API Routes dans `app/api/`
- Libs/utils dans `lib/`
- XRPL logic dans `lib/xrpl/`
- Sirius logic dans `lib/sirius/`
- Boundless/ZK : dossier `boundless/` à la racine (Rust workspace)
- Pas de commentaires évidents
- Pas de code mort, pas de TODO

## XRPL Primitives utilisées

- **XLS-33** — MPT (Multi-Purpose Token) : représente un dataset on-chain
- **XLS-65** — Vault : pool les MPTs des providers
- **XLS-66** — Lending Protocol : gère les loans (raw signing obligatoire)
- **XLS-70** — Credentials : KYB borrower, certification provider
- **XLS-80** — Permissioned Domains : contrôle d'accès au vault
- **Smart Escrow (Wasm)** — vérifie le quality score ZK on-chain XRPL

## ZK Proof Flow

```
1. Dataset → Guest program (Rust/RISC-V) → proving local
2. Journal (58 bytes) : score, entry_count, duplicates, schema, completeness, hash
3. Smart Escrow Wasm déployé sur XRPL wasm devnet
4. EscrowFinish tx avec journal dans les Memos
5. Le Wasm vérifie score >= 50 on-chain
6. MPT minté avec zk.proofTxHash = hash de la tx EscrowFinish
```

## Réseaux

- **XRPL :** wasm devnet (`wss://wasm.devnet.rippletest.net:51233`)
- **Faucet XRPL :** `https://wasmfaucet.devnet.rippletest.net/accounts`
- **Boundless (standby) :** Base Sepolia (chain ID 84532)
- **BoundlessMarket :** `0x56da3786061c82214d18e634d2817e86ad42d7ce`

## Signing strategy

| Tx type | Signé par | Méthode |
|---------|-----------|---------|
| MPT, Vault, Escrow, Credentials | User (wallet popup) ou serveur | `submitAndWait()` natif |
| LoanBrokerSet, LoanSet, LoanPay, LoanManage, LoanDelete | LoanBroker (serveur) | `submitRawTx()` via ripple-keypairs |

## Problèmes connus

- **ComputationAllowance** dans EscrowFinish est encodé avec le mauvais field ID par le codec smartescrow (conflit avec PreviousPaymentDueDate de XLS-66). Contournement en cours.
- **Wasm de vérification ZK complète** (risc0-verifier-xrpl-wasm) fait 131KB, trop gros pour le devnet. On utilise un mini escrow (3.3KB) qui vérifie le score uniquement.
- **Boundless Base Sepolia** : requête soumise mais expirée (aucun prover testnet dispo). Config en standby dans `~/.boundless/`.

## Commandes

```bash
pnpm dev          # Dev server
pnpm build        # Build prod
pnpm lint         # Lint

# Boundless (depuis boundless/)
RISC0_DEV_MODE=1 cargo run --bin host -- --dataset datasets/tier1-premium.json --output receipt.json
cargo build --package escrow-mini --target wasm32v1-none --release
```

## Docs de référence

- Plan du projet : `Plan.md`
- Pitch : `Pitch.md`
- Architecture détaillée : `README.md`
- XRPL docs : https://xrpl.org/docs
- xrpl.js : https://js.xrpl.org
- Boundless docs : https://docs.boundless.network
- XRPL RISC0 Starter : https://github.com/boundless-xyz/xrpl-risc0-starter
