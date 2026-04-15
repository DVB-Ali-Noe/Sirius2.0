# CLAUDE.md — Sirius 2.0 / DataLend Protocol

## Projet

DataLend = DeFi lending pool pour datasets IA sur XRPL. Le provider depose un dataset encrypte (MPT) dans un Vault, le borrower emprunte l'acces temporaire, paie en XRP via Otsu wallet, et l'acces est revoque a expiration.

## Stack

- **Frontend** : Next.js 16 (Turbopack) + React 19 + Tailwind 4 + Three.js + Zustand
- **Backend** : API routes Next.js (src/app/api/)
- **Blockchain** : XRPL wasm devnet (`wss://wasm.devnet.rippletest.net:51233`)
- **Storage** : IPFS via Pinata (PINATA_JWT dans .env)
- **Persistance** : JSON fichiers dans `.sirius-data/` (datasets, loans, keys)
- **ZK** : Boundless / RISC Zero (boundless/ — Rust, actuellement mocke)
- **Wallet** : Otsu (browser extension, `src/lib/wallet/otsu.ts`)

## Primitives XRPL utilisees

- XLS-33 (MPT) — tokenise le dataset (mint, authorize, destroy)
- XLS-65 (Vault) — pool les MPT des providers (create, deposit, withdraw, delete, clawback)
- XLS-66 (Lending) — loans on-chain (LoanSet, LoanPay, LoanDelete, LoanBrokerSet, LoanBrokerDelete)
- XLS-70 (Credentials) — DataProviderCertified, BorrowerKYB
- XLS-80 (Permissioned Domains) — controle d'acces au vault

## Wallets (.env)

- Provider : `r9UWF8KJhrAH7oZiFSUyjiyJ2GhQZ4yQ1Q` (seed XRPL_PROVIDER_SEED) — wallet serveur legacy
- Borrower : `r9txRLSAarXYm4s2DaVThkwPret8kgE9Uv` (seed XRPL_BORROWER_SEED) — wallet serveur legacy
- LoanBroker (ancien) : `rUk2B7YqsKzs6MEMbKPFpY2JK3cYjZ4oGy` (seed XRPL_LOANBROKER_SEED) — plus utilise directement
- **Admin** : `raQzzP6EB5MAQaM2pyGdMbqgYQNhknMmSh` (seed XRPL_ADMIN_SEED) — **wallet actif pour toutes les operations serveur** (`getLoanBroker()` utilise ce seed)

> Le provider/borrower reel utilise Otsu (wallet browser). Les wallets .env sont pour les operations serveur (vault create, credential issue, LoanBrokerSet).

## Commandes

```bash
pnpm dev         # Lance le serveur de dev (http://localhost:3000)
pnpm build       # Build production
pnpm lint        # ESLint
```

## Structure cle

```
src/
  app/
    (app)/           # Pages avec layout (dashboard, provider, marketplace, borrower, admin)
    api/
      provider/      # Upload pipeline (prepare, register-mpt, finalize), datasets list, delete
      sirius/        # Download, activate, verify-proof, watermark/detect, datasets, key
      xrpl/          # Wallets, mint, credentials, vault, loan, demo, fund, pools, distribute, cleanup, verify-payment, extend-access
  components/        # UI components
  hooks/             # React hooks (useMyDatasets, useDatasets, useLoans, useRoleDetection, useRouteGuard, etc.)
  lib/
    sirius/          # Encryption, merkle, watermark, pipeline, ipfs, key-store, registry, boundless, xrpl-bridge
    xrpl/            # Client, mpt, vault, lending, credentials, domains, escrow, events, loan-state, distribution, patch-codec
    wallet/          # otsu.ts — Otsu wallet integration (connect, sign, submit)
    persistence.ts   # JSON file persistence (.sirius-data/)
  stores/            # Zustand (wallet state, search state)
.sirius-data/        # Persistent JSON stores (datasets, loans, keys) — survit aux restart serveur
boundless/           # Rust — guest program + escrow wasm (non compile)
```

## Auth

- API routes : header `x-api-key` = `NEXT_PUBLIC_API_KEY`
- Frontend : Otsu wallet connect → role detection via credentials on-chain
- Admin : `NEXT_PUBLIC_ADMIN_ADDRESS` ou `NEXT_PUBLIC_LOANBROKER_ADDRESS` → role `loanbroker`

## Roles

Detection automatique via `useRoleDetection()` :
- `loanbroker` : address === NEXT_PUBLIC_LOANBROKER_ADDRESS ou NEXT_PUBLIC_ADMIN_ADDRESS
- `provider` : credential DataProviderCertified on-chain
- `borrower` : credential BorrowerKYB on-chain
- `null` : aucun credential → OnboardingPanel sur /dashboard

## Flow Provider Upload (client-signing via Otsu)

1. `POST /api/provider/upload/prepare` — Sirius encrypt + IPFS + ZK proof + unsigned MPTokenIssuanceCreate tx
2. User signe MPT mint dans Otsu
3. Frontend poll `/api/xrpl/tx?hash=` pour confirmer le mpt_issuance_id
4. `POST /api/provider/upload/register-mpt` — serveur cree vault + domain + LoanBroker, retourne unsigned authorize + deposit tx
5. User signe MPT authorize dans Otsu
6. User signe vault deposit dans Otsu
7. `POST /api/provider/upload/finalize` — finalisation

## Flow Borrow (pay-then-verify via Otsu)

1. Borrower choisit un dataset dans /marketplace, selectionne la duree
2. Otsu signe un Payment XRP vers le provider
3. `POST /api/xrpl/verify-payment` — poll la tx on-chain (15s max), verifie montant/destination/source
4. Serveur cree un loan local + active la cle Sirius + genere watermark seed
5. Borrower voit le loan dans /borrower, peut "Access Data" (decrypt + watermark)

## Flow Extend Access

1. Borrower clique "Extend" sur un loan, choisit les jours additionnels
2. Otsu signe un Payment XRP
3. `POST /api/xrpl/extend-access` — verifie tx, etend expiresAt + cle

## Flow Delete Dataset (provider)

1. Provider clique sur un dataset → popup avec details
2. "Supprimer" → `POST /api/provider/datasets/delete` action=prepare → retourne unsigned tx (VaultWithdraw, MPT Unauthorize, MPT Destroy)
3. User signe les 3 tx dans Otsu
4. `POST /api/provider/datasets/delete` action=finalize → serveur delete LoanBroker + Vault + unpin IPFS + cleanup registry

## Persistance

Les 3 stores (datasets, loans, keys) sont persistes dans `.sirius-data/*.json` via `src/lib/persistence.ts`. Chaque mutation (register, attach, transition, issue, revoke) declenche un `saveStore()`. Au demarrage, `loadStore()` recharge depuis les fichiers.

## Patch Codec XLS-66

`patchCodecForXLS66()` dans `src/lib/xrpl/patch-codec.ts` est appele au chargement de `client.ts`. Il enregistre les types de transaction XLS-66 (LoanBrokerSet, LoanDelete, etc.) dans le binary codec.

---

## BUGS CONNUS

### BUG-1 : Vaults fantomes persistants sur wasm devnet
- Les `VaultDelete` retournent `tesSUCCESS` mais les vaults reapparaissent. Probablement un bug du wasm devnet.
- **Mitigation** : Les vaults sans MPT valide (metadata lookup echoue) sont filtres cote serveur dans `/api/xrpl/pools`.

### BUG-2 : ZK Proofs 100% mockees
- `generateQualityProof()` cree un fake commitment SHA256. Pas de RISC Zero.
- Tous les badges "ZK Verified" dans l'UI sont factices.

### BUG-3 : verify-proof tautologique
- Recalcule le digest depuis les memes donnees puis compare.

### BUG-4 : computeDatasetDigest ne hash que 32 lignes
- `.slice(0, 32)` dans `boundless.ts`.

### BUG-5 : Watermark detection peu fiable
- Perturbation 1e-6 indistinguable du bruit float.

### BUG-6 : Smart Escrow bloque
- Conflit field ID dans le codec.

### BUG-7 : LoanSet temBAD_SIGNER sur wasm devnet
- `LoanSet` echoue systematiquement. Le flow borrow utilise pay-then-verify comme contournement.

### BUG-8 : VaultDelete tecHAS_OBLIGATIONS
- Les vaults avec PermissionedDomain ne peuvent pas etre supprimes. Le MPT et LoanBroker sont supprimes, le vault reste en fantome.

---

## Checklist pre-demo

- [ ] `pnpm dev` tourne sans erreur
- [ ] Les wallets admin/provider sont fundes (1000 XRP chacun)
- [ ] Un dataset a ete uploade dans cette session (peuple le registry persistent)
- [ ] L'explorer XRPL wasm devnet est accessible
- [ ] Le navigateur est en plein ecran, mode sombre
- [ ] Otsu wallet est deverrouille et sur wasm-devnet
- [ ] Les onglets sont pre-ouverts : /provider, /marketplace, /borrower, /admin
