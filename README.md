# 🌐 AEM Conseil — Site de l'agence web

Site vitrine de **AEM Conseil**, agence de création de sites internet, avec un
**portfolio de sites d'exemple** (démos navigables). Site **100 % statique** :
hébergeable gratuitement sur **GitHub Pages**, sur le domaine
`send.aemconseil.eu`.

## 🗂️ Contenu

```
index.html              Site vitrine de l'agence (accueil, services, tarifs, contact)
assets/
  css/main.css          Styles du site de l'agence
  js/main.js            Interactions (menu, animations, liens Stripe)
demos/                  Sites d'exemple (chacun autonome)
  restaurant/           Démo restaurant  « La Table d'Émile »
  artisan/              Démo artisan     « Dupont Plomberie »
  portfolio/            Démo freelance   « Léa Moreau, photographe »
  boutique/             Démo e-commerce  « Maison Verte » (panier fonctionnel)
product/                Démo de produit SaaS « Dropscope » (concept original)
  index.html            Landing du produit (hero, features, tarifs, FAQ)
  app.html              Interface de démonstration (dashboard, données d'exemple)
  assets/               CSS + JS du produit
CNAME                   Domaine personnalisé (send.aemconseil.eu)
.nojekyll               Désactive le traitement Jekyll de GitHub Pages
archive/                Ancien projet (générateur de vidéos) — conservé
```

Aucune dépendance, aucun build : ce sont des pages HTML/CSS/JS que le navigateur
ouvre directement.

---

## 🚀 Mettre le site en ligne (GitHub Pages)

C'est le **même principe** que tes sous-domaines `last`/`yada`, mais hébergé
directement depuis ce dépôt.

### 1. Activer GitHub Pages
1. Sur GitHub → dépôt **Send** → **Settings** → **Pages**.
2. **Source** : « Deploy from a branch ».
3. **Branch** : `main` (ou la branche de ce site) · dossier **/ (root)** → **Save**.
4. GitHub publie le site (1-2 min). Le fichier `CNAME` configure déjà le domaine.

### 2. DNS chez IONOS
Pour `send.aemconseil.eu`, mets un **CNAME** vers GitHub Pages (comme `last`/`yada`) :

| Type | Nom | Valeur |
| --- | --- | --- |
| CNAME | `send` | `adileminyildiz-oss.github.io` |

*(Supprime d'abord les anciens enregistrements `A`/`AAAA` du sous-domaine `send`
s'ils existent : un sous-domaine ne peut pas avoir un CNAME ET des A en même temps.)*

Après propagation (~15-30 min) et activation du HTTPS par GitHub :
**https://send.aemconseil.eu** est en ligne. ✅

---

## ✏️ Personnaliser

### Textes, tarifs, coordonnées
Tout est dans `index.html` — modifie directement le texte (nom, e-mail, prix des
forfaits, etc.).

### Paiement des forfaits (Stripe)
1. Crée des **Payment Links** sur https://dashboard.stripe.com/payment-links
   (un par forfait : Vitrine, Pro, E-commerce).
2. Colle les URL dans `assets/js/main.js` (objet `STRIPE_LINKS`).
   Tant qu'ils sont vides, les boutons renvoient vers le formulaire de contact.

### Formulaire de contact / devis
Le formulaire utilise **Formspree** (gratuit, sans serveur) :
1. Crée un formulaire sur https://formspree.io → tu obtiens un identifiant.
2. Dans `index.html`, remplace `VOTRE_ID_FORMSPREE` dans
   `action="https://formspree.io/f/VOTRE_ID_FORMSPREE"`.

### Sites d'exemple
Chaque démo est un fichier autonome dans `demos/<nom>/index.html` : tu peux les
dupliquer et les adapter pour présenter de nouveaux styles à tes prospects.

---

## 👀 Prévisualiser en local
Ouvre simplement `index.html` dans ton navigateur (double-clic), ou sers le
dossier avec un petit serveur si besoin :

```bash
npx serve .
```

---

_Ancien projet (générateur de vidéos publicitaires) déplacé dans `archive/` et
conservé dans l'historique Git._
