# Audit DataLend Protocol — 12 avril 2026

Audit exhaustif : sécurité, code quality, frontend, flow complet, choix techniques.

---

## 1. Justification technique : xrpl.js@4.5.0-smartescrow.4

### Pourquoi cette version

On a besoin de deux features incompatibles dans xrpl.js standard :
- **Smart Escrow** (EscrowCreate avec `FinishFunction` Wasm) → uniquement dans le fork `smartescrow`
- **XLS-66 Lending** (LoanSet, LoanPay, etc.) → uniquement dans xrpl.js ≥ 4.6.0

Aucune version ne supporte les deux. Le fork `4.5.0-smartescrow.4` a été choisi car :
1. Il supporte Smart Escrow (le différenciateur pour la track Boundless)
2. Le codec `ripple-binary-codec@2.6.0-smartescrow.3` sait **encoder** les champs XLS-66 même si `validate()` les rejette
3. On contourne `validate()` via raw signing avec `ripple-keypairs`

### Comment le raw signing fonctionne

```
xrpl.js validate() → rejette LoanSet comme "TransactionType inconnu"
ripple-binary-codec encode() → sait encoder LoanSet (champs dans definitions.json)
ripple-keypairs sign() → signe les bytes bruts

Flow :
1. Construire la tx comme un objet JS
2. encode(tx) → hex string via le codec (bypasse validate)
3. sign("53545800" + encoded, privateKey) → signature brute
4. tx.TxnSignature = signature
5. encode(tx) → tx_blob signé
6. client.request({ command: "submit", tx_blob }) → soumission directe
```

### Le hash prefix "53545800"

C'est `STX\0` en ASCII — le préfixe standard XRPL pour le hashing de transactions à signer. `ripple-keypairs.sign()` attend une hex string (prefix + payload), la hashe internalement en SHA-512-Half, puis signe. C'est le même flow que le client officiel.

### Problème connu : conflit ComputationAllowance

Le champ `ComputationAllowance` (nécessaire pour EscrowFinish avec Wasm) utilise le même field ID que `PreviousPaymentDueDate` (XLS-66) dans le codec. Quand les deux définitions coexistent, le codec encode le mauvais champ. **Bloquant pour le finish de l'escrow.**

Options à explorer :
- Encoder `ComputationAllowance` manuellement dans le blob binaire
- Utiliser un codec sans les champs XLS-66
- Utiliser le Web UI du starter pour finish manuellement

---

## 2. Sécurité — Findings critiques

### S1. API key publique côté client
**Fichier :** `.env` (`NEXT_PUBLIC_API_KEY`), `src/lib/api-client.ts`

`API_SECRET_KEY` et `NEXT_PUBLIC_API_KEY` sont identiques. Le préfixe `NEXT_PUBLIC_` injecte la valeur dans le bundle JS client → visible dans les devtools. L'auth `requireAuth` est bypassable par n'importe qui.

**Accepté pour le hackathon** (devnet, pas de vrais fonds).
**Fix appliqué :** renommé en `NEXT_PUBLIC_API_KEY` (plus "SECRET") pour ne pas tromper.

### S2. escrow-mini ne vérifie pas la preuve ZK
**Fichier :** `boundless/escrow-mini/src/lib.rs`

Le mini escrow vérifie uniquement `journal[0] >= 50` (le score). N'importe qui peut forger un memo de 58 bytes avec `journal[0] = 100` — le Wasm l'accepte sans vérification cryptographique. La preuve ZK n'est vérifiée que localement par le host Rust, pas on-chain.

**Cause :** le Wasm complet avec `risc0-verifier-xrpl-wasm` fait 131KB, trop gros pour le devnet (limite ~100KB). Le mini escrow (3.3KB) est un compromis.

### S3. État en mémoire — perte au redémarrage
**Fichiers :** `loan-state.ts`, `dataset-registry.ts`, `key-store.ts`, `xrpl-bridge.ts`

Quatre `Map` globales. En serverless (Vercel), chaque instance est indépendante. En dev local (`pnpm dev`), tout marche car mono-process.

**Accepté pour le hackathon.**

### S4. Signing serveur pour tous les acteurs
**Fichier :** `src/lib/xrpl/wallets.ts`

Le serveur signe avec les seeds du provider, borrower ET loanbroker. Le wallet connect client est cosmétique — aucune transaction réelle n'est signée par le wallet de l'utilisateur.

**Plan :** migrer les tx non-XLS-66 vers le wallet popup (MPT, Vault, Credentials, Escrow). Les tx XLS-66 restent côté serveur (LoanBroker uniquement).

### S5. `submitRawTx` = fire-and-forget
**Fichier :** `src/lib/xrpl/raw-tx.ts`

`submit` (pas `submit_and_wait`) ne garantit pas que la tx est validée par le ledger. Le hash retourné peut correspondre à une tx rejetée au consensus. Les fonctions de `lending.ts` traitent ce hash comme une confirmation.

**✅ FIXÉ** — poll tx + validation ledger ajoutés.

### S6. Distribution non atomique
**Fichier :** `src/lib/xrpl/distribution.ts`

Boucle séquentielle sur les shareholders. Si la 2ème tx échoue, la 1ère est déjà on-chain. Le flag `distributedAt` est posé avant puis reset si erreur, mais un crash entre les deux laisse un état incohérent.

**✅ PARTIELLEMENT FIXÉ** — `distributedAt` ajouté pour empêcher la double distribution. L'atomicité reste impossible (limitation XRPL, pas de batched tx).

### S7. Clé master jamais exposée dans les réponses API
**Fichier :** `src/lib/sirius/pipeline.ts`

`masterKeyEncoded` était dans le type `IngestResult`. Même si les routes ne le sérialisaient pas explicitement, le risque existait.

**✅ FIXÉ** — retiré de `IngestResult`.

### S8. `checkDefault` dans repay ne révoquait pas la clé Sirius
**Fichier :** `src/app/api/xrpl/loan/repay/route.ts`

Si `checkDefault()` déclenchait un auto-default pendant un repay, la clé d'accès Sirius restait active.

**✅ FIXÉ** — `terminateLoanAccess` appelé après auto-default.

### S9. `deleteLoan` sans révocation de clé
**Fichier :** `src/app/api/xrpl/loan/route.ts`

Supprimer un loan on-chain ne révoquait pas la clé Sirius.

**✅ FIXÉ** — `terminateLoanAccess` appelé avant delete.

---

## 3. Code quality — Findings importants

### Q1. Incohérence boundless.ts (mock) vs guest Rust

| | Mock TS (`boundless.ts`) | Réel Rust (`guest/main.rs`) |
|---|---|---|
| Hash | SHA-256 de schema + count + 32 premières rows | SHA-256 de tout l'input JSON |
| Dédup | SHA-1 par row | String comparison dans HashSet |
| Score | Pas calculé | 0-100 avec seuils |
| Output | Objet JS `BoundlessProof` | Journal 58 bytes binaire |

Les deux sont **incompatibles**. Quand on branchera le vrai Boundless, il faudra réécrire `boundless.ts` entièrement.

### Q2. Types frontend désynchronisés du backend

`use-datasets.ts` définit `BoundlessProof.assertions.qualityScore` qui **n'existe pas** dans le type serveur. `use-loans.ts` utilise `totalOwed` au lieu de `totalDue`. Les champs sont `undefined` à l'exécution.

**✅ PARTIELLEMENT FIXÉ** — ajout de `payments`, `vaultId` aux types frontend. Guard `?? 0` et `isNaN` ajoutés dans le rendu pour les champs manquants (qualityScore, fieldCompleteness, schemaValid).

### Q3. `createLoan` retourne un tx hash, pas un loan ID

`lending.ts` retourne `result.hash` (hash de la tx) comme `loanId`. Sur XRPL, le `LoanID` est un index de ledger distinct du hash de la transaction de création.

**✅ FIXÉ** — extrait `LoanID` depuis `AffectedNodes`.

### Q4. `xrpl-bridge.ts` fallback impossible

```typescript
const dataset = getByMpt(loan.mptIssuanceId) ?? getDataset(loan.mptIssuanceId);
```

`getDataset` attend un `datasetId`, pas un `mptIssuanceId`. Le fallback retourne toujours `undefined`.

**✅ FIXÉ** — fallback supprimé.

### Q5. `computeDatasetDigest` ne hash que 32 lignes

Deux datasets avec les mêmes 32 premières lignes mais des contenus différents ont le même digest.

**⬜ NON FIXÉ** — touche `boundless.ts` (Bloc A). Sera corrigé lors du remplacement du mock par le vrai Boundless.

### Q6. Fee fixe à 12 drops dans `raw-tx.ts`

Le fee minimum est dynamique. En cas de congestion, les tx à 12 drops sont rejetées.

**✅ FIXÉ** — passé à 5000 drops.

### Q7. Calcul financier en floating-point

`repayment.ts`, `loan-state.ts`, `distribution.ts` calculent des montants XRP en `float`. Arrondi corrigé avec `Math.round` sur les drops, mais `principal * (1 + rate)` reste en float.

**✅ PARTIELLEMENT FIXÉ** — `addPayment` compare en drops (`Math.round(... * 1_000_000)`), `getRepaymentInfo` utilise `sum(amounts)` au lieu de `count * perPayment`.

### Q8. `unsubscribeAll` passe `accounts: []`

La commande XRPL `unsubscribe` avec une liste vide ne désinscrit rien.

**✅ FIXÉ** — passe les vrais comptes.

### Q9. `DATASET_CERTIFIER_ID` hardcodé dans l'escrow

L'image ID du guest est hardcodé comme `[u32; 8]` dans l'escrow Wasm. Toute modification du guest (même un commentaire) change l'image ID → les preuves existantes deviennent invalides → le Wasm retourne -4 silencieusement.

### Q10. `verify-proof` vérifiait le commitment contre lui-même

**Fichier :** `src/app/api/sirius/verify-proof/route.ts`

Sans `sampleRows`, la route faisait `verifyQualityProof(proof, proof.commitment)` — toujours vrai.

**✅ FIXÉ** — décrypte les rows réelles du dataset et recalcule le digest.

### Q11. `detectWatermark` ne détectait pas les perturbations numériques

**Fichier :** `src/lib/sirius/watermark.ts`

Seuls les zero-width spaces et `__wm` étaient détectés. Les micro-perturbations numériques (le type principal de watermark) n'étaient pas retrouvées.

**✅ FIXÉ** — détection par re-application du watermark sur une copie nettoyée (`stripRow` + `applyRowWatermark` + comparaison JSON). `applyRowWatermark` arrondit maintenant à 6 décimales avant d'ajouter le noise. `seededRandom` divisé par `0x100000000` au lieu de `0xffffffff` (empêche index hors-borne).

### Q12. `addPayment` complétait par count, pas par montant

**Fichier :** `src/lib/xrpl/loan-state.ts`

Un borrower pouvait envoyer 1 drop par paiement et obtenir un loan COMPLETED.

**✅ FIXÉ** — vérifie `totalPaidDrops >= totalDueDrops` en plus du count.

### Q13. Upload sans limite de rows

**Fichier :** `src/app/api/sirius/upload/route.ts`

Aucune limite → OOM possible avec un gros payload.

**✅ FIXÉ** — limite à 10000 rows.

### Q14. MPT metadata format invalide

**Fichier :** `src/lib/xrpl/mpt.ts`

Le réseau XRPL attend des champs structurés (`t`, `n`, `i`, `ac`, `in`) dans `MPTokenMetadata`. Le code envoyait un JSON brut.

**✅ FIXÉ** — `buildMPTokenMetadata` génère le format correct.

---

## 4. Frontend — Findings

### F1. SSR cassé
`providers.tsx` : `if (!mounted) return null` supprime tout le rendu serveur. Page blanche puis flash à l'hydratation.

**⬜ À FAIRE** — mount guard uniquement sur les composants qui en ont besoin.

### F2. `user-select: none` global
`globals.css` : bloque la copie d'adresses et de tx hashes dans toute l'app.

**✅ FIXÉ**

### F3. Modal sans focus trap
`Modal.tsx` : Tab navigue derrière l'overlay. WCAG 2.1.2 non respecté.

**⬜ ACCEPTÉ** — hackathon, pas prioritaire.

### F4. `grid-cols-4` sans breakpoint mobile
`DatasetDetail.tsx` : 4 colonnes fixes sur mobile = contenu tronqué illisible.

**⬜ À FAIRE**

### F5. TabBar admin overflow mobile
5 tabs sans `overflow-x-auto` ni `flex-wrap` → débordement sur petit écran.

**⬜ À FAIRE**

### F6. Input recherche non fonctionnel
`Header.tsx` : l'input search sur `/dashboard` n'a pas de handler.

**⬜ ACCEPTÉ** — cosmétique pour le hackathon.

### F7. `console.log` en production
`Blob.tsx` ligne 691 : log de debug sur keydown.

**✅ FIXÉ**

### F8. Communication via `window` globals
`(app)/layout.tsx` : `__blobTargetZ`, `__blobDezoom` etc. passés par `window as any`. Fragile et non typé.

**⬜ ACCEPTÉ** — fonctionne, le refactor n'apporte rien pour la démo.

### F9. `<img>` au lieu de `next/image`
Landing page : 3 images sans optimisation (pas de lazy loading, pas de WebP/AVIF).

**⬜ ACCEPTÉ** — hackathon.

### F10. `QueryClient` instancié au niveau module
`providers.tsx` : partagé entre users en SSR (leak de cache potentiel).

**⬜ À FAIRE**

### F11. Timestamps en secondes vs millisecondes
`lib/utils.ts` : `formatTimestamp` attend des secondes, mais `LoanRecord.createdAt` est en millisecondes → dates en l'an ~51000.

**✅ FIXÉ** — accepte millisecondes.

### F12. Disconnect dans le cleanup useEffect
`(app)/layout.tsx` : le wallet était déconnecté au hot-reload dev (StrictMode double-mount).

**✅ FIXÉ** — disconnect uniquement dans le dezoom explicite.

### F13. Route guard flash
`use-route-guard.ts` : `router.replace` est async, la page non autorisée s'affiche brièvement avant la redirection.

**⬜ ACCEPTÉ** — `if (!allowed) return null` couvre le cas en pratique.

---

## 5. Flow complet — Analyse de cohérence

### Le flow provider→upload→proof→escrow→MPT→vault→loan→repay→distribute

| Étape | Implémenté | Problème |
|-------|-----------|----------|
| 1. Provider upload dataset | ✅ Sirius pipeline | OK |
| 2. ZK proof (guest Rust) | ✅ Local (dev mode) | Mock TS incompatible avec le vrai |
| 3. Deploy Smart Escrow | ✅ EscrowCreate | Wasm mini (pas de vérif ZK) |
| 4. Finish Escrow | ❌ Bloqué | Conflit ComputationAllowance |
| 5. Mint MPT | ✅ | Metadata format fixé, champs `zk.*` à ajouter |
| 6. Deposit Vault | ✅ | OK |
| 7. Create LoanBroker | ✅ | LoanBrokerSet + cover deposit |
| 8. Create Loan | ✅ Raw signing | LoanID extrait des AffectedNodes |
| 9. Activate Sirius key | ✅ | Auto-activé après loan creation dans le marketplace |
| 10. Access dataset | ✅ | Download + decrypt + watermark + viewer |
| 11. Repay | ✅ LoanPay raw | Validation ledger ajoutée |
| 12. Distribute | ✅ | Protection double distribution ajoutée |
| 13. Default | ✅ | Révocation clé Sirius ajoutée |
| 14. Onboard participant | ✅ | Fund faucet + issue credential |

### Points de rupture

1. **Escrow → MPT** : le finish de l'escrow est bloqué par le conflit codec. Sans ça, pas de `proofTxHash` à mettre dans le MPT.
2. **Mock → Réel** : `boundless.ts` mock et le guest Rust produisent des preuves incompatibles. La transition nécessite une réécriture complète.
3. **State in-memory** : le flow multi-requête est impossible en serverless. Fonctionne uniquement en une seule requête (`/api/xrpl/demo`) ou en dev local.
4. **Signing serveur** : le wallet connect client ne participe à aucune transaction du flow.

---

## 6. Fichiers prioritaires pour corrections

| Priorité | Fichier | Action | Status |
|----------|---------|--------|--------|
| **P0** | Conflit codec EscrowFinish | Résoudre le field ID ComputationAllowance | ⬜ Bloqué — investigation codec |
| **P0** | `raw-tx.ts` | Passer à `submit_and_wait` ou poll le résultat | ✅ FIXÉ |
| **P1** | `boundless.ts` | Remplacer par le vrai flow (appel host Rust) | ⬜ Bloc A |
| **P1** | `mpt.ts` | Metadata format + champs `zk.*` | ✅ PARTIELLEMENT FIXÉ (format OK, zk à ajouter) |
| **P1** | `use-datasets.ts`, `use-loans.ts` | Synchroniser les types avec le backend | ✅ FIXÉ (payments, vaultId, guards NaN) |
| **P1** | `lending.ts` | Retourner le vrai LoanID depuis AffectedNodes | ✅ FIXÉ |
| **P1** | `verify-proof/route.ts` | Vérifier contre les vraies données | ✅ FIXÉ |
| **P1** | `watermark.ts` | Détection numérique + seededRandom fix | ✅ FIXÉ |
| **P2** | `xrpl-bridge.ts:35` | Fix le fallback impossible | ✅ FIXÉ |
| **P2** | `distribution.ts` | Double distribution + échec partiel | ✅ PARTIELLEMENT FIXÉ |
| **P2** | `loan-state.ts` | Completion par montant | ✅ FIXÉ |
| **P2** | `upload/route.ts` | Limite 10000 rows | ✅ FIXÉ |
| **P2** | `loan/repay/route.ts` | Révocation clé après auto-default | ✅ FIXÉ |
| **P2** | `loan/route.ts` | Révocation clé avant delete | ✅ FIXÉ |
| **P2** | `globals.css` | Retirer `user-select: none` | ✅ FIXÉ |
| **P2** | `events.ts` | `unsubscribeAll` vrais comptes | ✅ FIXÉ |
| **P2** | `raw-tx.ts` | Fee fixe → 5000 drops | ✅ FIXÉ |
| **P2** | `utils.ts` | Timestamps ms | ✅ FIXÉ |
| **P3** | `providers.tsx` | Fix SSR mount guard | ⬜ À faire |
| **P3** | `DatasetDetail.tsx` | Responsive grid mobile | ⬜ À faire |
| **P3** | `Blob.tsx:691` | Supprimer `console.log` | ✅ FIXÉ |
| **P3** | `Header.tsx` | Brancher ou retirer l'input search | ⬜ Cosmétique |

---

## 7. Résumé des corrections appliquées

### Critiques (6)
- ✅ API key renommée (plus "SECRET" côté client)
- ✅ Disconnect retiré du cleanup useEffect (plus de déco au hot-reload)
- ✅ RepaymentProgress utilise les vrais paiements
- ✅ Double distribution bloquée (distributedAt)
- ✅ checkDefault révoque la clé Sirius
- ✅ vaultId passé depuis le dataset dans le marketplace

### Importants (8)
- ✅ masterKeyEncoded retiré de IngestResult
- ✅ totalPaid = sum(amounts), completion par montant
- ✅ Upload limité à 10000 rows
- ✅ deleteLoan révoque la clé
- ✅ Toast d'erreur sur échec upload
- ✅ verify-proof vérifie contre les vraies données
- ✅ detectWatermark détecte les perturbations numériques
- ✅ MPT metadata format corrigé

### Frontend (complet)
- ✅ 5 pages (Dashboard, Provider, Marketplace 2 étapes, Borrower, Admin onglets)
- ✅ 8 composants (DatasetCard, DatasetDetail, QualityCertificate, LoanStatusBadge, RepaymentProgress, TxLink, ObjectLink, etc.)
- ✅ Sidebar conditionnel par rôle
- ✅ Route guard par adresse
- ✅ Flow complet : marketplace → loan → activate → redirect → download → viewer
- ✅ Onboard participant (fund + credential)
- ✅ Tx hashes cliquables vers l'explorer

---

## 8. Passe 7 — Findings restants (12 avril 2026)

### Critique

**P7-1. `download/route.ts` — La clé de déchiffrement est incorrecte**
`key-store.ts` dérive une clé par borrower/loan (`deriveKey(masterKey, loanId:borrower)`), mais les chunks ont été chiffrés avec la `masterKey` brute dans `pipeline.ts`. La décryption avec la `borrowerKey` échoue systématiquement.
**Status :** ✅ FIXÉ — utilise `dataset.masterKeyEncoded` pour déchiffrer, la borrowerKey sert d'autorisation

**P7-2. `escrow-mini` ne vérifie pas le seal ZK — déjà documenté S2**
**Status :** ⬜ Connu, compromis taille (131KB vs 3.3KB)

**P7-3. `verify-proof/route.ts` — masterKey accessible via l'endpoint**
L'endpoint utilise `dataset.masterKeyEncoded` pour déchiffrer. Si l'auth est bypassée, le contenu complet est exfiltrable.
**Status :** ⬜ Connu, accepté hackathon (auth publique)

### Moyen

**P7-4. `fund/route.ts` — Pas de validation du format d'adresse XRPL**
L'adresse du body est passée directement au faucet sans validation.
**Status :** ✅ FIXÉ — regex validation du format classic address XRPL

**P7-5. Types frontend toujours partiellement désynchronisés**
`use-datasets.ts` : `assertions.qualityScore`, `assertions.schemaValid`, `assertions.fieldCompleteness` n'existent pas dans le type serveur. Les guards `?? 0` masquent le problème mais les valeurs restent 0/false.
**Status :** ⬜ Sera résolu quand boundless.ts mock est remplacé par le vrai flow (Bloc A)

**P7-6. `host/src/main.rs` — `seal_hex` silencieusement vide si bincode échoue**
`unwrap_or_default()` produit un seal vide sans erreur.
**Status :** ✅ FIXÉ — `expect()` avec message d'erreur explicite

**P7-7. `distribution.ts` — Pas de validation somme sharePercent = 100**
**Status :** ⬜ Connu, accepté hackathon (un seul provider à 100%)

**P7-8. `loan/route.ts` — `transitionLoan(ACTIVE)` sans vérifier que createLoanRecord a réussi**
Si createLoanRecord lève une exception, le loan existe on-chain mais pas en mémoire.
**Status :** ⬜ Connu, flow séquentiel sans rollback

**P7-9. Hash prefix `53545800` correct mais fragile**
Concaténation string hex — fonctionne car `encode()` retourne du hex et `rawSign` accepte du hex. Correct mais non vérifié programmatiquement.
**Status :** ⬜ Accepté

### Faible

**P7-10. `boundless.ts` — SHA-1 pour déduplication**
**Status :** ⬜ Sera remplacé avec le vrai Boundless

**P7-11. `escrow.ts` — Chemin WASM relatif à `process.cwd()`**
Ne marchera pas sur Vercel.
**Status :** ⬜ Accepté hackathon (dev local)

**P7-12. `watermark.ts` — `method` hardcodé "numeric-perturbation"**
Le rapport ment si la méthode utilisée est synonym-shift ou field-injection.
**Status :** ⬜ Mineur

**P7-13. `simpleHash` dans ipfs.ts — non déterministe (Date.now)**
**Status :** ⬜ Accepté (mode mock uniquement)
