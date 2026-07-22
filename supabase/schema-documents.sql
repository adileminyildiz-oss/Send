-- ---------------------------------------------------------------------------
-- BâtiLink — DEVIS & FACTURES (Supabase / PostgreSQL)
--
-- À exécuter dans : Supabase → ton projet → SQL Editor → New query → Run.
-- Ce script est IDEMPOTENT : tu peux le relancer sans risque.
--
-- Tant que ce script n'est pas exécuté, le générateur de devis
-- (devis/index.html) continue de fonctionner localement (aucun enregistrement).
-- Une fois exécuté, les devis et factures sont enregistrés par utilisateur,
-- numérotés séquentiellement, et listés dans l'espace client.
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- 1. TABLE documents — un devis ou une facture appartenant à un utilisateur.
-- ===========================================================================
create table if not exists public.documents (
  id             uuid primary key default gen_random_uuid(),
  owner          uuid references auth.users(id) on delete cascade,  -- propriétaire
  type           text default 'devis' check (type in ('devis','facture')),
  numero         text,              -- ex. DEV-2026-0007 / FAC-2026-0007
  client_nom     text,
  client_adresse text,
  client_email   text,
  objet          text,              -- objet / intitulé du document
  lignes         jsonb default '[]',-- lignes d'ouvrage (désignation, qté, unité, pu…)
  tva_taux       numeric default 20,
  total_ht       numeric,
  total_tva      numeric,
  total_ttc      numeric,
  statut         text default 'brouillon',   -- brouillon/envoyé/accepté/facturé/payé
  notes          text,              -- mentions / conditions
  date_emission  date,
  date_echeance  date,              -- échéance (facture) ou fin de validité (devis)
  devis_source   uuid,              -- si facture : id du devis d'origine
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

comment on table public.documents is 'Devis et factures des utilisateurs (privés, propriétaire uniquement).';

-- ===========================================================================
-- 2. TABLE doc_counters — compteur séquentiel par utilisateur / année / type.
--    Sert à attribuer un numéro continu (obligation légale des factures).
-- ===========================================================================
create table if not exists public.doc_counters (
  owner   uuid not null references auth.users(id) on delete cascade,
  annee   int  not null,
  type    text not null,
  dernier int  default 0,
  primary key (owner, annee, type)
);

comment on table public.doc_counters is 'Compteurs de numérotation séquentielle des documents (par utilisateur, année et type).';

-- ===========================================================================
-- 3. SÉCURITÉ (Row Level Security) — accès RÉSERVÉ au propriétaire.
-- ===========================================================================
alter table public.documents    enable row level security;
alter table public.doc_counters enable row level security;

-- --- Politiques documents : propriétaire uniquement (select/insert/update/delete)
drop policy if exists "documents_select_owner" on public.documents;
create policy "documents_select_owner"
  on public.documents for select
  to authenticated
  using (owner = auth.uid());

drop policy if exists "documents_insert_owner" on public.documents;
create policy "documents_insert_owner"
  on public.documents for insert
  to authenticated
  with check (owner = auth.uid());

drop policy if exists "documents_update_owner" on public.documents;
create policy "documents_update_owner"
  on public.documents for update
  to authenticated
  using (owner = auth.uid())
  with check (owner = auth.uid());

drop policy if exists "documents_delete_owner" on public.documents;
create policy "documents_delete_owner"
  on public.documents for delete
  to authenticated
  using (owner = auth.uid());

-- --- Politiques doc_counters : propriétaire uniquement -----------------------
drop policy if exists "doc_counters_select_owner" on public.doc_counters;
create policy "doc_counters_select_owner"
  on public.doc_counters for select
  to authenticated
  using (owner = auth.uid());

drop policy if exists "doc_counters_insert_owner" on public.doc_counters;
create policy "doc_counters_insert_owner"
  on public.doc_counters for insert
  to authenticated
  with check (owner = auth.uid());

drop policy if exists "doc_counters_update_owner" on public.doc_counters;
create policy "doc_counters_update_owner"
  on public.doc_counters for update
  to authenticated
  using (owner = auth.uid())
  with check (owner = auth.uid());

-- ===========================================================================
-- 4. FONCTION next_doc_number — attribue atomiquement le prochain numéro.
--    SECURITY DEFINER : incrémente le compteur de l'utilisateur courant pour
--    l'année en cours et le type demandé, puis renvoie 'DEV-2026-0007' /
--    'FAC-2026-0007'. La ligne de compteur est créée si elle manque.
-- ===========================================================================
drop function if exists public.next_doc_number(text);
create function public.next_doc_number(p_type text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner   uuid := auth.uid();
  v_annee   int  := extract(year from now())::int;
  v_type    text := coalesce(p_type, 'devis');
  v_num     int;
  v_prefixe text;
begin
  if v_owner is null then
    raise exception 'Utilisateur non authentifié';
  end if;
  if v_type not in ('devis','facture') then
    v_type := 'devis';
  end if;

  -- Incrément atomique (crée la ligne au premier appel).
  insert into public.doc_counters (owner, annee, type, dernier)
  values (v_owner, v_annee, v_type, 1)
  on conflict (owner, annee, type)
  do update set dernier = public.doc_counters.dernier + 1
  returning dernier into v_num;

  v_prefixe := case when v_type = 'facture' then 'FAC' else 'DEV' end;
  return v_prefixe || '-' || v_annee::text || '-' || lpad(v_num::text, 4, '0');
end;
$$;

grant execute on function public.next_doc_number(text) to authenticated;

-- ===========================================================================
-- 5. INDEX utiles (liste par propriétaire, tri par date).
-- ===========================================================================
create index if not exists documents_owner_idx      on public.documents (owner);
create index if not exists documents_created_at_idx  on public.documents (created_at desc);
create index if not exists documents_type_idx        on public.documents (type);

-- Fin du script. ✅ Les devis et factures sont maintenant enregistrés,
-- numérotés séquentiellement et listés dans l'espace client.
