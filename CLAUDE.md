# CLAUDE.md — DataLend Protocol

## Projet

DataLend — Lending pool DeFi pour datasets IA, built on XRPL.
Hackathon PBW26, 2 devs backend.
**Track Boundless** : ZK proofs vérifiées on-chain XRPL via Smart Escrow Wasm.

## Stack

- **Frontend :** Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS v4
- **3D/Animations :** Three.js + React Three Fiber, GSAP + Lenis, Framer Motion
- **State :** Zustand (client), React Query (server)
- **Charts :** Recharts
- **Backend :** API Routes Next.js (pas de serveur séparé)
- **XRPL :** xrpl.js@4.5.0-smartescrow.4, alphanet (ZK precompile)
- **ZK Proofs :** RISC Zero zkVM + Boundless prover network (Base Sepolia)
- **Smart Escrow :** Wasm sur XRPL (vérifie les preuves ZK on-chain)
- **Wallet :** xrpl-connect (Gem, Crossmark, Xaman)
- **Storage :** Pinata (IPFS)
- **Encryption :** AES-256-GCM (Node.js crypto)

## Architecture

```
Frontend (Next.js 16)
  → API Routes (Sirius + Loan logic + IPFS)
    → XRPL alphanet Devnet (MPT, Vault, Lending, Credentials, Smart Escrow)
    → Boundless (Base Sepolia) → proving network → receipt
    → Pinata (IPFS storage)
```

## Conventions

- TypeScript strict, pas de `any`
- Composants React : function components, pas de class
- Nommage fichiers : kebab-case
- Nommage composants : PascalCase
- API Routes dans `app/api/`
- Libs/utils dans `lib/`
- XRPL logic dans `lib/xrpl/`
- Sirius logic dans `lib/sirius/`
- Boundless/ZK logic dans `lib/boundless/` ou dossier Rust séparé
- Pas de commentaires évidents
- Pas de code mort, pas de TODO

## XRPL Primitives utilisées

- **XLS-33** — MPT (Multi-Purpose Token) : représente un dataset on-chain
- **XLS-65** — Vault : pool les MPTs des providers
- **XLS-66** — Lending Protocol : gère les loans
- **XLS-70** — Credentials : KYB borrower, certification provider
- **XLS-80** — Permissioned Domains : contrôle d'accès au vault
- **Smart Escrow (Wasm)** — vérifie les preuves ZK Boundless directement on-chain XRPL

## ZK Proof Flow (Boundless)

```
Dataset → Guest program (Rust/RISC-V) → Boundless (Base Sepolia)
  → provers génèrent la preuve → receipt (journal + seal)
  → Smart Escrow Wasm sur XRPL vérifie la preuve on-chain
  → MPT minté avec zkProofRef = tx hash de la vérification
```

## Réseaux

- **XRPL :** alphanet (`wss://alphanet.nerdnest.xyz`)
- **Faucet XRPL :** `https://alphanet.faucet.nerdnest.xyz/accounts`
- **Boundless :** Base Sepolia (chain ID 84532)
- **BoundlessMarket :** `0x56da3786061c82214d18e634d2817e86ad42d7ce`

## Commandes

```bash
pnpm dev          # Dev server
pnpm build        # Build prod
pnpm lint         # Lint
```

## Docs de référence

- Plan du projet : `Plan.md`
- Pitch : `Pitch.md`
- Architecture détaillée : `README.md`
- XRPL docs : https://xrpl.org/docs
- xrpl.js : https://js.xrpl.org
- Boundless docs : https://docs.boundless.network
- XRPL RISC0 Starter : https://github.com/boundless-xyz/xrpl-risc0-starter
