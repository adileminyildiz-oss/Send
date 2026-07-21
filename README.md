# 🏗️ BâtiLink — send.aemconseil.eu

Site de **BâtiLink**, la plateforme des artisans du bâtiment (chantiers, aides &
subventions, artisans, sous-traitance) — une activité du cabinet **AEM-CONSEIL**.
Site **statique**, hébergé gratuitement sur **GitHub Pages**, domaine
`send.aemconseil.eu`.

## 🗂️ Contenu

```
index.html              Page d'accueil BâtiLink (landing plateforme)
etude-marche/           Étude de marché (panorama concurrentiel, stratégie)
compte/                 Espace client — connexion par email (Supabase)
assets/
  css/main.css          Styles partagés (utilisés par l'espace client)
  js/config.js          Clés Supabase (URL + clé anon publique)
  js/account.js         Logique de connexion (inscription / connexion / session)
  og-image.png          Image de partage (réseaux sociaux)
CNAME, .nojekyll        Configuration GitHub Pages
robots.txt, sitemap.xml Référencement (SEO)
archive/                Anciens projets conservés dans l'historique
```

Aucune dépendance, aucun build : ce sont des pages HTML/CSS/JS ouvertes
directement par le navigateur.

## 🚀 Déploiement (GitHub Pages)

Le site se publie automatiquement depuis la branche `main` (Settings → Pages →
Deploy from a branch). Le domaine `send.aemconseil.eu` pointe vers GitHub Pages
via un enregistrement **CNAME** chez IONOS (`send → adileminyildiz-oss.github.io`).

## 🔐 Connexion par email (Supabase)

L'espace client (`/compte`) utilise **Supabase** (authentification côté client).
Les identifiants du projet sont dans `assets/js/config.js`
(`SUPABASE_URL` + clé `anon` publique). Réglage à faire côté Supabase :
Authentication → URL Configuration → **Site URL** = `https://send.aemconseil.eu`.

## ✏️ Personnaliser

Les pages sont éditables directement (textes, chiffres, liens). La landing
BâtiLink et l'étude de marché sont des fichiers HTML autonomes.
