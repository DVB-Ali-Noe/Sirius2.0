# Taches MVP — Split Dev A / Dev B

> Branche : `feature_mvp` | Derniere mise a jour : 14 avril 2026

---

## Contexte

- Reseau : wasm devnet (`wss://wasm.devnet.rippletest.net:51233`, network ID 2002)
- Wallet signing : Otsu (supporte custom networks). Tester en premier. Fallback : seed .env cote serveur avec ecran "Confirm Payment" dans l'UI
- Pricing : le provider fixe un `pricePerDay` (en XRP) a l'upload. Le borrower choisit une duree, le prix est calcule automatiquement
- Paiement : vrai Payment XRP du borrower vers le provider. Pas de mock. Verifie on-chain
- Toutes les durees sont en jours. Stockees en ms cote serveur (jours × 86400000)

---

## DEV A — Backend + XRPL (on-chain)

### A1. Vault name on-chain

**Fichiers concernes :**
- `src/lib/xrpl/vault.ts` — `createLendingPool()`
- `src/app/api/xrpl/pools/route.ts` — lecture des pools

**Ce qu'il faut faire :**
- Dans `createLendingPool()`, ajouter le `datasetName` dans les metadata hex du vault a la creation
- Format suggestion : `{"name":"GPT-4 Instruction Tuning","pricePerDay":"0.5"}` encode en hex
- Dans `pools/route.ts`, decoder les metadata du vault pour extraire le nom
- Retourner `vaultName` dans la reponse API des pools

**Contrainte :** les metadata XRPL sont limitees en taille. Garder le nom court (< 100 chars).

---

### A2. Champ `pricePerDay` dans le modele dataset

**Fichiers concernes :**
- `src/lib/xrpl/mpt.ts` — `DatasetDescription`, `buildMPTokenMetadata()`
- `src/app/api/provider/upload/route.ts` — reception du champ
- `src/app/api/provider/upload/prepare/route.ts` — idem
- `src/app/api/xrpl/demo/route.ts` — `demoDatasetDescription()`

**Ce qu'il faut faire :**
- Ajouter `pricePerDay: string` (en XRP) dans `DatasetDescription`
- Le recevoir dans le body des routes upload/prepare
- L'inclure dans les metadata MPT et dans les metadata du vault (cf A1)
- Mettre une valeur par defaut dans la demo route (ex: `"0.5"`)
- Le stocker dans le `DatasetRecord` du registry (`dataset-registry.ts`)

---

### A3. Route verification paiement + activation acces

**Fichier a creer :**
- `src/app/api/xrpl/verify-payment/route.ts`

**Ce qu'il faut faire :**

```
POST /api/xrpl/verify-payment
Body: { txHash, datasetId, borrowerAddress, durationDays }
```

1. Se connecter au ledger XRPL
2. Appeler `client.request({ command: "tx", transaction: txHash })`
3. Verifier :
   - `TransactionType === "Payment"`
   - `Destination === providerAddress` (depuis le dataset record)
   - `Amount >= pricePerDay * durationDays` (en drops)
   - `Account === borrowerAddress`
   - `validated === true`
4. Si valide :
   - Creer un `LoanRecord` dans `loan-state.ts` avec `activatedAt: Date.now()`, `expiresAt: Date.now() + durationDays * 86400000`
   - Activer la cle Sirius avec TTL = `durationDays * 86400000` (`key-store.ts` → `issueBorrowerKey()`)
   - Retourner `{ success: true, loanId, expiresAt }`
5. Si invalide : retourner `{ success: false, reason: "..." }`

**Fichiers a modifier :**
- `src/lib/xrpl/loan-state.ts` — ajouter `expiresAt` dans `LoanRecord`
- `src/lib/sirius/key-store.ts` — s'assurer que `issueBorrowerKey()` accepte un TTL custom

---

### A4. Route extension de duree

**Fichier a creer :**
- `src/app/api/xrpl/extend-access/route.ts`

**Ce qu'il faut faire :**

```
POST /api/xrpl/extend-access
Body: { txHash, loanId, additionalDays }
```

1. Recuperer le loan existant depuis `loan-state.ts`
2. Verifier que le loan est ACTIVE et pas expire
3. Meme verification de paiement on-chain que A3 :
   - `Amount >= pricePerDay * additionalDays`
   - `Destination === providerAddress`
   - `Account === borrowerAddress` (celui du loan)
4. Si valide :
   - Etendre `loan.expiresAt += additionalDays * 86400000`
   - Etendre le TTL de la cle dans `key-store.ts` (nouvelle fonction `extendKey(loanId, additionalMs)`)
   - Enregistrer le paiement dans `loan.payments[]`
   - Retourner `{ success: true, newExpiresAt }`

**Fichiers a modifier :**
- `src/lib/sirius/key-store.ts` — ajouter `extendKey(loanId: string, additionalMs: number)`
- `src/lib/xrpl/loan-state.ts` — ajouter logique extension `expiresAt`

---

### A5. Adapter la demo route

**Fichier :** `src/app/api/xrpl/demo/route.ts`

- Ajouter `pricePerDay: "0.5"` dans `demoDatasetDescription()`
- Adapter le mock loan pour avoir un `expiresAt` coherent (ex: `Date.now() + 30 * 86400000`)

---

## DEV B — Frontend + Wallet

### ~~B1. Tester Otsu sur wasm devnet~~ ✅ DONE

**Avant de coder quoi que ce soit, tester :**

1. Installer l'extension Otsu
2. Dans Otsu settings > Custom Networks, ajouter :
   - Name : `XRPL Wasm Devnet`
   - URL : `wss://wasm.devnet.rippletest.net:51233`
   - Network ID : `2002`
3. Importer le seed borrower du `.env` dans Otsu
4. Tester un `signAndSubmit` basique (Payment de 1 XRP vers le provider)
5. **Si ca marche** : continuer avec B2-B6
6. **Si ca marche pas** : implementer l'option fallback (cf section Fallback en bas)

---

### ~~B2. Marketplace — Afficher le nom du vault~~ ✅ DONE

**Fichier :** `src/app/(app)/marketplace/page.tsx`

- Utiliser le `vaultName` retourne par l'API pools (cf A1) au lieu du `vaultId` hash
- Afficher `vaultName` dans `PoolCard`
- Fallback : si `vaultName` est null/undefined, afficher le `vaultId` tronque comme avant

---

### B3. Upload Provider — Champ `pricePerDay`

**Fichier :** `src/app/(app)/provider/page.tsx`

- Ajouter un champ "Price per day (XRP)" dans le formulaire d'upload
- Valeur par defaut : `0.5`
- L'envoyer dans le body de l'appel API upload
- L'afficher dans le dashboard provider apres upload

---

### B4. Borrow flow — Paiement reel

**Fichier :** `src/app/(app)/marketplace/page.tsx` — `LoanRequestModal`

Le flow actuel est : choisir duree → creer loan (mock) → activer cle → redirect.

**Nouveau flow :**

1. Le borrower choisit une duree (slider ou select : 7, 14, 30, 60, 90 jours)
2. Le prix s'affiche en temps reel : `pricePerDay × durationDays` XRP
3. Bouton **"Pay X XRP"**
4. Au clic :
   - Construire la tx Payment : `{ TransactionType: "Payment", Destination: providerAddress, Amount: xrpToDrops(total) }`
   - Signer via Otsu (`signAndSubmit` depuis xrpl-connect / wallet manager)
   - Recuperer le `txHash` de la reponse
   - Appeler `POST /api/xrpl/verify-payment` avec `{ txHash, datasetId, borrowerAddress, durationDays }`
   - Si success → redirect vers `/borrower`
   - Si echec → toast erreur

**Fichiers a modifier aussi :**
- `src/lib/wallet/manager.ts` — verifier que `signAndSubmit` est expose et fonctionne avec Otsu
- `src/stores/wallet.ts` — si besoin d'ajouter le provider connecte (Otsu vs Xaman)

---

### B5. Borrower dashboard — Expiration + Extension

**Fichier :** `src/app/(app)/borrower/page.tsx`

**Modifications :**

1. Afficher **"Expires in X days"** sur chaque loan actif
   - Calcul : `Math.ceil((loan.expiresAt - Date.now()) / 86400000)`
   - Couleur : vert si > 7j, orange si 1-7j, rouge si < 1j
2. Bouton **"Extend Access"** sur chaque loan actif
3. Au clic → modal :
   - Select duree supplementaire (7, 14, 30 jours)
   - Prix affiche : `pricePerDay × additionalDays` XRP
   - Bouton **"Pay X XRP"**
   - Meme flow que B4 : signer via Otsu → `txHash` → appeler `POST /api/xrpl/extend-access`
   - Si success → refresh la liste, nouveau `expiresAt` affiche
4. Si le loan est expire → afficher "Expired" + bouton "Renew" (meme flow que Borrow)

---

### ~~B6. Landing page — Section docs~~ ✅ DONE

**Fichier :** `src/app/page.tsx`

**Position :** entre le bouton "Launch App" et la section "About Us"

**Contenu a afficher (2 blocs) :**

**Bloc 1 — "How DataLend Works"** (flow en etapes)

```
1. UPLOAD     → Le provider upload un dataset. Sirius l'encrypte (AES-256-GCM),
                genere un Merkle tree, et upload sur IPFS.

2. CERTIFY    → Boundless genere une preuve ZK (RISC Zero) qui certifie la qualite
                du dataset : nombre d'entrees, taux de doublons, schema valide.

3. TOKENIZE   → Un MPT (Multi-Purpose Token, XLS-33) est minte on-chain XRPL avec
                les metadata : hash IPFS, preuve ZK, score qualite.

4. VAULT      → Le MPT est depose dans un Vault (XLS-65) — une lending pool on-chain.
                Le provider fixe un prix par jour.

5. BORROW     → Un borrower browse le marketplace, choisit un dataset, paye en XRP
                pour une duree choisie. Le paiement va directement au provider.

6. ACCESS     → Sirius active une cle de decryption temporaire. Le borrower accede
                aux donnees decryptees et watermarkees (copie unique, tracable).

7. EXPIRE     → A expiration, la cle est revoquee automatiquement. Le borrower peut
                prolonger son acces en repayant. Les donnees restent dans le vault.
```

**Bloc 2 — "XRPL Primitives"** (les 5 briques)

```
XLS-33 (MPT)                 → Tokenise le dataset
XLS-65 (Vault)               → Pool les MPT des providers
XLS-66 (Lending)             → Gere les loans on-chain
XLS-70 (Credentials)         → Certifie providers et borrowers (KYB/KYC)
XLS-80 (PermissionedDomains) → Controle d'acces au vault
```

**Design :** libre. Suggestions : cards avec icones, timeline verticale, ou schema horizontal type pipeline. Le style doit matcher le reste de la landing (dark theme, Tailwind).

---

## Fallback — Si Otsu ne marche pas sur wasm devnet

Si B1 echoue (Otsu ne signe pas sur network ID 2002), passer en **mode serveur sign** :

**Frontend (Dev B) :**
- Meme UI : duree → prix → bouton "Pay X XRP" → ecran "Confirm Payment"
- Au lieu de `signAndSubmit` Otsu, appeler une route backend

**Backend (Dev A) :**
- Creer `POST /api/xrpl/pay-provider` :
  - Signe le Payment avec le seed borrower du `.env`
  - Envoie la tx on-chain
  - Verifie le resultat
  - Active l'acces si valide
- Le paiement est reel on-chain, mais signe cote serveur (pas de wallet browser)

---

## Recapitulatif

| Tache | Dev A (Backend) | Dev B (Frontend) |
|-------|:---:|:---:|
| Vault name on-chain | A1 | B2 (affichage) |
| Prix par jour | A2 | B3 (champ form) |
| Paiement borrower | A3 (verification) | B4 (flow UI + Otsu) |
| Extension duree | A4 (verification) | B5 (UI expiration + modal) |
| Demo route update | A5 | — |
| Test Otsu | — | B1 (prerequis) |
| Section docs landing | — | B6 |
| Fallback sign serveur | A (si B1 echoue) | B (UI adapt) |
