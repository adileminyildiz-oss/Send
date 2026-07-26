# DC4 — Déclaration de sous-traitance (guide d'installation)

Ce module ajoute à BâtiLink un générateur de **DC4**, c'est-à-dire l'**acte
spécial de sous-traitance** utilisé dans les marchés de travaux (publics comme
privés).

## Qu'est-ce que le DC4 ?

Le DC4 (« déclaration de sous-traitance ») identifie, pour un marché donné :

- le **maître d'ouvrage** (le donneur d'ordre) ;
- le **titulaire** du marché (l'entreprise principale) ;
- le **sous-traitant** que le titulaire souhaite faire intervenir ;
- la **nature et le prix** des prestations sous-traitées ;
- les **modalités de paiement** du sous-traitant.

C'est un document courant du BTP : le titulaire déclare son sous-traitant au
maître d'ouvrage, qui l'accepte et agrée les conditions de paiement.

## Ce que génère BâtiLink

La page `dc4/index.html` produit un **document clair, formel et imprimable**
(impression navigateur → « Enregistrer au format PDF »), pré-rempli à partir de
votre saisie, avec des **cases de signature** (titulaire / sous-traitant /
maître d'ouvrage) **à signer à la main**.

> ⚠️ Il s'agit d'un **équivalent pratique**, et non du formulaire Cerfa
> officiel DC4. Il reprend les mêmes rubriques et convient à la plupart des
> usages, mais si votre marché exige le Cerfa exact, reportez-y les informations
> saisies ici. La **signature réelle** se fait à la main (une intégration de
> signature électronique pourra être ajoutée ultérieurement).

## Dégradation gracieuse

Le générateur fonctionne **entièrement sans compte et sans base de données** :
c'est un outil de formulaire + impression autonome. La couche d'enregistrement
ne s'active que si :

1. la librairie `@supabase/supabase-js@2` est chargée (CDN) ;
2. les clés sont présentes dans `assets/js/config.js` ;
3. l'utilisateur est **connecté** ;
4. le schéma SQL ci-dessous a été exécuté.

Si l'une de ces conditions manque, la page reste utilisable et imprimable ;
seul l'enregistrement est indisponible (aucune erreur bloquante).

Lorsqu'un utilisateur est connecté, le bloc **Titulaire** est prérempli
automatiquement depuis son profil (`BLDB.getProfile`).

## Installation de la base de données

1. Ouvrez **Supabase → votre projet → SQL Editor → New query**.
2. Copiez-collez le contenu de `supabase/schema-dc4.sql`.
3. Cliquez sur **Run**.

Le script est **idempotent** : vous pouvez le relancer sans risque. Il crée :

- la table `public.dc4` (une déclaration par ligne, privée à son propriétaire) ;
- la table `public.dc4_counters` (compteur de numérotation) ;
- la fonction `public.next_dc4_number()` (numérotation séquentielle) ;
- les politiques **RLS** réservant l'accès au propriétaire (`owner = auth.uid()`).

## Numérotation

À l'enregistrement, chaque déclaration reçoit un numéro séquentiel de la forme
**`DC4-2026-0001`** (préfixe `DC4`, année en cours, compteur incrémenté par
utilisateur et par année). La numérotation est attribuée côté serveur via la
fonction `SECURITY DEFINER` `next_dc4_number()`, de façon atomique.

## Note légale sur le paiement direct

Lorsque le montant du contrat de sous-traitance est **égal ou supérieur à
600 € TTC**, le sous-traitant est **payé directement par le maître d'ouvrage**
pour la part du marché qu'il exécute (loi n° 75-1334 du 31 décembre 1975
relative à la sous-traitance). En dessous de ce seuil, le paiement direct
n'est pas obligatoire. Cette mention figure sur le document généré, à titre
d'information factuelle ; elle ne se substitue pas à un conseil juridique.

## Fichiers du module

| Fichier | Rôle |
| --- | --- |
| `dc4/index.html` | Page générateur + aperçu imprimable |
| `assets/js/dc4.js` | `window.BLDC4` — couche de persistance Supabase |
| `supabase/schema-dc4.sql` | Schéma (tables, RLS, fonction de numérotation) |
| `DC4-SETUP.md` | Ce guide |
