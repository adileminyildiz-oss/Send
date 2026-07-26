-- ---------------------------------------------------------------------------
-- BâtiLink — DC4 : DÉCLARATION DE SOUS-TRAITANCE (Supabase / PostgreSQL)
--
-- Le DC4 (« acte spécial de sous-traitance ») identifie, pour un marché :
-- le maître d'ouvrage, le titulaire (entreprise principale), le sous-traitant,
-- la nature et le prix des prestations sous-traitées, et les modalités de
-- paiement. C'est un document courant du BTP.
--
-- À exécuter dans : Supabase → ton projet → SQL Editor → New query → Run.
-- Ce script est IDEMPOTENT : tu peux le relancer sans risque.
--
-- Tant que ce script n'est pas exécuté, le générateur DC4 (dc4/index.html)
-- continue de fonctionner localement (formulaire + impression, sans
-- enregistrement). Une fois exécuté, les DC4 sont enregistrés par utilisateur
-- et numérotés séquentiellement.
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- 1. TABLE dc4 — une déclaration de sous-traitance appartenant à un utilisateur.
-- ===========================================================================
create table if not exists public.dc4 (
  id                  uuid primary key default gen_random_uuid(),
  owner               uuid references auth.users(id) on delete cascade,  -- propriétaire
  numero              text,          -- ex. DC4-2026-0001
  marche_objet        text,          -- objet du marché
  maitre_ouvrage      text,          -- nom du maître d'ouvrage
  mo_adresse          text,          -- adresse du maître d'ouvrage
  titulaire_nom       text,          -- entreprise principale (titulaire du marché)
  titulaire_siret     text,
  titulaire_adresse   text,
  soustraitant_nom    text,          -- entreprise sous-traitante
  st_siret            text,
  st_adresse          text,
  nature_prestations  text,          -- nature des prestations sous-traitées
  montant_ht          numeric,       -- montant HT sous-traité
  tva_taux            numeric default 20,
  montant_ttc         numeric,       -- montant TTC (calculé si absent)
  modalites_paiement  text,          -- modalités de paiement du sous-traitant
  statut              text default 'brouillon',   -- brouillon / finalisé
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

comment on table public.dc4 is 'Déclarations de sous-traitance (DC4) des utilisateurs (privées, propriétaire uniquement).';

-- ===========================================================================
-- 2. TABLE dc4_counters — compteur séquentiel par utilisateur / année.
--    Sert à attribuer un numéro continu (DC4-2026-0001, …).
-- ===========================================================================
create table if not exists public.dc4_counters (
  owner   uuid not null references auth.users(id) on delete cascade,
  annee   int  not null,
  dernier int  default 0,
  primary key (owner, annee)
);

comment on table public.dc4_counters is 'Compteurs de numérotation séquentielle des DC4 (par utilisateur et année).';

-- ===========================================================================
-- 3. SÉCURITÉ (Row Level Security) — accès RÉSERVÉ au propriétaire.
-- ===========================================================================
alter table public.dc4          enable row level security;
alter table public.dc4_counters enable row level security;

-- --- Politiques dc4 : propriétaire uniquement (select/insert/update/delete) ---
drop policy if exists "dc4_select_owner" on public.dc4;
create policy "dc4_select_owner"
  on public.dc4 for select
  to authenticated
  using (owner = auth.uid());

drop policy if exists "dc4_insert_owner" on public.dc4;
create policy "dc4_insert_owner"
  on public.dc4 for insert
  to authenticated
  with check (owner = auth.uid());

drop policy if exists "dc4_update_owner" on public.dc4;
create policy "dc4_update_owner"
  on public.dc4 for update
  to authenticated
  using (owner = auth.uid())
  with check (owner = auth.uid());

drop policy if exists "dc4_delete_owner" on public.dc4;
create policy "dc4_delete_owner"
  on public.dc4 for delete
  to authenticated
  using (owner = auth.uid());

-- --- Politiques dc4_counters : propriétaire uniquement -----------------------
drop policy if exists "dc4_counters_select_owner" on public.dc4_counters;
create policy "dc4_counters_select_owner"
  on public.dc4_counters for select
  to authenticated
  using (owner = auth.uid());

drop policy if exists "dc4_counters_insert_owner" on public.dc4_counters;
create policy "dc4_counters_insert_owner"
  on public.dc4_counters for insert
  to authenticated
  with check (owner = auth.uid());

drop policy if exists "dc4_counters_update_owner" on public.dc4_counters;
create policy "dc4_counters_update_owner"
  on public.dc4_counters for update
  to authenticated
  using (owner = auth.uid())
  with check (owner = auth.uid());

-- ===========================================================================
-- 4. FONCTION next_dc4_number — attribue atomiquement le prochain numéro.
--    SECURITY DEFINER : incrémente le compteur de l'utilisateur courant pour
--    l'année en cours, puis renvoie 'DC4-2026-0001'. La ligne de compteur est
--    créée si elle manque.
-- ===========================================================================
drop function if exists public.next_dc4_number();
create function public.next_dc4_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid := auth.uid();
  v_annee int  := extract(year from now())::int;
  v_num   int;
begin
  if v_owner is null then
    raise exception 'Utilisateur non authentifié';
  end if;

  -- Incrément atomique (crée la ligne au premier appel).
  insert into public.dc4_counters (owner, annee, dernier)
  values (v_owner, v_annee, 1)
  on conflict (owner, annee)
  do update set dernier = public.dc4_counters.dernier + 1
  returning dernier into v_num;

  return 'DC4-' || v_annee::text || '-' || lpad(v_num::text, 4, '0');
end;
$$;

grant execute on function public.next_dc4_number() to authenticated;

-- ===========================================================================
-- 5. INDEX utiles (liste par propriétaire, tri par date).
-- ===========================================================================
create index if not exists dc4_owner_idx      on public.dc4 (owner);
create index if not exists dc4_created_at_idx  on public.dc4 (created_at desc);

-- Fin du script. ✅ Les DC4 sont maintenant enregistrés et numérotés
-- séquentiellement par utilisateur.
