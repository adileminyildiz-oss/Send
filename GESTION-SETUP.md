# Module Gestion — clients & dépenses (BâtiLink)

Ce module ajoute à BâtiLink un espace privé de **suivi client (CRM)**, de
**suivi des dépenses** et un **tableau de bord de marge**, accessible depuis
`gestion/index.html` (et résumé dans l'espace client `espace/index.html`).

## Installation (une seule fois)

1. Ouvrez **Supabase → votre projet → SQL Editor → New query**.
2. Copiez-collez le contenu de **`supabase/schema-gestion.sql`** puis **Run**.
3. C'est tout. Le script est **idempotent** : vous pouvez le relancer sans risque.

Le script crée deux tables (`clients`, `depenses`), active la sécurité
**RLS propriétaire uniquement** (`owner = auth.uid()`) pour lecture/écriture/
suppression, et ajoute les index utiles (par propriétaire et par date).

## Ce que fait le module

- **Suivi client (CRM)** — table `clients` : nom, contact, email, téléphone,
  adresse, ville, code postal, notes. Ajout / modification / suppression en ligne.
- **Suivi des dépenses** — table `depenses` : libellé, catégorie
  (Matériaux, Sous-traitance, Matériel/Outillage, Véhicule/Carburant,
  Assurances, Frais généraux, Autre), fournisseur, montant HT, TVA,
  montant TTC (calculé automatiquement si laissé vide : `HT × (1 + TVA/100)`),
  date, chantier, notes. Total TTC courant affiché.
- **Tableau de bord de marge** — 4 indicateurs calculés côté navigateur :
  - **Clients** : nombre de fiches.
  - **Dépenses (TTC)** : somme des dépenses.
  - **CA encaissé** : somme des `total_ttc` des **factures au statut « payé »**
    (lues via `BLDocs`, table `documents` du module devis/factures).
  - **Marge estimée** : `CA encaissé − Dépenses TTC`.

## Dégradation gracieuse

Tout fonctionne **avant même** d'avoir lancé le SQL :

- Supabase non configuré (`assets/js/config.js` vide) → écran « Connexion à configurer ».
- Utilisateur déconnecté → écran d'invitation à se connecter (`compte/index.html`).
- Tables absentes ou erreur réseau → `window.BLGestion` renvoie des listes vides
  et des zéros ; les indicateurs de CA / marge affichent `—`. Aucune page ne casse.

Le CA encaissé et la marge nécessitent en plus le module devis/factures
(`supabase/schema-documents.sql`) et des factures marquées **« payé »** ;
sans lui, ces deux cartes affichent `—` mais le reste reste utilisable.

## Fichiers

- `supabase/schema-gestion.sql` — tables + RLS + index.
- `assets/js/gestion.js` — `window.BLGestion` (accès défensif : `listClients`,
  `saveClient`, `deleteClient`, `listDepenses`, `saveDepense`, `deleteDepense`,
  `summary`).
- `gestion/index.html` — page dédiée, protégée par connexion.
- `espace/index.html` — carte récapitulative « Gestion (clients & dépenses) ».
