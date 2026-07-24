# Alertes appels d'offres — mise en service

Ce guide active les **alertes email sur les appels d'offres publics** (BOAMP) de
BâtiLink. Les utilisateurs connectés enregistrent une recherche (mots-clés +
département) depuis la page **Appels d'offres**, et reçoivent par email les
nouveaux avis correspondants.

> **Dégradation gracieuse.** Tant que la clé Resend et le planning ne sont pas
> configurés (étapes 2 à 5), les alertes sont **enregistrées** dans la base mais
> **pas encore envoyées** par email. Le site reste 100 % fonctionnel : la
> recherche BOAMP et la création d'alertes marchent, seul l'envoi attend la
> configuration ci-dessous.

---

## 1. Créer la table des alertes

Dans **Supabase → ton projet → SQL Editor → New query**, colle le contenu de
[`supabase/schema-alertes.sql`](supabase/schema-alertes.sql) puis **Run**.

Le script est **idempotent** (relançable sans risque). Il crée la table
`public.alertes_ao` avec la RLS « propriétaire uniquement » (chacun ne voit et ne
gère que ses propres alertes) et les index utiles.

Dès cette étape, le bouton « 🔔 Créer une alerte pour cette recherche » enregistre
réellement les alertes des utilisateurs connectés.

---

## 2. Créer un compte Resend et vérifier un expéditeur

L'envoi des emails passe par **[Resend](https://resend.com)** (offre gratuite
généreuse, sans carte).

1. Crée un compte gratuit sur [resend.com](https://resend.com).
2. **Domains → Add Domain** : ajoute et **vérifie ton domaine** d'envoi
   (ex. `aemconseil.eu`) en publiant les enregistrements DNS proposés (SPF/DKIM).
   À défaut de domaine, tu peux utiliser une adresse de test Resend, mais un
   domaine vérifié est nécessaire pour envoyer à de vrais destinataires.
3. **API Keys → Create API Key** : copie la clé (`re_...`).

> L'expéditeur par défaut de la fonction est `BâtiLink <alertes@aemconseil.eu>`.
> Adapte-le à ton domaine vérifié via le secret `ALERTES_FROM` (étape 4), sinon
> Resend refusera l'envoi.

---

## 3. Déployer la fonction Edge

Avec la [CLI Supabase](https://supabase.com/docs/guides/cli) installée et connectée
au projet (`supabase login`, `supabase link`) :

```bash
supabase functions deploy alertes-notify
```

La fonction se trouve dans
[`supabase/functions/alertes-notify/index.ts`](supabase/functions/alertes-notify/index.ts).

---

## 4. Renseigner les secrets

```bash
supabase secrets set \
  RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx \
  SITE_URL=https://send.aemconseil.eu \
  ALERTES_FROM="BâtiLink <alertes@aemconseil.eu>"
```

- `RESEND_API_KEY` — la clé de l'étape 2. **Sans elle, aucun email n'est envoyé**
  (le lot tourne quand même et cale les dates : dégradation gracieuse).
- `SITE_URL` — l'URL du site (liens dans l'email). Défaut : `https://send.aemconseil.eu`.
- `ALERTES_FROM` — expéditeur, à faire correspondre à ton domaine Resend vérifié.

`SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont **fournis automatiquement** à
la fonction par Supabase : rien à faire.

> ⚠️ Ne mets **jamais** `RESEND_API_KEY` ni la clé `service_role` dans un fichier
> livré au navigateur (comme `assets/js/config.js`). Elles vivent uniquement dans
> les secrets des fonctions Edge.

### Test manuel

```bash
supabase functions invoke alertes-notify --no-verify-jwt
```

La fonction renvoie un petit récapitulatif JSON, par ex. :

```json
{ "alertes": 3, "emails_envoyes": 1, "avec_nouveaux": 1, "erreurs": 0, "resend_configure": true }
```

---

## 5. Planifier l'exécution quotidienne

Deux options.

### Option A — pg_cron (dans Supabase)

Dans **SQL Editor**, active les extensions puis programme l'appel HTTP de la
fonction (adapte `<PROJECT_REF>` et le token) :

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Tous les jours à 07:00 UTC : appelle la fonction alertes-notify.
select cron.schedule(
  'alertes-notify-quotidien',
  '0 7 * * *',
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.functions.supabase.co/alertes-notify',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer <SUPABASE_SERVICE_ROLE_KEY>'
    ),
    body    := '{}'::jsonb
  );
  $$
);
```

Pour arrêter : `select cron.unschedule('alertes-notify-quotidien');`

### Option B — Scheduled function Supabase

Depuis le **Dashboard → Edge Functions → alertes-notify → Schedules**, ajoute un
planning cron (ex. `0 7 * * *`). Supabase déclenche alors la fonction toute seule.

---

## Récapitulatif

| Étape | Sans configuration | Après configuration |
|------|--------------------|---------------------|
| Créer une alerte | ✅ enregistrée (après étape 1) | ✅ enregistrée |
| Gérer / supprimer | ✅ | ✅ |
| Email des nouveaux avis | ❌ non envoyé | ✅ envoyé quotidiennement |

La page **Appels d'offres** ne casse jamais : si Supabase ou Resend ne sont pas
configurés, le bloc d'alertes s'efface simplement et la recherche BOAMP reste
pleinement fonctionnelle.
