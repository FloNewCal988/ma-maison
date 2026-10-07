# 🏠 Ma Maison

Petite application personnelle (iPhone + ordinateur) pour :

- **Rangement** : noter où sont rangées tes affaires (« la tente dans l'armoire de la terrasse ») et les retrouver par recherche.
- **Lieux** : créer ses rangements (armoire, tiroir, étagère…) classés par pièce, et voir ce que contient chacun.
- **Infos maison** : un pense-bête de la maison (« Poubelle cuisine → sacs de 20 L »).

## 🔒 Sécurité

- L'**application** (le code) est publique sur GitHub Pages : elle ne contient aucune donnée.
- Tes **données** sont dans un **dépôt privé** séparé, dans un fichier `data.enc.json`.
- Ce fichier est **chiffré avec ton mot de passe** (AES-256-GCM, clé dérivée par PBKDF2-SHA256, 310 000 itérations) **sur ton téléphone, avant l'envoi**. Même si quelqu'un accédait au dépôt, il ne verrait qu'un bloc illisible.
- Ton mot de passe n'est **jamais envoyé ni stocké**. Le jeton GitHub est stocké sur l'appareil, lui aussi chiffré avec ton mot de passe.
- Verrouillage automatique après 10 minutes d'inactivité.
- ⚠️ **Mot de passe oublié = données perdues.** Fais de temps en temps un export (Réglages → Exporter) et garde-le en lieu sûr.

---

## Installation (≈ 15 min, une seule fois)

### 1. Dépôt de l'application (public)

1. Sur github.com → **New repository** → nom : `ma-maison` → **Public** → *Create*.
2. *Add file → Upload files* → dépose les 7 fichiers : `index.html`, `sw.js`, `manifest.webmanifest`, `icon-180.png`, `icon-192.png`, `icon-512.png`, `README.md` → *Commit*.
3. *Settings → Pages* → Source : **Deploy from a branch** → Branch : `main` / `(root)` → *Save*.
4. Après 1–2 minutes, l'app est en ligne sur : `https://TON-PSEUDO.github.io/ma-maison/`

### 2. Dépôt des données (privé)

1. **New repository** → nom : `ma-maison-donnees` → **Private** → coche **Add a README file** → *Create*.

### 3. Jeton d'accès (limité à ce seul dépôt)

1. Photo de profil → *Settings → Developer settings → Personal access tokens → **Fine-grained tokens*** → *Generate new token*.
2. Nom : `Ma Maison` · Expiration : 1 an (ou ce que tu veux).
3. **Repository access → Only select repositories →** `ma-maison-donnees`.
4. **Permissions → Repository permissions → Contents : Read and write** (rien d'autre).
5. *Generate token* → copie le jeton `github_pat_…`.

> Ce jeton ne donne accès qu'au dépôt de données, en lecture/écriture de fichiers. Rien d'autre sur ton compte.

### 4. Premier lancement

1. Ouvre `https://TON-PSEUDO.github.io/ma-maison/`
2. Renseigne : ton pseudo GitHub, `ma-maison-donnees`, le jeton, et **choisis un mot de passe** (8 caractères minimum).
3. C'est prêt.

### 5. Sur iPhone

1. Ouvre le lien dans **Safari** → bouton **Partager** → **Sur l'écran d'accueil**.
2. L'app s'ouvre ensuite en plein écran comme une vraie app.
3. Sur un **nouvel appareil**, refais l'étape 4 avec **le même mot de passe** : tes données se synchronisent.

---

## Utilisation

- **Saisie rapide** (onglet Rangement) : tape ou dicte (micro du clavier iPhone) :
  - « J'ai rangé la tente dans l'armoire de la terrasse »
  - « perceuse au garage »
  - « les clés sur l'étagère de l'entrée »
  Si l'objet existe déjà, il est simplement **déplacé** vers le nouveau lieu.
- **Onglet Lieux → bouton +** : crée un rangement vide (nom + pièce), puis « + Ajouter un objet ici ». Appuie sur un rangement pour le renommer (les objets suivent).
- **Bouton + (onglet Rangement)** : formulaire complet (avec précisions : étagère, sac, boîte…).
- **Infos maison** : bouton + → Sujet `Poubelle cuisine` · Info `Sacs poubelle de 20 L` · Catégorie `Courses`.
- **Recherche** : en haut de chaque onglet, sans se soucier des accents ni des majuscules.
- **Hors ligne** : l'app fonctionne ; les modifications partent sur GitHub au retour du réseau.

## Quand le jeton expire

Crée un nouveau jeton (étape 3), puis dans l'app : écran de verrouillage → *Réinitialiser cet appareil* → reconnecte-toi avec le nouveau jeton et **le même mot de passe**.
