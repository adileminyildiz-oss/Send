# Activer BâtiLink — guide unique

Le site est **en ligne** et fonctionne déjà (mode dégradé avec données d'exemple).
Pour passer en **réel** (comptes, chantiers, factures, messagerie, paiement…),
il reste quelques réglages **de ton côté**, à faire une seule fois.

---

## 1. Base de données (obligatoire) — 2 min

Supabase → **SQL Editor** → **New query** → colle le contenu de
**`supabase/schema-all.sql`** → **Run**.

Ce fichier installe **toutes** les tables d'un coup (profils, chantiers, devis &
factures, clients, dépenses, abonnements, demandes de documents, messagerie) avec
leurs sécurités (RLS). Il est idempotent : tu peux le relancer sans risque.

## 2. Connexion par e-mail (déjà configurée ✅)

Les clés Supabase sont déjà dans `assets/js/config.js`. Vérifie juste que la
connexion par e-mail est activée dans Supabase → **Authentication → Providers → Email**.

## 3. Stockage des documents livrés — 1 min

Supabase → **Storage** → **New bucket** : nom **`conformite`**, **Private** (décoché
« public »). Sert à livrer au client les documents qu'il a demandés.

## 4. Messagerie en temps réel (option) — 1 min

Supabase → **Database → Replication** : active la réplication de la table
**`messages`** pour la mise à jour en direct des conversations. (Sans ça, la
messagerie marche quand même, avec rafraîchissement.)

## 5. Envoi des formulaires par e-mail (déjà configuré ✅)

Ton endpoint Formspree est dans `assets/js/config.js`. Les dépôts de chantier et
les demandes de documents t'arrivent par e-mail.

## 6. Paiement de l'abonnement Pro (Stripe) — voir `STRIPE-SETUP.md`

Étapes détaillées dans **`STRIPE-SETUP.md`** : créer le produit + le prix, déployer
les 3 fonctions Edge, configurer le webhook, coller les 3 valeurs publiques dans
`assets/js/config.js`. Tant que ce n'est pas fait, le bouton « S'abonner » affiche
« bientôt disponible ».

## 7. Mentions légales — tes vraies infos d'entreprise

Les pages légales (`mentions-legales/`, `cgv/`, `confidentialite/`) contiennent des
champs **surlignés** `[à compléter]` : SIREN, TVA, capital, adresse, directeur de
publication, médiateur de la consommation… Envoie-les moi ou remplace-les
directement. Nécessaires pour être pleinement conforme.

---

## Vérifier que tout marche

1. Va sur `/compte/` → crée un compte → tu es connecté.
2. `/deposer/` → publie un chantier → il apparaît dans `/recherche/?type=chantiers`.
3. `/devis/` → crée un devis → « Enregistrer » → il apparaît dans `/espace/`.
4. `/conformite/` → demande un document → tu reçois l'e-mail (Formspree).
5. `/messages/` → depuis un chantier d'un autre compte, clique « Contacter ».
6. `/gestion/` → ajoute un client et une dépense.

Chaque brique bascule automatiquement du mode « exemple » au mode « réel » dès que
le schéma est installé — aucun autre changement de code nécessaire.
