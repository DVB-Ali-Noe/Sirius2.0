# Plan DataLend — PBW26 Hackathon

## Objectif

Démo fonctionnelle end-to-end : un provider dépose un dataset, un borrower emprunte l'accès, paie, et l'accès est révoqué à expiration. Pitch 3min + 2min Q&A.

- **Équipe :** 2 devs backend (dont 1 très bon en crypto)
- **Temps restant :** 18h
- **Cible :** Jury hackathon XRPL PBW26
- **Réseau :** XRPL Testnet/Devnet

---

## Hypothèses à vérifier immédiatement (1h max)

| Point | Comment vérifier | Impact si indisponible |
|---|---|---|
| XLS-65/66 sur devnet | `xrpl.org/docs` + tester une tx sur devnet | Simuler vault/lending côté backend (DB + logique custom) |
| Boundless SDK | Checker leur doc/GitHub | Générer des "preuves" statiques crédibles pour la démo |
| IPFS provider | Créer un compte Pinata (gratuit, 2min) | Pinata par défaut, c'est le plus simple |

---

## Architecture

```
┌──────────────────────────────────┐
│     Next.js 16 Frontend          │
│     (App Router, existant)       │
└──────────────┬───────────────────┘
               │ API Routes
               ▼
┌──────────────────────────────────┐
│     Backend (API Routes Next.js) │
│     - Sirius (encrypt/decrypt)   │
│     - Loan logic                 │
│     - IPFS upload (Pinata)       │
└──────────┬───────────┬───────────┘
           │           │
           ▼           ▼
┌──────────────┐ ┌─────────────┐
│  XRPL Devnet │ │  Pinata     │
│  (MPT, Creds)│ │  (IPFS)     │
└──────────────┘ └─────────────┘
```

### Stack

- **Frontend :** Next.js 16 (App Router), React 19, TypeScript 5, Tailwind v4
- **3D/Animations :** Three.js + R3F, GSAP + Lenis, Framer Motion
- **State :** Zustand (client), React Query (server)
- **Charts :** Recharts
- **Backend :** API Routes Next.js (pas de serveur séparé)
- **XRPL :** xrpl.js sur devnet
- **Wallet :** xrpl-connect (Gem, Crossmark, Xaman)
- **Storage :** Pinata (IPFS)
- **Encryption :** AES-256-GCM (Node.js crypto)

---

## Répartition des rôles

| Dev 1 (Crypto) | Dev 2 (Backend + Front) |
|---|---|
| Vérification XLS-65/66/70/80 sur devnet | Setup Pinata + upload/download IPFS |
| MPT minting (XLS-33) | Sirius : encryption AES + key management |
| Vault + Lending (natif ou simulé) | Sirius : Merkle tree du dataset |
| Credentials (XLS-70) | Adaptation frontend (pages + flow) |
| Intégration wallet XRPL (xrpl-connect) | ZK proofs (Boundless ou mock crédible) |
| Loan flow + state machine | Composants UI (dataset card, loan status, etc.) |
| Events XRPL + repayment + distribution | Stores Zustand + hooks React Query |
| API Routes XRPL | Animations de transition |
| Détection rôle wallet (loanbroker/provider/borrower) | Pages provider, marketplace, borrower, admin |

---

## Phases de développement

### Phase 0 — Validation & Setup (1h) ✅ Dev 1

- [x] Vérifier dispo XLS-65/66 sur devnet → **Toutes dispo**
- [x] Créer compte Pinata → **Dev 2**
- [ ] Checker Boundless SDK → **Dev 2**
- [x] Setup wallets devnet (faucet) → **Wallets via .env.local**
- [x] Décision : natif XRPL ou simulation backend → **Natif XRPL, tout dispo sur devnet**

### Phase 1 — Core XRPL + Sirius (6h)

**Dev 1 : ✅ TERMINÉ**
- [x] MPT minting avec metadata (IPFS hash, quality cert, schema, **description dataset**)
- [x] Vault deposit (XLS-65) + Lending Pool creation
- [x] Credentials (XLS-70) : DataProviderCertified, BorrowerKYB, TierOneCertified, DefaultBlacklist
- [x] Permissioned Domains (XLS-80)
- [x] Loan creation (XLS-66)
- [x] API Routes : `/api/xrpl/{wallets,mint,credentials,vault,loan}`

**Dev 2 :**
- [ ] Pipeline : dataset → chunk → Merkle tree → AES encrypt → upload Pinata → retourner CID
- [ ] API de décryption avec clé temporaire (TTL)
- [ ] Endpoint upload dataset (multipart)
- [ ] Endpoint download/query dataset (avec auth)

### Phase 2 — Loan Flow complet (5h)

**Dev 1 : ✅ TERMINÉ**
- [x] Flow loan : borrower request → MPT transfer → repayment → expiry/default
- [x] Events XRPL écoutés via WebSocket subscribe
- [x] Gestion des états : PENDING → ACTIVE → REPAYING → COMPLETED/DEFAULTED (state machine avec transitions validées)
- [x] Repayment tracking + default detection
- [x] Interest distribution pro-rata aux providers
- [x] Route démo end-to-end `/api/xrpl/demo`
- [x] Routes : `/api/xrpl/{loan/status,loan/repay,events}`

**Dev 2 :**
- [ ] Sirius réagit aux events : génère clé borrower
- [ ] Watermark basique : perturbation déterministe sur un subset de rows
- [ ] Révocation de clé à expiration
- [ ] Intégration Sirius ↔ XRPL events

### Phase 3 — Frontend & Intégration (4h)

**Dev 1 : ✅ TERMINÉ**
- [x] Intégration wallet xrpl-connect (Gem + Crossmark + Xaman)
- [x] Modal multi-wallet thémée au design system
- [x] Bouton Connect/Disconnect avec dropdown (Copy Address, Disconnect)
- [x] Zustand store wallet avec persistance localStorage
- [x] Détection automatique du rôle (loanbroker/provider/borrower)
- [x] Hooks : `useWalletBalance`, `useWalletCredentials`
- [x] Badge réseau "Devnet"

**Dev 2 :**
- [ ] Pages provider, marketplace, borrower
- [ ] Page admin (conditionné au rôle loanbroker)
- [ ] Composants UI : dataset card, loan status, quality certificate viewer
- [ ] Data flow : Zustand stores + React Query hooks vers API Routes
- [ ] Sidebar conditionnel selon le rôle
- [ ] Animations de transition entre les étapes du flow

### Phase 4 — Polish & Démo (2h)

- [ ] Préparer dataset de démo réaliste (1000 rows instruction-tuning)
- [ ] Tester le flow complet end-to-end
- [ ] Préparer le pitch : script 3min
- [ ] Anticiper les questions Q&A
- [ ] Fix bugs critiques uniquement
- [ ] Vérifier que la démo tourne offline-proof (réseau hackathon instable)

---

## Sécurité (Audit Dev 1) ✅

Deux passes d'audit effectuées. Tous les fix critiques et importants appliqués :

- [x] Auth API key (timing-safe) sur toutes les routes
- [x] Validation des body avec champs requis
- [x] Race condition client XRPL fixée (lock promise + finally)
- [x] Try/catch sur toutes les routes API
- [x] State machine respectée partout (addPayment, checkDefault)
- [x] parseXrpToDrops avec validation NaN + Math.round
- [x] URLs devnet centralisées (constants.ts)
- [x] Listeners cleanup (manager.off)
- [x] Zustand persist localStorage
- [x] Guard env variables avec message explicite
- [x] TextDecoder côté client (pas de Buffer)
- [x] Suppression du code mort (checkAndTriggerDefault wrapper)
- [x] toHex centralisé (utils.ts)

---

## Fichiers créés par Dev 1

```
src/lib/xrpl/
  ├── client.ts          — Connexion devnet, singleton avec lock
  ├── constants.ts       — URLs devnet centralisées
  ├── wallets.ts         — Wallets depuis .env.local
  ├── mpt.ts             — MPT minting + authorize + metadata enrichie
  ├── credentials.ts     — Issue/accept credentials (4 types)
  ├── domains.ts         — Permissioned Domains
  ├── vault.ts           — Vault + Lending Pool
  ├── lending.ts         — Loan create/delete
  ├── loan-state.ts      — State machine (6 états, transitions validées)
  ├── events.ts          — WebSocket subscribe + dispatch events
  ├── repayment.ts       — Paiements XRP + tracking
  ├── distribution.ts    — Distribution intérêts pro-rata
  ├── utils.ts           — toHex, parseXrpToDrops
  └── index.ts           — Barrel export

src/lib/wallet/
  └── manager.ts         — WalletManager singleton (xrpl-connect)

src/lib/api-utils.ts     — Auth timing-safe, error handling, validation

src/app/api/xrpl/
  ├── wallets/route.ts
  ├── mint/route.ts
  ├── credentials/route.ts
  ├── vault/route.ts
  ├── loan/route.ts
  ├── loan/status/route.ts
  ├── loan/repay/route.ts
  ├── events/route.ts
  └── demo/route.ts

src/components/wallet/
  ├── wallet-connector.tsx  — Web component thémé + triggerWalletConnect
  ├── connect-button.tsx    — Bouton Connect/Disconnect + dropdown
  └── wallet-info.tsx       — Widget adresse + balance

src/stores/wallet.ts     — Zustand store (address, network, role, persist)
src/hooks/use-wallet-balance.ts
src/hooks/use-wallet-credentials.ts
src/types/xrpl-connect.d.ts
```

---

## Stratégie de mock (dernier recours uniquement)

| Composant | Mock crédible |
|---|---|
| Boundless ZK | JSON "proof" statique avec les bonnes assertions, affiché dans l'UI |
| Kleros arbitration | Bouton "Raise Dispute" → toast "Submitted to arbitration" |
| Watermark detection | Diff visuel entre 2 versions du dataset (pre-computed) |

---

## Risques identifiés

| Risque | Probabilité | Plan B |
|---|---|---|
| XLS-65/66 pas sur devnet | ~~Haute~~ **Résolu** | ✅ Tout dispo sur devnet |
| Encryption/IPFS trop lent | Faible | Dataset petit pour la démo (1000 rows) |
| Manque de temps sur le front | Moyenne | Focus sur le flow provider→borrower, pas sur le polish |
| Wallet integration galère | ~~Moyenne~~ **Résolu** | ✅ xrpl-connect fonctionne |
| Réseau hackathon instable | Moyenne | Préparer un mode offline avec données cached |

---

## Story de la démo (3min)

```
1. "Je suis un data provider. J'ai un dataset d'instruction tuning."
   → Upload → encryption → ZK cert → MPT minté → déposé dans le vault

2. "Je suis un AI startup. Je veux ce dataset pour 30 jours."
   → Browse vault → voir quality cert → request loan → payer

3. "J'ai accès. Voici mes données."
   → Dashboard borrower → dataset accessible → watermarked

4. "Le loan expire."
   → Accès révoqué → provider reçoit ses intérêts → MPT retourne au vault

5. "Et si je leak les données ?"
   → Montrer le watermark unique → traçabilité
```

---

## Critères de succès

- [ ] Flow end-to-end fonctionnel (provider deposit → borrower access → expiry)
- [x] Au moins 1 tx XRPL réelle visible dans la démo (MPT mint) → **Route démo complète**
- [ ] Dataset réellement encrypté et stocké sur IPFS
- [ ] UI clean qui raconte l'histoire en 3min
- [ ] Réponses solides sur l'archi pendant Q&A
