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
| Intégration wallet XRPL (xumm/gem) | ZK proofs (Boundless ou mock crédible) |

---

## Phases de développement

### Phase 0 — Validation & Setup (1h)

- [ ] Vérifier dispo XLS-65/66 sur devnet
- [ ] Créer compte Pinata
- [ ] Checker Boundless SDK
- [ ] Setup wallets devnet (faucet)
- [ ] Décision : natif XRPL ou simulation backend pour vault/lending

### Phase 1 — Core XRPL + Sirius (6h)

**Priorité absolue — sans ça, pas de démo.**

**Dev 1 :**
- [ ] MPT minting avec metadata (IPFS hash, quality cert, schema)
- [ ] Si XLS-65/66 dispo → vault deposit + loan creation
- [ ] Sinon → logique custom dans les API Routes
- [ ] Credentials (XLS-70) : DataProviderCertified, BorrowerKYB

**Dev 2 :**
- [ ] Pipeline : dataset → chunk → Merkle tree → AES encrypt → upload Pinata → retourner CID
- [ ] API de décryption avec clé temporaire (TTL)
- [ ] Endpoint upload dataset (multipart)
- [ ] Endpoint download/query dataset (avec auth)

### Phase 2 — Loan Flow complet (5h)

**Le coeur de la démo.**

**Dev 1 :**
- [ ] Flow loan : borrower request → MPT transfer → repayment → expiry/default
- [ ] Events XRPL écoutés pour trigger Sirius
- [ ] Gestion des états : PENDING → ACTIVE → REPAYING → COMPLETED/DEFAULTED

**Dev 2 :**
- [ ] Sirius réagit aux events : génère clé borrower
- [ ] Watermark basique : perturbation déterministe sur un subset de rows
- [ ] Révocation de clé à expiration
- [ ] Intégration Sirius ↔ XRPL events

### Phase 3 — Frontend & Intégration (4h)

**Ce que le jury voit.**

**Pages clés :**

| Page | Contenu |
|---|---|
| Provider Dashboard | Upload dataset → encryption + ZK cert → deposit vault → suivi revenus |
| Marketplace / Vault | Browse datasets avec quality certs → request loan |
| Borrower Dashboard | Loan actif → accès dataset → repayment → expiration visible |

**Dev 1 :**
- [ ] Intégration wallet + signing des tx dans le front
- [ ] Connect wallet flow (xumm ou gem)

**Dev 2 :**
- [ ] Pages provider, marketplace, borrower
- [ ] Composants UI : dataset card, loan status, quality certificate viewer
- [ ] Data flow : Zustand stores + React Query hooks vers API Routes
- [ ] Animations de transition entre les étapes du flow

### Phase 4 — Polish & Démo (2h)

- [ ] Préparer dataset de démo réaliste (1000 rows instruction-tuning)
- [ ] Tester le flow complet end-to-end
- [ ] Préparer le pitch : script 3min
- [ ] Anticiper les questions Q&A
- [ ] Fix bugs critiques uniquement
- [ ] Vérifier que la démo tourne offline-proof (réseau hackathon instable)

---

## Stratégie de mock (dernier recours uniquement)

| Composant | Mock crédible |
|---|---|
| Boundless ZK | JSON "proof" statique avec les bonnes assertions, affiché dans l'UI |
| Kleros arbitration | Bouton "Raise Dispute" → toast "Submitted to arbitration" |
| Watermark detection | Diff visuel entre 2 versions du dataset (pre-computed) |
| XLS-65/66 si absent | Backend simule vault shares + loan states en mémoire/SQLite |

---

## Risques identifiés

| Risque | Probabilité | Plan B |
|---|---|---|
| XLS-65/66 pas sur devnet | Haute | Simuler côté backend, focus sur le concept + MPT + credentials |
| Encryption/IPFS trop lent | Faible | Dataset petit pour la démo (1000 rows) |
| Manque de temps sur le front | Moyenne | Focus sur le flow provider→borrower, pas sur le polish |
| Wallet integration galère | Moyenne | Clés hardcodées pour la démo, montrer le concept |
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
- [ ] Au moins 1 tx XRPL réelle visible dans la démo (MPT mint)
- [ ] Dataset réellement encrypté et stocké sur IPFS
- [ ] UI clean qui raconte l'histoire en 3min
- [ ] Réponses solides sur l'archi pendant Q&A
