-- ---------------------------------------------------------------------------
-- BâtiLink — Bibliothèque de prix : lignes PERSONNALISÉES de l'utilisateur.
--
-- À exécuter dans : Supabase → ton projet → SQL Editor → New query → Run.
-- Ce script est IDEMPOTENT : tu peux le relancer sans risque.
--
-- Le CATALOGUE de prix est statique (assets/js/prix-data.js) et fonctionne
-- SANS base de données, hors-ligne. Cette table sert uniquement à mémoriser
-- les prix PERSO de chaque utilisateur connecté (son propre bordereau).
-- Chaque ligne est PRIVÉE à son propriétaire (RLS : owner = auth.uid()).
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- 1. TABLE prix_perso — une ligne = un ouvrage / prix enregistré par un pro.
-- ===========================================================================
create table if not exists public.prix_perso (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null references auth.users(id) on delete cascade,
  metier      text,                    -- métier / famille (facultatif)
  designation text not null,           -- désignation de l'ouvrage
  unite       text,                    -- u / m² / ml / ens / h / forfait
  pu          numeric,                 -- prix unitaire HT indicatif
  created_at  timestamptz default now()
);

comment on table public.prix_perso is
  'Lignes de prix personnalisées (bordereau privé) de chaque utilisateur BâtiLink.';

-- ===========================================================================
-- 2. SÉCURITÉ (Row Level Security) — accès réservé au propriétaire.
--    Contrairement aux chantiers/profils (publics), un bordereau de prix est
--    PRIVÉ : personne d'autre que son auteur ne peut le lire ou l'écrire.
-- ===========================================================================
alter table public.prix_perso enable row level security;

-- Lecture : uniquement ses propres lignes.
drop policy if exists "prix_perso_select_owner" on public.prix_perso;
create policy "prix_perso_select_owner"
  on public.prix_perso for select
  to authenticated
  using (owner = auth.uid());

-- Création : uniquement à son propre nom.
drop policy if exists "prix_perso_insert_owner" on public.prix_perso;
create policy "prix_perso_insert_owner"
  on public.prix_perso for insert
  to authenticated
  with check (owner = auth.uid());

-- Modification : uniquement ses propres lignes.
drop policy if exists "prix_perso_update_owner" on public.prix_perso;
create policy "prix_perso_update_owner"
  on public.prix_perso for update
  to authenticated
  using (owner = auth.uid())
  with check (owner = auth.uid());

-- Suppression : uniquement ses propres lignes.
drop policy if exists "prix_perso_delete_owner" on public.prix_perso;
create policy "prix_perso_delete_owner"
  on public.prix_perso for delete
  to authenticated
  using (owner = auth.uid());

-- ===========================================================================
-- 3. INDEX utile (récupération des lignes d'un utilisateur, plus récentes d'abord).
-- ===========================================================================
create index if not exists prix_perso_owner_idx
  on public.prix_perso (owner, created_at desc);

-- Fin du script. ✅ Les utilisateurs connectés peuvent désormais enregistrer
-- leurs propres lignes de prix (le catalogue statique fonctionne sans cela).
