-- ---------------------------------------------------------------------------
-- BâtiLink — schéma des ALERTES appels d'offres (Supabase / PostgreSQL)
--
-- À exécuter dans : Supabase → ton projet → SQL Editor → New query → Run.
-- Ce script est IDEMPOTENT : tu peux le relancer sans risque, il ne casse rien
-- et ne duplique rien.
--
-- Il ajoute la table des alertes email sur les appels d'offres publics (BOAMP).
-- Chaque utilisateur connecté peut enregistrer des recherches (mots-clés +
-- département) et recevoir par email les nouveaux avis correspondants.
--
-- Tant que la fonction Edge « alertes-notify » + la clé Resend + le cron ne sont
-- pas configurés (voir ALERTES-SETUP.md), les alertes sont ENREGISTRÉES mais pas
-- encore envoyées par email : le site reste pleinement fonctionnel.
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- 1. TABLE alertes_ao — une alerte = une recherche sauvegardée par un
--    utilisateur (mots-clés + département), avec une fréquence d'envoi.
-- ===========================================================================
create table if not exists public.alertes_ao (
  id                 uuid primary key default gen_random_uuid(),
  owner              uuid not null references auth.users(id) on delete cascade,
  mots_cles          text,                         -- mots-clés de la recherche (#q)
  departement        text,                         -- département filtré (#dept), facultatif
  frequence          text default 'quotidienne',   -- fréquence d'envoi (indicatif)
  actif              boolean default true,         -- alerte active (envoyée) ou en pause
  derniere_execution timestamptz,                  -- dernier passage de la notification
  created_at         timestamptz default now()
);

comment on table public.alertes_ao is 'Alertes email des utilisateurs sur les appels d''offres publics (BOAMP).';
comment on column public.alertes_ao.mots_cles is 'Mots-clés de la recherche BOAMP (champ #q de la page appels-offres).';
comment on column public.alertes_ao.departement is 'Département filtré (champ #dept), facultatif.';
comment on column public.alertes_ao.frequence is 'Fréquence d''envoi souhaitée (quotidienne / hebdomadaire), indicative.';
comment on column public.alertes_ao.actif is 'Alerte active : true = surveillée et envoyée, false = en pause.';
comment on column public.alertes_ao.derniere_execution is 'Horodatage du dernier passage de la fonction de notification.';

-- ===========================================================================
-- 2. SÉCURITÉ (Row Level Security) — chaque utilisateur ne voit et ne gère QUE
--    ses propres alertes (owner = auth.uid()).
-- ===========================================================================
alter table public.alertes_ao enable row level security;

-- Lecture réservée au propriétaire.
drop policy if exists "alertes_ao_select_owner" on public.alertes_ao;
create policy "alertes_ao_select_owner"
  on public.alertes_ao for select
  to authenticated
  using (owner = auth.uid());

-- Création uniquement à son propre nom.
drop policy if exists "alertes_ao_insert_owner" on public.alertes_ao;
create policy "alertes_ao_insert_owner"
  on public.alertes_ao for insert
  to authenticated
  with check (owner = auth.uid());

-- Modification (activer/désactiver…) réservée au propriétaire.
drop policy if exists "alertes_ao_update_owner" on public.alertes_ao;
create policy "alertes_ao_update_owner"
  on public.alertes_ao for update
  to authenticated
  using (owner = auth.uid())
  with check (owner = auth.uid());

-- Suppression réservée au propriétaire.
drop policy if exists "alertes_ao_delete_owner" on public.alertes_ao;
create policy "alertes_ao_delete_owner"
  on public.alertes_ao for delete
  to authenticated
  using (owner = auth.uid());

-- Remarque : la fonction Edge « alertes-notify » utilise la clé service_role,
-- qui contourne la RLS pour lire toutes les alertes actives et mettre à jour
-- derniere_execution. Aucune politique « anon » n'est nécessaire.

-- ===========================================================================
-- 3. INDEX utiles (récupération par propriétaire, filtrage des alertes actives).
-- ===========================================================================
create index if not exists alertes_ao_owner_idx on public.alertes_ao (owner);
create index if not exists alertes_ao_actif_idx on public.alertes_ao (actif);

-- Fin du script. ✅ Les utilisateurs connectés peuvent maintenant enregistrer
-- des alertes appels d'offres depuis la page /appels-offres/.
