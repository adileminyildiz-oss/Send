-- ---------------------------------------------------------------------------
-- BâtiLink — schéma FACTURATION (abonnement Pro via Stripe)
--
-- À exécuter dans : Supabase → ton projet → SQL Editor → New query → Run.
-- Ce script est IDEMPOTENT : tu peux le relancer sans risque (create ... if not
-- exists, drop policy if exists avant chaque create policy).
--
-- Tant que ce script n'est pas exécuté, le site continue de fonctionner : la
-- lecture de l'abonnement échoue silencieusement (BLBilling renvoie null) et
-- l'utilisateur est simplement considéré comme « Gratuit ».
--
-- ⚠️ MODÈLE DE SÉCURITÉ — QUI ÉCRIT DANS CETTE TABLE ?
--   Le SEUL rédacteur de public.subscriptions est le webhook Stripe
--   (fonction Edge « stripe-webhook »), qui utilise la clé SERVICE_ROLE.
--   La clé service_role CONTOURNE la RLS : il ne faut donc AUCUNE politique
--   d'écriture (insert/update/delete) pour anon/authenticated. Le navigateur
--   (clé anon) ne peut QUE LIRE sa propre ligne. C'est Stripe (source de
--   vérité du paiement) qui pilote l'état de l'abonnement, jamais le client.
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- 1. TABLE subscriptions — état de l'abonnement d'un utilisateur.
--    Une ligne par utilisateur (clé = id de auth.users).
-- ===========================================================================
create table if not exists public.subscriptions (
  user_id                uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id     text,          -- id client Stripe (cus_...)
  stripe_subscription_id text,          -- id abonnement Stripe (sub_...)
  status                 text,          -- 'active','trialing','past_due','canceled','incomplete'...
  price_id               text,          -- tarif Stripe souscrit (price_...)
  current_period_end     timestamptz,   -- fin de la période payée en cours
  updated_at             timestamptz default now()
);

comment on table public.subscriptions is
  'État des abonnements Stripe. Écrit UNIQUEMENT par le webhook Stripe (service_role, qui contourne la RLS). Le client ne peut que lire sa propre ligne.';

-- Index pour retrouver rapidement une ligne par client Stripe (utilisé par le
-- webhook lors des événements qui ne portent pas l'id utilisateur).
create index if not exists subscriptions_stripe_customer_idx
  on public.subscriptions (stripe_customer_id);

-- ===========================================================================
-- 2. SÉCURITÉ (Row Level Security)
--    RLS activée. Un utilisateur connecté ne peut LIRE que sa propre ligne.
--    AUCUNE politique d'écriture : seul le service_role (webhook) écrit, et il
--    contourne la RLS.
-- ===========================================================================
alter table public.subscriptions enable row level security;

-- Lecture réservée au propriétaire de la ligne.
drop policy if exists "subscriptions_select_self" on public.subscriptions;
create policy "subscriptions_select_self"
  on public.subscriptions for select
  to authenticated
  using (user_id = auth.uid());

-- NOTE : volontairement PAS de politique insert/update/delete pour anon ni
-- authenticated. Le webhook Stripe écrit avec la clé service_role, qui
-- contourne la RLS. Le client web ne peut donc jamais fausser son abonnement.

-- Fin du script. ✅ La table d'abonnement est prête ; le webhook Stripe peut
-- désormais y écrire et le front lire l'état « Pro » de chaque utilisateur.
