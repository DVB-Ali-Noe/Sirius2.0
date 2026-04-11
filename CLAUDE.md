# CLAUDE.md — DataLend Protocol

## Projet

DataLend — Lending pool DeFi pour datasets IA, built on XRPL.
Hackathon PBW26, 2 devs backend.

## Stack

- **Frontend :** Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS v4
- **3D/Animations :** Three.js + React Three Fiber, GSAP + Lenis, Framer Motion
- **State :** Zustand (client), React Query (server)
- **Charts :** Recharts
- **Backend :** API Routes Next.js (pas de serveur séparé)
- **XRPL :** xrpl.js, devnet
- **Storage :** Pinata (IPFS)
- **Encryption :** AES-256-GCM (Node.js crypto)

## Architecture

```
Frontend (Next.js 16)
  → API Routes (Sirius + Loan logic + IPFS)
    → XRPL Devnet (MPT, Vault, Lending, Credentials)
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
- Pas de commentaires évidents
- Pas de code mort, pas de TODO

## XRPL Primitives utilisées

- **XLS-33** — MPT (Multi-Purpose Token) : représente un dataset on-chain
- **XLS-65** — Vault : pool les MPTs des providers
- **XLS-66** — Lending Protocol : gère les loans
- **XLS-70** — Credentials : KYB borrower, certification provider
- **XLS-80** — Permissioned Domains : contrôle d'accès au vault

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
