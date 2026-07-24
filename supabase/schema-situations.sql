-- ---------------------------------------------------------------------------
-- BâtiLink — SITUATIONS DE TRAVAUX (facturation par avancement) — Supabase / PostgreSQL
--
-- À exécuter dans : Supabase → ton projet → SQL Editor → New query → Run.
-- Ce script est IDEMPOTENT : tu peux le relancer sans risque.
--
-- Tant que ce script n'est pas exécuté, le générateur de situations
-- (situations/index.html) continue de fonctionner localement comme un simple
-- calculateur (aucun enregistrement). Une fois exécuté, les situations de
-- travaux sont enregistrées par utilisateur, numérotées séquentiellement
-- (SIT-2026-0001) et rechargeables via ?id=<uuid>.
--
-- CONCEPT — une « situation de travaux » facture l'AVANCEMENT d'un marché :
--   pour chaque ligne, montant dû = marché × (% cumulé actuel) − cumul déjà
--   facturé. On applique la TVA, puis on retranche la retenue de garantie
--   (5 % par défaut) pour obtenir le NET À PAYER.
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- 1. TABLE situations — une situation de travaux appartenant à un utilisateur.
-- ===========================================================================
create table if not exists public.situations (
  id                    uuid primary key default gen_random_uuid(),
  owner                 uuid references auth.users(id) on delete cascade,  -- propriétaire
  numero                text,              -- ex. SIT-2026-0001
  chantier              text,              -- nom / référence du chantier
  client_nom            text,
  client_adresse        text,
  objet                 text,              -- objet / intitulé de la situation
  montant_marche        numeric,           -- montant global du marché (indicatif)
  lignes                jsonb default '[]', -- lignes (désignation, marché, % cumul, cumul précédent…)
  tva_taux              numeric default 20,
  retenue_garantie_taux numeric default 5, -- retenue de garantie (%), 5 % par défaut
  cumul_precedent       numeric default 0, -- cumul HT facturé lors des situations précédentes (global)
  avancement_pct        numeric,           -- avancement global cumulé (%) — indicatif
  total_ht              numeric,           -- montant HT de la présente situation
  total_ttc             numeric,
  net_a_payer           numeric,           -- TTC − retenue de garantie
  statut                text default 'brouillon',  -- brouillon/envoyée/payée
  date_situation        date,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

comment on table public.situations is 'Situations de travaux (facturation par avancement) des utilisateurs — privées, propriétaire uniquement.';

-- ===========================================================================
-- 2. TABLE situation_counters — compteur séquentiel par utilisateur / année.
--    Sert à attribuer un numéro continu (SIT-2026-0001, SIT-2026-0002…).
-- ===========================================================================
create table if not exists public.situation_counters (
  owner   uuid not null references auth.users(id) on delete cascade,
  annee   int  not null,
  dernier int  default 0,
  primary key (owner, annee)
);

comment on table public.situation_counters is 'Compteurs de numérotation séquentielle des situations de travaux (par utilisateur et année).';

-- ===========================================================================
-- 3. SÉCURITÉ (Row Level Security) — accès RÉSERVÉ au propriétaire.
-- ===========================================================================
alter table public.situations         enable row level security;
alter table public.situation_counters enable row level security;

-- --- Politiques situations : propriétaire uniquement (select/insert/update/delete)
drop policy if exists "situations_select_owner" on public.situations;
create policy "situations_select_owner"
  on public.situations for select
  to authenticated
  using (owner = auth.uid());

drop policy if exists "situations_insert_owner" on public.situations;
create policy "situations_insert_owner"
  on public.situations for insert
  to authenticated
  with check (owner = auth.uid());

drop policy if exists "situations_update_owner" on public.situations;
create policy "situations_update_owner"
  on public.situations for update
  to authenticated
  using (owner = auth.uid())
  with check (owner = auth.uid());

drop policy if exists "situations_delete_owner" on public.situations;
create policy "situations_delete_owner"
  on public.situations for delete
  to authenticated
  using (owner = auth.uid());

-- --- Politiques situation_counters : propriétaire uniquement ------------------
drop policy if exists "situation_counters_select_owner" on public.situation_counters;
create policy "situation_counters_select_owner"
  on public.situation_counters for select
  to authenticated
  using (owner = auth.uid());

drop policy if exists "situation_counters_insert_owner" on public.situation_counters;
create policy "situation_counters_insert_owner"
  on public.situation_counters for insert
  to authenticated
  with check (owner = auth.uid());

drop policy if exists "situation_counters_update_owner" on public.situation_counters;
create policy "situation_counters_update_owner"
  on public.situation_counters for update
  to authenticated
  using (owner = auth.uid())
  with check (owner = auth.uid());

-- ===========================================================================
-- 4. FONCTION next_situation_number — attribue atomiquement le prochain numéro.
--    SECURITY DEFINER : incrémente le compteur de l'utilisateur courant pour
--    l'année en cours, puis renvoie 'SIT-2026-0001'. La ligne de compteur est
--    créée si elle manque.
-- ===========================================================================
drop function if exists public.next_situation_number();
create function public.next_situation_number()
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
  insert into public.situation_counters (owner, annee, dernier)
  values (v_owner, v_annee, 1)
  on conflict (owner, annee)
  do update set dernier = public.situation_counters.dernier + 1
  returning dernier into v_num;

  return 'SIT-' || v_annee::text || '-' || lpad(v_num::text, 4, '0');
end;
$$;

grant execute on function public.next_situation_number() to authenticated;

-- ===========================================================================
-- 5. INDEX utiles (liste par propriétaire, tri par date).
-- ===========================================================================
create index if not exists situations_owner_idx      on public.situations (owner);
create index if not exists situations_created_at_idx on public.situations (created_at desc);

-- Fin du script. ✅ Les situations de travaux sont maintenant enregistrées,
-- numérotées séquentiellement et rechargeables (?id=<uuid>).
