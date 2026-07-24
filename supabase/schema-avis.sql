-- ---------------------------------------------------------------------------
-- BâtiLink — AVIS CLIENTS (Supabase / PostgreSQL)
--
-- À exécuter dans : Supabase → ton projet → SQL Editor → New query → Run.
-- Ce script est IDEMPOTENT : tu peux le relancer sans risque, il ne casse rien
-- et ne duplique rien.
--
-- Tant que ce script n'est pas exécuté, le site continue de fonctionner : les
-- fiches pro (pro/index.html) affichent simplement « Aucun avis pour le
-- moment », et le formulaire d'avis retombe sur un état vide. Une fois exécuté,
-- les utilisateurs connectés peuvent laisser un avis (note 1-5 + commentaire)
-- sur la fiche d'un pro, et ces avis sont visibles publiquement.
--
-- RÈGLE D'OR RLS : un avis n'est modifiable / supprimable QUE par son auteur.
-- Personne ne peut écrire un avis au nom de quelqu'un d'autre, et on ne peut
-- pas s'auto-noter (auteur <> cible).
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- 1. TABLE avis — un avis laissé par un utilisateur (auteur) sur un pro (cible).
--    Un seul avis par couple (cible, auteur) : l'auteur peut le mettre à jour.
-- ===========================================================================
create table if not exists public.avis (
  id           uuid primary key default gen_random_uuid(),
  cible        uuid not null references auth.users(id) on delete cascade,  -- le pro noté
  auteur       uuid not null references auth.users(id) on delete cascade,  -- l'auteur de l'avis
  note         int  not null check (note between 1 and 5),
  commentaire  text,
  created_at   timestamptz default now(),
  unique (cible, auteur)   -- un seul avis par (pro, auteur)
);

comment on table public.avis is 'Avis clients publics : un utilisateur (auteur) note un pro (cible). Un seul avis par couple (cible, auteur).';

-- ===========================================================================
-- 2. SÉCURITÉ (Row Level Security)
--    Lecture publique (avis visibles par tous, même anonymes),
--    écriture réservée à l'auteur de l'avis (et jamais sur soi-même).
-- ===========================================================================
alter table public.avis enable row level security;

-- Lecture par tout le monde (avis publics).
drop policy if exists "avis_select_public" on public.avis;
create policy "avis_select_public"
  on public.avis for select
  to anon, authenticated
  using (true);

-- Création : l'auteur est l'utilisateur courant ET on ne se note pas soi-même.
drop policy if exists "avis_insert_auteur" on public.avis;
create policy "avis_insert_auteur"
  on public.avis for insert
  to authenticated
  with check (auteur = auth.uid() and auteur <> cible);

-- Mise à jour : réservée à l'auteur de l'avis.
drop policy if exists "avis_update_auteur" on public.avis;
create policy "avis_update_auteur"
  on public.avis for update
  to authenticated
  using (auteur = auth.uid())
  with check (auteur = auth.uid() and auteur <> cible);

-- Suppression : réservée à l'auteur de l'avis.
drop policy if exists "avis_delete_auteur" on public.avis;
create policy "avis_delete_auteur"
  on public.avis for delete
  to authenticated
  using (auteur = auth.uid());

-- ===========================================================================
-- 3. INDEX utile (récupération des avis d'un pro, tri par date).
-- ===========================================================================
create index if not exists avis_cible_idx on public.avis (cible, created_at desc);

-- Fin du script. ✅ Les avis clients sont prêts : les fiches pro affichent la
-- note moyenne et la liste des avis, et les utilisateurs connectés peuvent en
-- laisser un (un seul par pro, modifiable).
