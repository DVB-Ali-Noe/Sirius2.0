# Plan DataLend — PBW26 Hackathon

## Objectif

Démo fonctionnelle end-to-end : un provider dépose un dataset, un borrower emprunte l'accès, paie, et l'accès est révoqué à expiration. **Vraie preuve ZK Boundless vérifiée on-chain XRPL.** Pitch 3min + 2min Q&A.

- **Équipe :** 1 dev (fait tout)
- **Tracks :** XRPL + **Boundless (ZK proofs on-chain XRPL)**
- **Cible :** Jury hackathon XRPL PBW26
- **Réseau XRPL :** alphanet (`wss://alphanet.nerdnest.xyz`) — tous les amendments + Smart Escrow
- **Réseau Boundless :** Base Sepolia (chain ID 84532)

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Frontend (Next.js 16)                   │
│                    App Router, React 19                    │
└──────────────────────────┬───────────────────────────────┘
                           │ API Routes
                           ▼
┌──────────────────────────────────────────────────────────┐
│              Backend (API Routes Next.js)                  │
│   Sirius (encrypt/IPFS/keys/watermark)                    │
│   XRPL logic (MPT/Vault/Lending/Credentials)             │
│   Boundless bridge (CLI subprocess → receipt)             │
└──────┬──────────────┬──────────────┬─────────────────────┘
       │              │              │
       ▼              ▼              ▼
┌──────────────┐ ┌──────────┐ ┌──────────────────┐
│ XRPL alphanet│ │  Pinata  │ │  Boundless       │
│              │ │  (IPFS)  │ │  (Base Sepolia)  │
│ MPT (XLS-33) │ │          │ │                  │
│ Vault (XLS-65)│ │         │ │  Guest program   │
│ Lending(XLS-66)│ │        │ │  → provers GPU   │
│ Creds (XLS-70)│ │         │ │  → receipt       │
│ Domains(XLS-80)│ │        │ │                  │
│ Smart Escrow  │ │         │ │                  │
│ (ZK verify)   │ │         │ │                  │
└──────────────┘ └──────────┘ └──────────────────┘
```

---

## État actuel — Ce qui est fait

### ✅ lib/xrpl/ (15 fichiers) — COMPLET
Client, wallets, MPT, credentials, domains, vault, lending, loan-state, events, repayment, distribution, utils, constants, index.

### ✅ API Routes XRPL (9 routes) — COMPLET
wallets, mint, credentials, vault, loan, loan/status, loan/repay, events, demo. Toutes avec auth timing-safe + validation + try/catch.

### ✅ Wallet connect — COMPLET
xrpl-connect (Gem, Crossmark, Xaman), store Zustand avec rôle + persist, hooks balance/credentials, header intégré.

### ✅ lib/sirius/ (10 fichiers) — FAIT PAR DEV 2
- `encryption.ts` — **Réel** AES-256-GCM
- `merkle.ts` — **Réel** SHA-256 Merkle tree
- `watermark.ts` — **Réel** perturbation déterministe
- `pipeline.ts` — **Réel** orchestre ingest complet
- `ipfs.ts` — **Dual** Pinata si JWT, sinon mock in-memory
- `key-store.ts` — In-memory (OK pour hackathon)
- `dataset-registry.ts` — In-memory (OK pour hackathon)
- `xrpl-bridge.ts` — **Réel** bridge events XRPL ↔ Sirius
- `boundless.ts` — ❌ **MOCK** à remplacer par vrai Boundless

### ✅ API Routes Sirius (7 routes) — FAIT PAR DEV 2
upload, datasets, download, activate, key/status, verify-proof, watermark/detect.

### ✅ Frontend existant
- Landing page + Blob 3D
- Layout (Header, Sidebar, Footer)
- Common components (Modal, Toast, LoadingSpinner, EmptyState)

### ✅ Infra installée
- Rust 1.91.0, RISC Zero toolchain (rzup), Boundless CLI 1.2.2, Foundry (cast), Docker
- Migration alphanet effectuée (constants.ts)

---

## Ce qui reste — Tâches détaillées

### BLOC A — Boundless ZK (priorité absolue)

C'est le différenciateur. Sans ça, pas de track Boundless.

#### A1. Setup Boundless requestor (15min)
- [ ] `boundless requestor setup` → choisir `base-sepolia`, fournir private key + RPC URL
- [ ] `boundless requestor deposit 0.005` → déposer ETH Base Sepolia
- [ ] Vérifier le solde dans le contrat BoundlessMarket

#### A2. Guest program Rust — `dataset-certifier` (2h)
Le code prouvé dans le zkVM. Reçoit un dataset JSON, calcule et commit :
- [ ] Créer le projet Rust : `cargo risczero new dataset-certifier`
- [ ] Guest (`methods/guest/src/main.rs`) :
  - Lire le dataset JSON depuis stdin
  - Compter les entrées (`entry_count`)
  - Calculer le taux de doublons par hash (`duplicate_rate`)
  - Vérifier la conformité schéma (`schema_valid`, `field_completeness`)
  - Calculer le `quality_score` (0-100) :
    - Taille dataset (max 30pts)
    - Doublons (max 30pts)
    - Schéma valide (20pts)
    - Complétude champs (max 20pts)
  - Calculer le SHA-256 du dataset (`dataset_hash`)
  - `env::commit` toutes les assertions dans le journal
- [ ] Tester localement avec `RISC0_DEV_MODE=1 cargo run` (fake proof, instantané)
- [ ] Compiler le guest en .bin : `cargo risczero build`

#### A3. Soumettre une preuve sur Boundless (30min)
- [ ] Servir le .bin via un tunnel ou upload sur Pinata
- [ ] Créer le `request.yaml` avec le guest + input (dataset de test)
- [ ] `boundless requestor submit-file request.yaml`
- [ ] `boundless requestor status <ID>` → attendre fulfillment
- [ ] `boundless requestor get-proof <ID>` → récupérer le receipt (journal + seal)
- [ ] Sauvegarder le receipt JSON

#### A4. Smart Escrow Wasm — vérification on-chain XRPL (1.5h)
- [ ] Étudier le template `xrpl-risc0-starter/escrow/`
- [ ] Écrire `escrow/src/lib.rs` :
  - Fonction `finish()` qui reçoit la preuve dans les memos
  - Vérifie le receipt contre l'Image ID du guest
  - Lit le journal : vérifie `quality_score >= seuil`, `schema_valid == true`
  - Si OK → escrow finished → preuve validée on-chain
- [ ] Compiler en Wasm : `cargo build --target wasm32v1-none`
- [ ] Funder un wallet sur alphanet via faucet
- [ ] Déployer l'escrow sur alphanet
- [ ] Soumettre la tx FinishEscrow avec la preuve dans les memos
- [ ] Vérifier que la tx réussit → preuve validée on-chain XRPL

#### A5. Remplacer le mock boundless.ts (1h)
- [ ] Réécrire `lib/sirius/boundless.ts` :
  - `generateQualityProof()` → appelle le binaire host Rust via `child_process` ou la CLI Boundless
  - Attend le fulfillment, récupère le receipt
  - Retourne le receipt réel (journal + seal + image_id)
  - `verifyQualityProof()` → vérifie le receipt localement ou via le tx hash on-chain
- [ ] Mettre à jour le type `BoundlessProof` avec les vrais champs (journal, seal, imageId, proofTxHash)
- [ ] Mettre à jour `pipeline.ts` pour utiliser le vrai flow

#### A6. Intégrer dans le flow MPT (30min)
- [ ] Mettre à jour `DatasetMetadata` dans `mpt.ts` :
  - Ajouter `zk.qualityScore`, `zk.proofTxHash`, `zk.proofNetwork`, `zk.imageId`
  - Garder les champs existants (dataset, ipfsHash, etc.)
- [ ] Mettre à jour la demo route pour :
  1. Ingérer le dataset (Sirius)
  2. Générer la preuve ZK (Boundless)
  3. Déployer + finish le Smart Escrow (alphanet)
  4. Minter le MPT avec le tx hash de la vérification
- [ ] API Route `POST /api/xrpl/prove` — orchestre le flow ZK complet

---

### BLOC B — Bugs à corriger (code Dev 2)

#### B1. Fix verify-proof (15min)
- [ ] `api/sirius/verify-proof/route.ts` : vérifie le commitment contre lui-même → toujours true
  - Fix : passer le digest des données réelles, pas `proof.commitment`

#### B2. Fix computeDatasetDigest (15min)
- [ ] `lib/sirius/boundless.ts` : ne hash que les 32 premières lignes
  - Fix : hasher toutes les lignes (ou un sample représentatif plus grand)

#### B3. Fix detectWatermark (15min)
- [ ] `lib/sirius/watermark.ts` : ne détecte pas la perturbation numérique
  - Fix : ajouter la détection des micro-perturbations numériques

---

### BLOC C — Frontend pages (si temps restant)

Ce bloc est moins prioritaire que A et B. Le jury voit l'UI mais le différenciateur c'est le ZK.

#### C1. Page Provider Dashboard
- [ ] Upload dataset (formulaire + drag & drop)
- [ ] Affiche les datasets déposés avec quality score ZK
- [ ] Suivi des revenus (intérêts reçus)

#### C2. Page Marketplace / Vault
- [ ] Browse les datasets disponibles (cards)
- [ ] Affiche le quality score + certificat ZK vérifiable
- [ ] Bouton "Request Loan"

#### C3. Page Borrower Dashboard
- [ ] Loan actif avec status (PENDING → ACTIVE → REPAYING → COMPLETED)
- [ ] Accès au dataset (download ou query)
- [ ] Repayment tracker (montant dû, payé, restant)

#### C4. Page Admin (rôle loanbroker)
- [ ] Émettre credentials (certifier provider, KYB borrower)
- [ ] Créer vault / lending pool
- [ ] Voir tous les loans + trigger default
- [ ] Distribuer les intérêts

#### C5. Sidebar conditionnel
- [ ] Afficher les liens selon `useWalletStore().role`
- [ ] Provider voit : Dashboard, My Datasets
- [ ] Borrower voit : Dashboard, Marketplace, My Loans
- [ ] LoanBroker voit : tout + Admin

#### C6. Composants UI
- [ ] Dataset card (nom, score, catégorie, ZK badge)
- [ ] Loan status badge (colored par état)
- [ ] Quality certificate viewer (modal avec détails ZK)
- [ ] Repayment progress bar

---

### BLOC D — Polish & Démo

#### D1. Dataset de démo (15min)
- [ ] 1000 rows instruction-tuning réalistes
- [ ] Format JSONL : instruction, response, category, difficulty, score

#### D2. Test end-to-end (30min)
- [ ] Provider : upload → ZK proof → mint MPT → deposit vault
- [ ] Borrower : browse → request loan → accès → repay
- [ ] Expiration : clé révoquée, MPT retourne au vault
- [ ] Vérification : prouver que le ZK score est authentique

#### D3. Pitch (30min)
- [ ] Script 3min
- [ ] Anticiper Q&A (Boundless, XRPL, Sirius, scoring, cross-chain)
- [ ] Screenshots/vidéo de backup si réseau instable

---

## Ordre d'exécution recommandé

```
A1 (setup Boundless)       15min  ← MAINTENANT
A2 (guest program Rust)    2h
A3 (soumettre preuve)      30min
A4 (Smart Escrow Wasm)     1.5h
A5 (remplacer mock)        1h
A6 (intégrer MPT)          30min
─── checkpoint : ZK proof end-to-end fonctionne ───
B1-B3 (fix bugs Dev 2)     45min
C1-C6 (pages frontend)     3-4h  ← si temps
D1-D3 (polish + démo)      1h
```

**Total estimé : 8-10h**
**Priorité absolue : Bloc A (ZK proof on-chain)**

---

## Risques

| Risque | Impact | Plan B |
|--------|--------|--------|
| Guest program trop lent dans le zkVM | Moyen | Réduire le dataset à 100 rows pour la preuve |
| Boundless proving timeout | Faible | Preuve pré-générée avant la démo |
| Smart Escrow deploy échoue sur alphanet | Moyen | Stocker le receipt sur IPFS, référencer dans MPT (pas de vérification on-chain) |
| alphanet down | Moyen | Fallback devnet standard (sans ZK on-chain) |
| xrpl.js incompatible avec alphanet | Moyen | Tester avant de tout migrer, garder la version actuelle si ça marche |
| Temps insuffisant pour le front | Élevé | Focus sur 1 page provider + 1 page borrower minimum |
| Faucet alphanet down | Moyen | Contacter l'équipe au hackathon |

---

## Critères de succès

- [ ] **Preuve ZK Boundless vérifiée on-chain XRPL** (Smart Escrow sur alphanet)
- [ ] Quality score calculé dans le zkVM et affiché dans le MPT
- [ ] Flow end-to-end : provider deposit → borrower access → expiry
- [ ] Au moins 1 tx XRPL réelle avec ZK proof
- [ ] Dataset encrypté et stocké sur IPFS
- [ ] UI qui raconte l'histoire en 3min
- [ ] Réponses solides sur l'archi pendant Q&A

---

## Story de la démo (3min)

```
1. "Je suis un data provider. J'ai un dataset d'instruction tuning."
   → Upload → encryption → preuve ZK via Boundless → quality score prouvé
   → Vérifié on-chain XRPL via Smart Escrow → MPT minté → déposé dans le vault

2. "La qualité est prouvée cryptographiquement. Score : 88/100."
   → Montrer le Smart Escrow on-chain → preuve vérifiée → trustless
   → Le score est calculé dans le zkVM, personne ne peut le falsifier

3. "Je suis un AI startup. Je veux ce dataset pour 30 jours."
   → Browse vault → voir quality score ZK vérifié → request loan → payer

4. "J'ai accès. Voici mes données."
   → Dashboard borrower → dataset décrypté → watermarked

5. "Le loan expire."
   → Accès révoqué → provider reçoit ses intérêts → MPT retourne au vault

6. "Et si je leak les données ?"
   → Watermark unique → traçabilité → credential blacklisté
```
