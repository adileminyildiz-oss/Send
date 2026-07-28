# Notifications email des messages — mise en service

Ce guide active les **notifications email de la messagerie interne** de BâtiLink.
Aujourd'hui, quand un utilisateur reçoit un message, il n'est prévenu **que s'il
retourne sur le site** — la messagerie est donc sous-utilisée. Une fois cette
fonction en place, le destinataire reçoit un email **« Vous avez N nouveaux
messages sur BâtiLink »** avec un lien vers sa messagerie.

> **Confidentialité.** L'email ne contient **jamais le contenu des messages**
> (au plus leur nombre). La messagerie interne sert justement à échanger sans
> dévoiler ses coordonnées : l'utilisateur doit se connecter pour lire.

> **Dégradation gracieuse.** Tant que la clé Resend et le planning ne sont pas
> configurés, **aucun email n'est envoyé et aucun message n'est marqué comme
> notifié** : le backlog est conservé. Le jour où tu renseignes `RESEND_API_KEY`,
> les messages non lus en attente seront bien notifiés. La messagerie reste 100 %
> fonctionnelle entre-temps.

---

## 1. Ajouter le suivi des notifications (SQL)

> ⚠️ La messagerie doit déjà être installée : exécute d'abord
> [`supabase/schema-messages.sql`](supabase/schema-messages.sql) si ce n'est pas
> fait.

Dans **Supabase → ton projet → SQL Editor → New query**, colle le contenu de
[`supabase/schema-notif.sql`](supabase/schema-notif.sql) puis **Run**.

Le script est **idempotent** (relançable sans risque). Il ajoute la colonne
`public.messages.notifie` (drapeau anti-doublon, aucun contenu copié) et un index
partiel sur les messages restant à notifier.

---

## 2. Compte Resend et expéditeur vérifié

L'envoi passe par **[Resend](https://resend.com)**. Si tu as déjà configuré les
**alertes appels d'offres** (voir `ALERTES-SETUP.md`), tu peux **réutiliser le même
compte et le même domaine vérifié** — il suffit d'une clé API.

1. Crée un compte gratuit sur [resend.com](https://resend.com) (si pas déjà fait).
2. **Domains → Add Domain** : ajoute et **vérifie ton domaine** d'envoi
   (ex. `aemconseil.eu`) via les enregistrements DNS proposés (SPF/DKIM).
3. **API Keys → Create API Key** : copie la clé (`re_...`). Tu peux réutiliser la
   clé des alertes.

> L'expéditeur par défaut de la fonction est
> `BâtiLink <notifications@aemconseil.eu>`. Adapte-le à ton domaine vérifié via le
> secret `NOTIF_FROM` (étape 4), sinon Resend refusera l'envoi.

---

## 3. Déployer la fonction Edge

Avec la [CLI Supabase](https://supabase.com/docs/guides/cli) installée et connectée
au projet (`supabase login`, `supabase link`) :

```bash
supabase functions deploy notify-messages
```

La fonction se trouve dans
[`supabase/functions/notify-messages/index.ts`](supabase/functions/notify-messages/index.ts).

---

## 4. Renseigner les secrets

```bash
supabase secrets set \
  RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx \
  SITE_URL=https://send.aemconseil.eu \
  NOTIF_FROM="BâtiLink <notifications@aemconseil.eu>"
```

- `RESEND_API_KEY` — la clé de l'étape 2. **Sans elle, aucun email n'est envoyé et
  aucun message n'est marqué notifié** (dégradation gracieuse : le backlog est
  conservé pour un envoi ultérieur).
- `SITE_URL` — l'URL du site (lien dans l'email). Défaut : `https://send.aemconseil.eu`.
- `NOTIF_FROM` — expéditeur, à faire correspondre à ton domaine Resend vérifié.

`SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont **fournis automatiquement** à la
fonction par Supabase : rien à faire.

> ⚠️ Ne mets **jamais** `RESEND_API_KEY` ni la clé `service_role` dans un fichier
> livré au navigateur (comme `assets/js/config.js`). Elles vivent uniquement dans
> les secrets des fonctions Edge.

### Test manuel

```bash
supabase functions invoke notify-messages --no-verify-jwt
```

La fonction renvoie un petit récapitulatif JSON, par ex. :

```json
{ "messages_examines": 5, "destinataires": 2, "emails_envoyes": 2, "messages_notifies": 5, "erreurs": 0, "resend_configure": true }
```

Si `RESEND_API_KEY` est absente, la réponse indique
`"resend_configure": false` et une note : rien n'est envoyé ni marqué.

---

## 5. Planifier l'exécution (toutes les quelques minutes)

La fonction ne notifie que les messages datant de **plus de 2 minutes** (délai de
grâce : un destinataire connecté qui lit en direct n'est pas spammé). Un planning
toutes les **5 minutes** est un bon compromis.

### Option A — pg_cron (dans Supabase)

Dans **SQL Editor**, active les extensions puis programme l'appel HTTP de la
fonction (adapte `<PROJECT_REF>` et le token) :

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Toutes les 5 minutes : appelle la fonction notify-messages.
select cron.schedule(
  'notify-messages-5min',
  '*/5 * * * *',
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.functions.supabase.co/notify-messages',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer <SUPABASE_SERVICE_ROLE_KEY>'
    ),
    body    := '{}'::jsonb
  );
  $$
);
```

Pour arrêter : `select cron.unschedule('notify-messages-5min');`

### Option B — Scheduled function Supabase

Depuis le **Dashboard → Edge Functions → notify-messages → Schedules**, ajoute un
planning cron (ex. `*/5 * * * *`). Supabase déclenche alors la fonction toute seule.

---

## Récapitulatif

| Étape | Sans configuration | Après configuration |
|------|--------------------|---------------------|
| Envoyer / recevoir des messages | ✅ (après `schema-messages.sql`) | ✅ |
| Colonne `notifie` de suivi | ✅ (après étape 1, reste à `false`) | ✅ |
| Email « nouveaux messages » | ❌ non envoyé, backlog conservé | ✅ envoyé toutes les ~5 min |
| Contenu des messages dans l'email | — | ❌ jamais (confidentialité) |

La messagerie ne casse jamais : si Resend ou le planning ne sont pas configurés,
les messages restent simplement non notifiés par email, prêts à l'être dès la
configuration terminée.
