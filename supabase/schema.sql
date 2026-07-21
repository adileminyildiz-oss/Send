-- ---------------------------------------------------------------------------
-- BâtiLink — schéma de la place de marché (Supabase / PostgreSQL)
--
-- À exécuter dans : Supabase → ton projet → SQL Editor → New query → Run.
-- Ce script est IDEMPOTENT : tu peux le relancer sans risque, il ne casse rien
-- et ne duplique rien.
--
-- Tant que ce script n'est pas exécuté, le site continue de fonctionner avec
-- les données d'exemple (assets/js/data.js). Une fois exécuté, les chantiers
-- déposés et les profils pro deviennent réels et visibles par tout le monde.
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- 1. TABLE profiles — fiche publique d'un pro (artisan / sous-traitant) ou
--    d'un donneur d'ordre. Une ligne par utilisateur (clé = id de auth.users).
-- ===========================================================================
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        text default 'artisan' check (role in ('artisan','donneur','sous-traitant')),
  nom         text,              -- nom de l'entreprise ou du pro
  metier      text,              -- métier principal
  ville       text,
  code_postal text,
  telephone   text,
  email       text,
  bio         text,              -- présentation / description de l'activité
  site        text,              -- site web éventuel
  note        int,               -- note moyenne (0-5), facultative
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

comment on table public.profiles is 'Fiches publiques des pros (annuaire) et donneurs d''ordre.';

-- ===========================================================================
-- 2. TABLE chantiers — projets de travaux déposés par les utilisateurs.
-- ===========================================================================
create table if not exists public.chantiers (
  id            uuid primary key default gen_random_uuid(),
  owner         uuid references auth.users(id) on delete cascade,
  titre         text not null,
  metier        text,
  ville         text,
  code_postal   text,
  budget        text,
  delai         text,
  description   text,
  contact_nom   text,
  contact_tel   text,
  contact_email text,
  statut        text default 'ouvert',   -- ouvert / clos
  created_at    timestamptz default now()
);

comment on table public.chantiers is 'Chantiers (projets de travaux) publiés sur la place de marché.';

-- ===========================================================================
-- 3. SÉCURITÉ (Row Level Security)
--    Lecture publique (annuaire + annonces visibles par tous, même anonymes),
--    écriture réservée au propriétaire de la ligne.
-- ===========================================================================
alter table public.profiles  enable row level security;
alter table public.chantiers enable row level security;

-- --- Politiques profiles -----------------------------------------------------
-- Lecture par tout le monde (annuaire public).
drop policy if exists "profiles_select_public" on public.profiles;
create policy "profiles_select_public"
  on public.profiles for select
  to anon, authenticated
  using (true);

-- Chacun ne peut créer/modifier/supprimer QUE sa propre fiche.
drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "profiles_delete_self" on public.profiles;
create policy "profiles_delete_self"
  on public.profiles for delete
  to authenticated
  using (id = auth.uid());

-- --- Politiques chantiers ----------------------------------------------------
-- Lecture par tout le monde (annonces publiques).
drop policy if exists "chantiers_select_public" on public.chantiers;
create policy "chantiers_select_public"
  on public.chantiers for select
  to anon, authenticated
  using (true);

-- Un utilisateur connecté ne peut créer un chantier qu'à son propre nom.
drop policy if exists "chantiers_insert_owner" on public.chantiers;
create policy "chantiers_insert_owner"
  on public.chantiers for insert
  to authenticated
  with check (owner = auth.uid());

-- Modification / suppression réservées au propriétaire.
drop policy if exists "chantiers_update_owner" on public.chantiers;
create policy "chantiers_update_owner"
  on public.chantiers for update
  to authenticated
  using (owner = auth.uid())
  with check (owner = auth.uid());

drop policy if exists "chantiers_delete_owner" on public.chantiers;
create policy "chantiers_delete_owner"
  on public.chantiers for delete
  to authenticated
  using (owner = auth.uid());

-- ===========================================================================
-- 4. INDEX utiles (tri par date, filtres par ville / métier).
-- ===========================================================================
create index if not exists chantiers_created_at_idx on public.chantiers (created_at desc);
create index if not exists chantiers_ville_idx       on public.chantiers (ville);
create index if not exists chantiers_metier_idx      on public.chantiers (metier);
create index if not exists profiles_role_idx         on public.profiles (role);
create index if not exists profiles_ville_idx        on public.profiles (ville);

-- Fin du script. ✅ Tu peux maintenant déposer des chantiers réels et créer
-- des profils pro depuis le site.
