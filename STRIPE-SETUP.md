# Configuration de l'abonnement Pro (Stripe) — BâtiLink

Ce guide décrit, étape par étape, comment activer l'abonnement **Pro mensuel
(39 € / mois)** sur BâtiLink. Tant que ces étapes ne sont pas faites, le site
**fonctionne normalement** : le bouton « S'abonner » affiche simplement
« bientôt disponible » et l'espace client affiche « Gratuit ».

**Architecture** : site statique (GitHub Pages) → 3 fonctions Edge Supabase
(Deno) → Stripe. La table `public.subscriptions` (Supabase) stocke l'état de
l'abonnement ; elle n'est écrite QUE par le webhook Stripe (clé service_role).

---

## Règle de sécurité (à lire en premier)

- **Sont PUBLIQUES** (peuvent aller dans `assets/js/config.js`, livré au
  navigateur) : la clé Supabase `anon`, la clé **publiable** Stripe (`pk_...`),
  l'id de tarif (`price_...`), l'URL des fonctions.
- **Sont SECRÈTES** (uniquement dans les *secrets* des fonctions Supabase,
  JAMAIS dans le dépôt Git) : la clé **secrète** Stripe (`sk_...`), le secret de
  signature du webhook (`whsec_...`), la clé Supabase `service_role`.

---

## Étape 1 — Créer le produit et le tarif dans Stripe

1. Connectez-vous au [Dashboard Stripe](https://dashboard.stripe.com/).
   (Utilisez le **mode Test** pour valider, puis repassez en **mode Live**.)
2. **Produits → + Ajouter un produit**.
   - Nom : `BâtiLink Pro`
   - Tarif : **Récurrent**, `39,00 €`, période **mensuelle**, devise **EUR**.
3. Enregistrez, puis ouvrez le tarif créé et copiez son identifiant
   **`price_...`** (c'est votre `STRIPE_PRICE_PRO`).

## Étape 2 — Récupérer les clés API Stripe

**Développeurs → Clés API** :
- **Clé publiable** `pk_test_...` / `pk_live_...` → ira dans `config.js`.
- **Clé secrète** `sk_test_...` / `sk_live_...` → secret de fonction (étape 5).

## Étape 3 — Créer la table d'abonnement dans Supabase

Dans **Supabase → votre projet → SQL Editor → New query**, collez le contenu de
`supabase/schema-billing.sql` puis **Run**. Le script est idempotent (relançable
sans risque). Il crée `public.subscriptions`, active la RLS et n'autorise que la
lecture de sa propre ligne.

## Étape 4 — Déployer les 3 fonctions Edge

Prérequis : la [CLI Supabase](https://supabase.com/docs/guides/cli) installée et
connectée. Depuis la racine du dépôt :

```bash
# Une seule fois : se connecter et lier le projet
supabase login
supabase link --project-ref <VOTRE_REF_PROJET>   # ex. kneexwqmlgqdwferckkq

# Déployer les trois fonctions
supabase functions deploy create-checkout
supabase functions deploy customer-portal
supabase functions deploy stripe-webhook --no-verify-jwt
```

> `stripe-webhook` est déployée avec `--no-verify-jwt` : elle est appelée par
> Stripe (et non par un navigateur authentifié), et elle vérifie elle-même la
> **signature Stripe**. Les deux autres fonctions vérifient le JWT Supabase.

Après déploiement, l'URL de base des fonctions est :
`https://<VOTRE_REF_PROJET>.functions.supabase.co`
(c'est votre `SUPABASE_FUNCTIONS_URL`). L'URL du webhook est donc :
`https://<VOTRE_REF_PROJET>.functions.supabase.co/stripe-webhook`.

## Étape 5 — Définir les secrets des fonctions

```bash
supabase secrets set \
  STRIPE_SECRET_KEY=sk_live_xxx \
  STRIPE_WEBHOOK_SECRET=whsec_xxx \
  STRIPE_PRICE_PRO=price_xxx \
  SITE_URL=https://send.aemconseil.eu \
  SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
```

- `STRIPE_WEBHOOK_SECRET` s'obtient à l'étape 6 (créez d'abord le webhook, puis
  revenez définir ce secret).
- `SUPABASE_SERVICE_ROLE_KEY` : **Supabase → Settings → API → service_role**
  (clé **secrète**, ne jamais l'exposer côté client).
- `SUPABASE_URL` et `SUPABASE_ANON_KEY` sont **fournis automatiquement** par
  Supabase aux fonctions : inutile de les définir ici.

## Étape 6 — Configurer le webhook Stripe

Dans **Stripe → Développeurs → Webhooks → + Ajouter un endpoint** :

- **URL du endpoint** :
  `https://<VOTRE_REF_PROJET>.functions.supabase.co/stripe-webhook`
- **Événements à écouter** (sélectionnez précisément) :
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.paid`
  - `invoice.payment_failed`

Enregistrez, ouvrez le endpoint et copiez le **Signing secret** `whsec_...` :
c'est le `STRIPE_WEBHOOK_SECRET` de l'étape 5 (relancez la commande `secrets set`
si besoin).

## Étape 7 — (Recommandé) Activer le portail client Stripe

**Stripe → Paramètres → Facturation → Portail client** : activez le portail et
autorisez au minimum l'**annulation** et la **mise à jour du moyen de paiement**.
C'est ce portail qu'ouvre le bouton « Gérer / résilier mon abonnement ».

## Étape 8 — Renseigner les 3 valeurs publiques dans `config.js`

Ouvrez `assets/js/config.js` et remplissez :

```js
window.STRIPE_PUBLISHABLE_KEY = "pk_live_xxx";                              // étape 2
window.STRIPE_PRICE_PRO       = "price_xxx";                               // étape 1
window.SUPABASE_FUNCTIONS_URL = "https://<VOTRE_REF_PROJET>.functions.supabase.co"; // étape 4
```

Dès que ces trois valeurs sont remplies, `BLBilling.ready` passe à `true` et le
bouton « S'abonner » lance réellement le paiement.

---

## Vérification

1. Ouvrez la page d'accueil, section **Tarifs**, cliquez **« S'abonner »**
   (connecté). Vous devez être redirigé vers **Stripe Checkout**.
2. Payez avec une carte de test Stripe (`4242 4242 4242 4242`, date future,
   CVC quelconque) en mode Test.
3. Après paiement, retour sur `/espace/index.html` : la carte **Mon abonnement**
   doit afficher **« Pro actif jusqu'au … »**.
4. Le bouton **« Gérer / résilier mon abonnement »** doit ouvrir le portail
   Stripe.

## Dépannage

- **Le bouton dit « bientôt disponible »** : une des 3 valeurs de `config.js`
  est vide.
- **L'abonnement ne passe pas en « Pro actif »** : vérifiez dans
  **Stripe → Webhooks** que les événements arrivent en `200`. Un `400`
  « Signature invalide » = `STRIPE_WEBHOOK_SECRET` incorrect. Consultez aussi les
  logs : `supabase functions logs stripe-webhook`.
- **CORS / 401 au checkout** : vérifiez `SITE_URL` (secret) et que
  l'utilisateur est bien connecté (JWT valide).

## Rappel

Ne committez **jamais** `sk_...`, `whsec_...` ni la clé `service_role`.
Seules les valeurs publiques (`pk_...`, `price_...`, URL des fonctions)
appartiennent à `config.js`.
