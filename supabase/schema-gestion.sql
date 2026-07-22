-- ---------------------------------------------------------------------------
-- BâtiLink — MODULE GESTION : SUIVI CLIENT (CRM) & SUIVI DES DÉPENSES
-- (Supabase / PostgreSQL)
--
-- À exécuter dans : Supabase → ton projet → SQL Editor → New query → Run.
-- Ce script est IDEMPOTENT : tu peux le relancer sans risque, il ne casse rien
-- et ne duplique rien.
--
-- Tant que ce script n'est pas exécuté, la page gestion/index.html reste
-- fonctionnelle mais affiche des états vides (BLGestion renvoie []/zéros).
-- Une fois exécuté, les clients et les dépenses sont enregistrés par
-- utilisateur (privés, propriétaire uniquement) et alimentent le tableau de
-- bord de marge (CA encaissé − dépenses).
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- 1. TABLE clients — fiche client / prospect appartenant à un utilisateur (CRM).
-- ===========================================================================
create table if not exists public.clients (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid references auth.users(id) on delete cascade,  -- propriétaire
  nom         text not null,        -- nom du client / de l'entreprise
  contact_nom text,                 -- personne à contacter
  email       text,
  telephone   text,
  adresse     text,
  ville       text,
  code_postal text,
  notes       text,                 -- notes libres de suivi
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

comment on table public.clients is 'Fiches clients / prospects du suivi commercial (privées, propriétaire uniquement).';

-- ===========================================================================
-- 2. TABLE depenses — dépense / achat appartenant à un utilisateur.
-- ===========================================================================
create table if not exists public.depenses (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid references auth.users(id) on delete cascade,  -- propriétaire
  libelle     text not null,        -- intitulé de la dépense
  categorie   text,                 -- Matériaux, Sous-traitance, Véhicule…
  fournisseur text,
  montant_ht  numeric,
  tva_taux    numeric default 20,
  montant_ttc numeric,              -- calculé si absent : ht * (1 + tva/100)
  date_depense date,
  chantier    text,                 -- chantier / affaire rattaché(e)
  notes       text,
  created_at  timestamptz default now()
);

comment on table public.depenses is 'Dépenses et achats du suivi de trésorerie (privés, propriétaire uniquement).';

-- ===========================================================================
-- 3. SÉCURITÉ (Row Level Security) — accès RÉSERVÉ au propriétaire.
-- ===========================================================================
alter table public.clients  enable row level security;
alter table public.depenses enable row level security;

-- --- Politiques clients : propriétaire uniquement (select/insert/update/delete)
drop policy if exists "clients_select_owner" on public.clients;
create policy "clients_select_owner"
  on public.clients for select
  to authenticated
  using (owner = auth.uid());

drop policy if exists "clients_insert_owner" on public.clients;
create policy "clients_insert_owner"
  on public.clients for insert
  to authenticated
  with check (owner = auth.uid());

drop policy if exists "clients_update_owner" on public.clients;
create policy "clients_update_owner"
  on public.clients for update
  to authenticated
  using (owner = auth.uid())
  with check (owner = auth.uid());

drop policy if exists "clients_delete_owner" on public.clients;
create policy "clients_delete_owner"
  on public.clients for delete
  to authenticated
  using (owner = auth.uid());

-- --- Politiques depenses : propriétaire uniquement ---------------------------
drop policy if exists "depenses_select_owner" on public.depenses;
create policy "depenses_select_owner"
  on public.depenses for select
  to authenticated
  using (owner = auth.uid());

drop policy if exists "depenses_insert_owner" on public.depenses;
create policy "depenses_insert_owner"
  on public.depenses for insert
  to authenticated
  with check (owner = auth.uid());

drop policy if exists "depenses_update_owner" on public.depenses;
create policy "depenses_update_owner"
  on public.depenses for update
  to authenticated
  using (owner = auth.uid())
  with check (owner = auth.uid());

drop policy if exists "depenses_delete_owner" on public.depenses;
create policy "depenses_delete_owner"
  on public.depenses for delete
  to authenticated
  using (owner = auth.uid());

-- ===========================================================================
-- 4. INDEX utiles (liste par propriétaire, tri par date).
-- ===========================================================================
create index if not exists clients_owner_idx       on public.clients (owner);
create index if not exists clients_created_at_idx   on public.clients (created_at desc);
create index if not exists depenses_owner_idx       on public.depenses (owner);
create index if not exists depenses_date_idx        on public.depenses (date_depense desc);

-- Fin du script. ✅ Le module Gestion (clients & dépenses) est maintenant actif :
-- les fiches et dépenses sont enregistrées par utilisateur et le tableau de
-- bord de marge se calcule à partir des factures payées et des dépenses TTC.
