# MVP Status — DataLend / Sirius 2.0

> Derniere mise a jour : 14 avril 2026 — branche `feature_mvp`

---

## 1. Ce qui est REEL on-chain

| Feature | Primitives | Verifiable sur explorer |
|---------|-----------|:---:|
| MPT mint avec metadata (IPFS hash, quality cert) | XLS-33 | oui |
| Vault creation + deposit MPT | XLS-65 | oui |
| PermissionedDomain | XLS-80 | oui |
| Credentials (DataProviderCertified, BorrowerKYB) | XLS-70 | oui |
| LoanBroker creation | XLS-66 LoanBrokerSet | oui |
| IPFS upload via Pinata | — | oui (gateway IPFS) |
| Encryption AES-256-GCM + Merkle tree | — | non (cote serveur) |
| 35+ pools existants sur wasm devnet | — | oui |

---

## 2. Ce qui est MOCKE

### Mocks complets (aucune implementation reelle)

| Quoi | Fichier | Detail |
|------|---------|--------|
| ZK Proofs Boundless | `lib/sirius/boundless.ts` | `generateQualityProof()` = SHA-256 local. Aucun RISC Zero. Tous les badges "ZK Verified" sont faux |
| verify-proof | `api/sirius/verify-proof/route.ts` | Compare le digest contre lui-meme = tautologique, prouve rien |
| computeDatasetDigest | `lib/sirius/boundless.ts` L76 | Hash seulement les 32 premieres lignes sur potentiellement 10k |
| Watermark detection | `lib/sirius/watermark.ts` | Perturbation 1e-6 indistinguable du bruit float. `detectWatermark()` ne detecte rien |
| Smart Escrow finish | `lib/xrpl/escrow.ts` | Code mais bloque (conflit field ID `ComputationAllowance` vs `PreviousPaymentDueDate`) |
| Route `/api/xrpl/prove` | — | Mentionnee dans Plan.md, jamais creee |

### Fallbacks mock (essaie le vrai, tombe sur le mock si echec)

| Quoi | Fichier | Trigger | Ce qui se passe |
|------|---------|---------|-----------------|
| LoanSet (creation loan) | `api/xrpl/loan/route.ts` L43-73 | `temBAD_SIGNER` wasm devnet | Genere un loanId local `loan-xxx`. Le loan n'existe PAS on-chain |
| LoanSet (demo route) | `api/xrpl/demo/route.ts` L169-188 | idem | Genere `demo-loan-xxx`, retourne `loanOnChain: false` |
| LoanPay (repay) | `api/xrpl/loan/repay/route.ts` L43-65 | `temBAD_SIGNER` ou `Payment failed` | Enregistre le paiement localement avec `txHash: "mock-xxx"` |
| Credentials (demo) | `api/xrpl/demo/route.ts` L90-105 | `tecDUPLICATE`, `temBAD_SIGNER` | Avale silencieusement l'erreur via `skipKnown()` |
| Borrower page | `(app)/borrower/page.tsx` | Xaman address ne match aucun loan | Affiche tous les loans (mode demo) |
| Provider datasets | `api/provider/datasets/route.ts` | "Account not found" wasm devnet | Retourne `[]` au lieu de 500 |
| Credentials check | `api/xrpl/credentials/check/route.ts` | idem | Retourne credentials vides |

### Valeurs hardcodees

| Quoi | Fichier | Valeur |
|------|---------|--------|
| qualityScore | `demo/route.ts` L74, `marketplace/page.tsx` L273 | `92` en dur partout |
| qualityScore calcul | `provider/upload/route.ts` L48-58 | `+20 +20` ajoutes sans raison = score gonfle |
| loanBrokerId default | `loan/route.ts` L45 | `"000...000"` (64 zeros) si non fourni |
| provider address | `loan/route.ts` L78 | `""` (string vide) |
| principalAmount | `marketplace/page.tsx` L71 | `"1"` XRP hardcode |
| Network URLs | `lib/xrpl/constants.ts` | wasm devnet en dur, pas de switch mainnet |

### Persistance volatile (RAM only)

| Store | Fichier | Contenu | Survit au HMR | Survit au restart |
|-------|---------|---------|:---:|:---:|
| `__sirius_loans` | `lib/xrpl/loan-state.ts` | Loans, payments, status | oui (globalThis) | non |
| `__sirius_datasets` | `lib/sirius/dataset-registry.ts` | Datasets + masterKey en clair | oui | non |
| `__sirius_keys` | `lib/sirius/key-store.ts` | Cles borrower par loan | oui | non |
| `mockStore` | `lib/sirius/ipfs.ts` | Donnees IPFS mock | NON (module-level) | non |
| `activeSeeds` | `lib/sirius/xrpl-bridge.ts` | Seeds watermark | NON (module-level) | non |
| `eventLog` | `api/xrpl/events/route.ts` | Events XRPL | NON (module-level) | non |

---

## 3. Ce qui est NON FAISABLE pour la demo

| Feature | Pourquoi | Contournement pendant le pitch |
|---------|----------|-------------------------------|
| Loan visible sur l'explorer | Bug `temBAD_SIGNER` cote serveur wasm devnet | Ne pas cliquer "View Loan on Explorer". Les MPT/Vault/Credentials SONT visibles |
| Vraie preuve ZK Boundless | Provers testnet indisponibles + escrow codec bloque | Le badge "ZK Verified" s'affiche. Dire que le circuit existe (vrai) et que le proving est en standby sur Base Sepolia |
| Watermark detection live | Perturbation 1e-6 trop petite | Dire "chaque copie est unique, tracable" sans demontrer la detection |
| Persistance apres restart | Stores in-memory | Ne JAMAIS restart le serveur pendant la demo |
| Wallet switching live | Xaman incompatible wasm devnet | Utiliser "Run Full Demo" depuis /admin, puis naviguer manuellement |

---

## 4. Checklist de verification pre-demo

### Infra (1h avant le pitch)

- [ ] `pnpm dev` tourne sans erreur
- [ ] Verifier les 3 wallets ont >=200 XRP : ouvrir `/api/xrpl/wallets` dans le navigateur
- [ ] Le wasm devnet repond : ouvrir `https://custom.xrpl.org/wasm.devnet.rippletest.net`
- [ ] Si un wallet est vide : `/api/xrpl/fund` ou `https://wasmfaucet.devnet.rippletest.net/accounts`

### Flow complet (30min avant, dans l'ordre exact du pitch)

#### Etape 0 — Init stores
- [ ] Aller sur `/admin` > onglet Demo > **"Run Full Demo"**
- [ ] Verifier que les 12 steps passent (credentials, sirius, MPT, vault, loanbroker, loan, key)
- [ ] Noter si le loan est `loanOnChain: true` ou `false` (mock) — les deux marchent pour la demo

#### Acte 1 — Provider Upload (`/provider`)
- [ ] Cliquer **"Load Demo"** > le form se pre-remplit avec le dataset 1000 rows
- [ ] Cliquer **"Upload"** > verifier les etapes : encrypt > IPFS > MPT > vault
- [ ] Le quality score s'affiche (92 ou 100)
- [ ] Le MPT ID et vault ID apparaissent
- [ ] Le lien **"View on XRPL Explorer"** s'ouvre et la tx existe on-chain

#### Acte 2 — Quality Proof (meme page + explorer)
- [ ] Le badge ZK est visible sur la page provider
- [ ] L'explorer montre le MPT avec metadata hex (contient IPFS hash + quality cert)

#### Acte 3 — Marketplace (`/marketplace`)
- [ ] Les pools chargent (au moins le pool cree en acte 1)
- [ ] Le quality score est visible (pas "N/A")
- [ ] Cliquer **"Borrow"** > remplir duree > confirmer
- [ ] Le loan se cree (mock ou reel) > redirect vers `/borrower`

#### Acte 4 — Borrower (`/borrower`)
- [ ] Le loan ACTIVE apparait dans la liste
- [ ] Cliquer **"Access Data"** > le modal s'ouvre avec les rows decryptees
- [ ] Les rows sont watermarkees (info watermark visible dans le modal)
- [ ] Cliquer **"Repay"** > le paiement passe > loan > COMPLETED

#### Acte 5 — Admin Default (`/admin`)
- [ ] Onglet Loans > le loan apparait
- [ ] Cliquer **"Default"** > le loan passe en DEFAULTED
- [ ] Retourner sur `/borrower` > **"Access Data" ne marche plus** (cle revoquee)

### Filet de securite

- [ ] Screenshots de chaque etape reussie (fallback si reseau plante pendant le pitch)
- [ ] Navigateur en plein ecran, mode sombre
- [ ] 4 onglets pre-ouverts : `/provider`, `/marketplace`, `/borrower`, `/admin`
- [ ] **Ne PAS restart le serveur** entre le test et le pitch
- [ ] **Ne PAS montrer** l'explorer pour les loans (ils n'y sont pas si mock)

### Reponses Q&A a preparer

| Question probable | Reponse |
|-------------------|---------|
| "Le loan est on-chain ?" | "LoanSet utilise XLS-66, une primitive experimentale sur wasm devnet. On a un bug temBAD_SIGNER cote serveur qu'on contourne avec un fallback local. Les MPT, vaults et credentials sont 100% on-chain." |
| "La preuve ZK est reelle ?" | "Le circuit RISC Zero est ecrit et compile (guest program dataset-certifier). L'escrow Wasm de 3.3KB est deploye sur wasm devnet (sequence 1707429). Le proving est en standby sur Base Sepolia — les provers testnet Boundless etaient indisponibles pendant le hackathon." |
| "Et si je leak les donnees ?" | "Chaque borrower recoit une copie watermarkee unique. Le watermark est une perturbation statistique invisible a l'oeil mais detectable algorithmiquement." |
| "C'est quoi la stack ?" | "Next.js 16, XRPL wasm devnet, 5 primitives natives (XLS-33 MPT, XLS-65 Vault, XLS-66 Lending, XLS-70 Credentials, XLS-80 PermissionedDomains). Encryption AES-256-GCM, IPFS via Pinata, ZK via RISC Zero / Boundless." |
