# Plan DataLend — PBW26 Hackathon

## Objectif

Démo fonctionnelle end-to-end : un provider dépose un dataset, un borrower emprunte l'accès, paie, et l'accès est révoqué à expiration. **Vraie preuve ZK vérifiée on-chain XRPL.** Pitch 3min + 2min Q&A.

- **Tracks :** XRPL + **Boundless (ZK proofs on-chain XRPL)**
- **Réseau XRPL :** wasm devnet (`wss://wasm.devnet.rippletest.net:51233`)
- **Faucet :** `https://wasmfaucet.devnet.rippletest.net/accounts` ✅ Fonctionnel
- **Boundless (standby) :** Base Sepolia, config dans `~/.boundless/`

---

## État actuel

### ✅ TERMINÉ

**lib/xrpl/ (16 fichiers)**
- client.ts, constants.ts, wallets.ts, mpt.ts, credentials.ts, domains.ts
- vault.ts, lending.ts (raw signing XLS-66), loan-state.ts, events.ts
- repayment.ts (LoanPay natif), distribution.ts, utils.ts, raw-tx.ts, escrow.ts, index.ts

**API Routes XRPL (10 routes)** — toutes auth + validation + try/catch
- wallets, mint, credentials, vault, loan, loan/status, loan/repay, events, demo, distribute

**Wallet connect** — xrpl-connect, store Zustand persist, rôle, hooks

**lib/sirius/ (10 fichiers)** — encryption, merkle, watermark, pipeline, ipfs, key-store, registry, xrpl-bridge, boundless (mock), index

**API Routes Sirius (7 routes)** — upload, datasets, download, activate, key/status, verify-proof, watermark/detect

**Frontend** — Landing, Layout, Wallet, Pages (provider, marketplace, borrower, dashboard)

**Boundless Rust (boundless/)**
- Guest program `dataset-certifier` ✅ — journal 58 bytes, scores 100/74/34 sur 3 tiers
- Host program ✅ — parse journal, vérifie localement
- Escrow Wasm (escrow-mini) ✅ — 3.3KB, vérifie score >= 50
- Escrow déployé sur wasm devnet ✅ — sequence 1707429
- 3 datasets de démo ✅ — tier1 (1000 rows), tier2 (500), tier3 (200)
- Boundless Base Sepolia ✅ — setup + deposit 0.005 ETH (standby, provers testnet indisponibles)

**Sécurité** — 5 passes d'audit, tous fix critiques appliqués
- Auth timing-safe (SHA-256 hash comparison, plus d'oracle de longueur)
- Validation body, try/catch, race condition client (finally)
- State machine respectée (addPayment, checkDefault → transitionLoan)
- tesSUCCESS vérifié avant addPayment et distribution
- Clé dérivée par borrower/loan (deriveKey)
- Score clampé à 100, drops en entiers (Math.round)
- distributedAt atomique

**Migration xrpl.js**
- `xrpl@4.5.0-smartescrow.4` — Smart Escrow natif
- `ripple-binary-codec@2.6.0-smartescrow.3` — encode FinishFunction
- `ripple-keypairs` — raw signing XLS-66 (LoanSet, LoanPay, etc.)

---

### 🔨 EN COURS — Blocker Smart Escrow

**Problème :** `EscrowFinish` avec `ComputationAllowance` échoue — le codec smartescrow encode le field ID en conflit avec `PreviousPaymentDueDate` de XLS-66. Sans `ComputationAllowance`, le Wasm retourne `tefWASM_FIELD_NOT_INCLUDED`.

**Options à explorer :**
- [ ] Encoder `ComputationAllowance` manuellement dans le blob (bypass codec)
- [ ] Tester avec un codec sans les champs XLS-66
- [ ] Contacter l'équipe Boundless/XRPL au hackathon
- [ ] Utiliser le Web UI du starter pour finish l'escrow manuellement

---

## Ce qui reste

### BLOC A — Smart Escrow finish (priorité)

- [ ] Résoudre le conflit ComputationAllowance / PreviousPaymentDueDate
- [ ] Tester le EscrowFinish avec le journal Tier 1 → WasmReturnCode = 1
- [ ] Créer l'API route `POST /api/xrpl/prove` qui orchestre le flow ZK
- [ ] Intégrer dans le MPT : ajouter `zk.qualityScore`, `zk.proofTxHash`, `zk.imageId`
- [ ] Remplacer `lib/sirius/boundless.ts` mock par le vrai flow

### BLOC B — Bugs Sirius

- [ ] `verify-proof/route.ts` : vérifie le commitment contre lui-même
- [ ] `boundless.ts` computeDatasetDigest : ne hash que 32 premières lignes
- [ ] `watermark.ts` detectWatermark : ne détecte pas la perturbation numérique

### BLOC C — Frontend (autre Claude en parallèle)

- [ ] Page Provider Dashboard
- [ ] Page Marketplace / Vault (choisir pool → datasets → loan)
- [ ] Page Borrower Dashboard
- [ ] Page Admin (rôle loanbroker)
- [ ] Sidebar conditionnel par rôle
- [ ] Composants : dataset card, loan status, ZK badge, repayment progress

### BLOC D — Polish & Démo

- [ ] Test end-to-end complet sur wasm devnet
- [ ] Script pitch 3min
- [ ] Q&A préparées
- [ ] Mode offline-proof

---

## Risques

| Risque | Impact | Plan B |
|--------|--------|--------|
| ComputationAllowance field conflict | **Bloquant** | Encoder manuellement / utiliser Web UI du starter |
| Boundless proving indisponible sur testnet | Faible | Proving local (RISC0_DEV_MODE) + escrow on-chain |
| wasm devnet down | Moyen | Fallback devnet standard (sans ZK) |
| Wasm trop gros pour vérification ZK complète | **Résolu** | Mini escrow (3.3KB) vérifie le score |
| Temps insuffisant pour le front | Élevé | Focus provider + borrower minimum |

---

## Critères de succès

- [ ] **Smart Escrow finish avec quality score vérifié on-chain XRPL**
- [ ] Quality score ZK affiché dans le MPT metadata
- [ ] Flow end-to-end : provider deposit → borrower access → expiry
- [ ] Dataset encrypté et stocké sur IPFS
- [ ] UI qui raconte l'histoire en 3min
- [ ] Réponses solides sur l'archi pendant Q&A

---

## Story de la démo (3min)

```
1. "Je suis un data provider. J'ai un dataset d'instruction tuning."
   → Upload → encryption → preuve ZK RISC Zero → quality score 100/100
   → Smart Escrow vérifie on-chain XRPL → MPT minté → déposé dans le vault

2. "La qualité est prouvée. Score : 100/100."
   → Montrer la tx EscrowFinish on-chain → WasmReturnCode = 1 → trustless
   → Le score est calculé dans le zkVM, personne ne peut le falsifier

3. "Je suis un AI startup. Je veux ce dataset pour 30 jours."
   → Browse vault → voir quality score ZK → request loan → payer

4. "J'ai accès."
   → Dashboard borrower → dataset décrypté → watermarked

5. "Le loan expire."
   → Accès révoqué → provider reçoit ses intérêts → MPT retourne au vault

6. "Et si je leak les données ?"
   → Watermark unique → traçabilité
```
