# Devis & Factures — mise en place

Cette fonctionnalité ajoute l'**enregistrement** des devis et factures (par utilisateur)
au générateur `devis/index.html`, ainsi que leur liste dans l'espace client.
Elle s'appuie sur Supabase (Auth + Postgres), comme le reste du site.

## 1. Exécuter le script SQL (une seule fois)

Dans **Supabase → ton projet → SQL Editor → New query**, colle le contenu de :

```
supabase/schema-documents.sql
```

puis clique sur **Run**. Le script est **idempotent** : tu peux le relancer sans risque.

Il crée :

- la table `public.documents` (un devis ou une facture par ligne, privée à son propriétaire) ;
- la table `public.doc_counters` (compteur de numérotation par utilisateur / année / type) ;
- les politiques **RLS** (accès réservé au propriétaire : `owner = auth.uid()`) ;
- la fonction `public.next_doc_number(type)` qui attribue **atomiquement** le prochain numéro.

## 2. Avant l'exécution : rien ne casse

Tant que le script n'est **pas** exécuté — ou si l'utilisateur n'est **pas connecté** —
le générateur de devis continue de fonctionner **exactement comme avant** :

- édition des lignes, TVA, totaux HT/TVA/TTC en direct ;
- impression / export **PDF** via le navigateur ;
- catalogue rapide et mentions légales.

Seul l'**enregistrement** (boutons « Enregistrer » / « Convertir en facture ») nécessite
un compte **et** la base configurée. Sans cela, un message invite simplement à se connecter.

## 3. Numérotation

Chaque document reçoit, au **premier enregistrement**, un numéro **séquentiel continu**
par utilisateur et par année, via `next_doc_number` :

- Devis : `DEV-2026-0001`, `DEV-2026-0002`, …
- Factures : `FAC-2026-0001`, `FAC-2026-0002`, …

La numérotation continue des factures est une **obligation légale**. Elle est garantie
côté base (incrément atomique), pas côté navigateur.

## 4. Statuts

Un document peut prendre les statuts suivants (sélecteur dans le générateur) :

`brouillon` → `envoyé` → `accepté` → `facturé` → `payé`

La conversion d'un devis en facture crée une **nouvelle** facture (copie des lignes,
du client et des totaux, nouveau numéro `FAC-…`, `devis_source` renseigné) et passe
le devis source au statut `facturé`.

## 5. Mentions légales obligatoires (à compléter)

La facture affiche l'identité de l'émetteur (préremplie depuis le profil pro quand il
existe) mais **les identifiants réels de l'entreprise restent à renseigner**. Sur
l'aperçu imprimable, ils apparaissent en surbrillance :

```
SIREN : [à compléter : SIREN] · TVA : [à compléter : n° TVA]
```

Ce sont les **mêmes** identifiants que ceux des mentions légales du site
(`mentions-legales/index.html`). Une facture conforme doit comporter : numéro séquentiel,
identité de l'émetteur (dont SIREN/TVA), identité du client, date, détail par ligne,
taux et montants de TVA, totaux HT/TVA/TTC et conditions de paiement — tout cela figure
sur la version imprimable.
