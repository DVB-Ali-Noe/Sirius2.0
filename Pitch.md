# DataLend — Le lending pool DeFi pour datasets IA

## Pitch idée (30s)

Le marché des données IA est cassé : tu vends un dataset une fois, tu perds le contrôle, zéro revenu récurrent. DataLend inverse ça — au lieu de vendre tes données, tu les **prêtes**. Comme un lending pool DeFi, mais l'actif c'est un dataset encrypté. Le provider touche du yield en XRP, le borrower a un accès temporaire avec garantie de qualité en ZK, et à expiration l'accès est révoqué on-chain. Tout ça avec les primitives natives XRPL — pas de smart contracts externes.

---

## Pitch idée + stack (45s)

Le marché des données IA est cassé : tu vends un dataset une fois, tu perds le contrôle, zéro revenu récurrent. DataLend inverse ça — au lieu de vendre tes données, tu les **prêtes**.

Le dataset est encrypté, stocké sur IPFS, et représenté on-chain par un MPT (XLS-33). Il est déposé dans un Vault (XLS-65), et prêté via le Lending Protocol natif (XLS-66). L'accès est contrôlé par des Credentials (XLS-70) et des Permissioned Domains (XLS-80) — tout au niveau du ledger.

Off-chain, Sirius gère l'encryption et les clés temporaires. Boundless génère des preuves ZK de qualité sans révéler les données. Et chaque borrower reçoit une copie watermarkée unique pour tracer les leaks.

Le provider touche du yield en XRP. Le borrower paie un accès temporaire. À expiration, la clé est révoquée. Cinq primitives XRPL natives, zéro smart contract externe.

---

## Pitch complet (3min)

Le marché des données IA aujourd'hui, c'est un modèle cassé. Tu es data provider, t'as un dataset de qualité — instruction tuning, données médicales, données financières. Tu le vends une fois sur un marketplace. L'acheteur le télécharge, et c'est fini. Tu perds le contrôle immédiatement. Pas de revenu récurrent. Pas de traçabilité. Le dataset circule, il est revendu, copié. Et toi tu touches rien.

Côté acheteur c'est pas mieux. T'as aucune garantie de qualité avant d'acheter. T'es obligé de payer le prix fort pour un accès permanent alors que t'en as besoin 30 jours pour fine-tuner ton modèle. Et y'a aucun standard de confiance — tu sais pas si le dataset est frais, unique, ou rempli de doublons.

DataLend résout ça avec une idée simple : **on ne vend plus les datasets, on les prête.** Exactement comme un lending pool en DeFi. Sauf que l'actif c'est pas du stablecoin — c'est un dataset encrypté.

Concrètement, comment ça marche.

Le provider prend son dataset, il le passe dans **Sirius**, notre couche off-chain. Sirius le découpe en Merkle tree, l'encrypte en AES-256, et le stocke sur **IPFS via Pinata**. En parallèle, **Boundless** génère une preuve zero-knowledge sur la qualité du dataset — nombre d'entrées, taux de doublons, conformité au schéma — sans jamais révéler une seule donnée. Le borrower peut vérifier cryptographiquement ce qu'il va recevoir *avant* de payer.

On-chain, le dataset est représenté par un **MPT — Multi-Purpose Token, XLS-33**. Le MPT porte toute la metadata : le hash IPFS, la référence de la preuve ZK, le certificat qualité, la version. C'est la clé d'accès on-chain au dataset.

Ce MPT est déposé dans un **Vault, XLS-65**. Le vault pool les datasets de plusieurs providers. Chaque provider reçoit des vault shares proportionnelles — exactement comme un LP token dans un pool de liquidité. Sauf qu'ici tu déposes de la donnée, pas du capital.

Quand un borrower veut accéder à un dataset, il passe par le **Lending Protocol natif, XLS-66**. Le LoanBroker vérifie ses **Credentials XLS-70** — KYB, identité vérifiée. L'accès au vault est filtré par des **Permissioned Domains XLS-80** — si t'as pas les bons credentials, tu peux même pas interagir avec le vault. C'est du contrôle d'accès au niveau du ledger, pas du middleware.

Le loan est créé on-chain. Le MPT est transféré temporairement au borrower. Sirius détecte l'event, génère une **copie watermarkée unique** pour ce borrower — des micro-perturbations imperceptibles mais traçables — et lui émet une clé de décryption temporaire avec TTL.

Le borrower paie des intérêts en XRP selon un échéancier fixé. À expiration du loan, le MPT retourne au vault, Sirius révoque la clé, les intérêts sont distribués aux providers au prorata de leurs shares. Si le borrower fait défaut, le LoanBroker a déposé du **First-Loss Capital** qui couvre les pertes des providers. Et le credential du borrower est flaggé — il ne pourra plus emprunter.

Et si le borrower leak le dataset ? Le watermark unique permet de tracer la source. Chaque copie est différente, chaque leak est identifiable.

Le point clé : tout ça utilise **cinq primitives natives XRPL**. MPT, Vault, Lending, Credentials, Permissioned Domains. C'est pas 8 smart contracts composés sur Ethereum où chaque protocole externe est une surface d'attaque. C'est du code dans le ledger, audité au niveau du protocole.

DataLend transforme les datasets en actifs productifs. Les providers gagnent du yield sans perdre le contrôle. Les borrowers paient ce qu'ils utilisent, avec des garanties de qualité vérifiables. Et personne ne possède la donnée définitivement.

---

## Q&A — Réponses prêtes

| Question | Réponse |
|---|---|
| "Et si le borrower copie les données ?" | Chaque borrower reçoit une version watermarkée unique. Si ça leak, on trace la source. Et en mode API-only, il ne voit jamais les données brutes. |
| "Comment vous fixez le prix d'un dataset ?" | Le LoanBroker valorise chaque MPT à partir du certificat ZK — taille, qualité, unicité. C'est un problème ouvert pour la décentralisation, mais le modèle fonctionne avec un opérateur. |
| "Pourquoi pas Ethereum ?" | Lending, vault, credentials, permissions — tout est natif XRPL. Sur Ethereum c'est 8 protocoles composés, chacun hackable séparément. |
| "Les ZK proofs, vous prouvez quoi exactement ?" | Structure, pas sémantique : nombre d'entrées, taux de doublons, conformité au schéma. Le borrower sait exactement ce qu'il achète avant de payer. |
| "C'est quoi le business model ?" | Le LoanBroker prend un spread entre le taux borrower et le yield provider. Plus un First-Loss Capital comme skin in the game. |

---

## Conseils delivery

- **Ne lis rien.** Tu connais ton projet, parle naturellement.
- **La démo EST le pitch.** Minimise le blabla, maximise ce que tu montres à l'écran.
- **Parle lentement** sur les 20 premières secondes. Le jury s'installe.
- **Si un bug arrive en démo** — décris ce qui devrait se passer et avance. Ne debug jamais en live.
- **Prépare un fallback** : screenshots/vidéo du flow si le réseau hackathon plante.
