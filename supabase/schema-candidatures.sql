-- ---------------------------------------------------------------------------
-- BâtiLink — CANDIDATURES (réponses des artisans à un chantier) + LEADS PLAFONNÉS
--
-- À exécuter dans : Supabase → ton projet → SQL Editor → New query → Run.
-- Ce script est IDEMPOTENT : tu peux le relancer sans risque, il ne casse rien
-- et ne duplique rien.
--
-- Tant que ce script n'est pas exécuté, le site continue de fonctionner : la
-- page chantier/index.html affiche simplement le chantier, et l'action
-- « Postuler » retombe gracieusement (formulaire indisponible / message clair).
-- Une fois exécuté, un artisan connecté peut RÉPONDRE à un chantier, et le
-- propriétaire du chantier voit les candidatures reçues.
--
-- CONCEPT « LEADS PLAFONNÉS » : un chantier = un lead. Pour ne pas revendre le
-- même lead à tout le monde, le NOMBRE de candidatures par chantier est PLAFONNÉ
-- (5 par défaut). Une fois le plafond atteint, le chantier est « complet » et
-- n'accepte plus de nouvelle candidature (contrôlé côté base par un trigger, donc
-- infalsifiable depuis le navigateur).
--
-- RÈGLE D'OR RLS : un artisan ne doit JAMAIS pouvoir lire les candidatures des
-- AUTRES artisans. Seul le PROPRIÉTAIRE du chantier voit toutes les candidatures
-- reçues ; chaque artisan ne voit que les siennes.
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- 0. PLAFOND DE CANDIDATURES (leads plafonnés).
--    Défini comme une fonction immuable pour pouvoir l'ajuster à un seul endroit
--    (le trigger et l'application s'y réfèrent implicitement via la valeur 5).
-- ===========================================================================
create or replace function public.bl_candidatures_cap()
returns int
language sql
immutable
as $$ select 5 $$;

comment on function public.bl_candidatures_cap() is 'Plafond de candidatures par chantier (leads plafonnés). Par défaut : 5.';

-- ===========================================================================
-- 1. TABLE candidatures — une réponse d'un artisan à un chantier.
--    unique(chantier_id, artisan) : un artisan ne candidate qu'une seule fois
--    par chantier.
-- ===========================================================================
create table if not exists public.candidatures (
  id          uuid primary key default gen_random_uuid(),
  chantier_id uuid not null references public.chantiers(id) on delete cascade,
  artisan     uuid not null references auth.users(id) on delete cascade,
  message     text,                       -- message de motivation de l'artisan
  statut      text default 'envoyee' check (statut in ('envoyee','acceptee','refusee')),
  created_at  timestamptz default now(),
  unique (chantier_id, artisan)
);

comment on table public.candidatures is 'Candidatures (réponses) des artisans à un chantier. Plafonnées à 5 par chantier (leads plafonnés). statut : envoyee / acceptee / refusee.';

-- ===========================================================================
-- 2. LEADS PLAFONNÉS — trigger BEFORE INSERT qui refuse une candidature de trop.
--    SECURITY DEFINER : la fonction compte TOUTES les candidatures du chantier,
--    y compris celles des autres artisans (que l'appelant ne peut pas lire via
--    RLS), afin d'appliquer le plafond de façon fiable côté serveur.
-- ===========================================================================
create or replace function public.bl_enforce_candidature_cap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  nb  int;
  cap int := public.bl_candidatures_cap();
begin
  select count(*) into nb
  from public.candidatures
  where chantier_id = new.chantier_id;

  if nb >= cap then
    raise exception 'Chantier complet : le nombre maximal de candidatures (%) est atteint pour ce chantier.', cap
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

comment on function public.bl_enforce_candidature_cap() is 'Applique le plafond de candidatures par chantier (leads plafonnés) avant chaque insertion.';

drop trigger if exists trg_candidatures_cap on public.candidatures;
create trigger trg_candidatures_cap
  before insert on public.candidatures
  for each row execute function public.bl_enforce_candidature_cap();

-- ===========================================================================
-- 3. SÉCURITÉ (Row Level Security)
--    - Le PROPRIÉTAIRE du chantier lit toutes les candidatures de ses chantiers.
--    - L'ARTISAN lit uniquement ses propres candidatures.
--    - INSERT : l'artisan candidate en son nom, et ne peut PAS candidater à son
--      propre chantier.
--    - UPDATE (statut) : réservé au propriétaire du chantier (accepter/refuser).
-- ===========================================================================
alter table public.candidatures enable row level security;

-- --- Lecture : propriétaire du chantier ------------------------------------
-- Le propriétaire voit toutes les candidatures reçues sur SES chantiers.
drop policy if exists "candidatures_select_owner" on public.candidatures;
create policy "candidatures_select_owner"
  on public.candidatures for select
  to authenticated
  using (
    exists (
      select 1 from public.chantiers c
      where c.id = candidatures.chantier_id
        and c.owner = auth.uid()
    )
  );

-- --- Lecture : l'artisan voit les siennes ----------------------------------
drop policy if exists "candidatures_select_self" on public.candidatures;
create policy "candidatures_select_self"
  on public.candidatures for select
  to authenticated
  using (artisan = auth.uid());

-- --- Insertion : l'artisan candidate en son nom, jamais à son propre chantier
drop policy if exists "candidatures_insert_artisan" on public.candidatures;
create policy "candidatures_insert_artisan"
  on public.candidatures for insert
  to authenticated
  with check (
    artisan = auth.uid()
    and not exists (
      select 1 from public.chantiers c
      where c.id = candidatures.chantier_id
        and c.owner = auth.uid()
    )
  );

-- --- Mise à jour du statut : réservée au propriétaire du chantier ----------
-- (accepter / refuser une candidature reçue).
drop policy if exists "candidatures_update_owner" on public.candidatures;
create policy "candidatures_update_owner"
  on public.candidatures for update
  to authenticated
  using (
    exists (
      select 1 from public.chantiers c
      where c.id = candidatures.chantier_id
        and c.owner = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.chantiers c
      where c.id = candidatures.chantier_id
        and c.owner = auth.uid()
    )
  );

-- ===========================================================================
-- 4. COMPTAGE PUBLIC (pour l'affichage « X/5 places »).
--    Un artisan ne voit que SES candidatures via RLS ; il ne peut donc pas
--    compter directement combien de places restent. Cette fonction SECURITY
--    DEFINER renvoie le nombre total de candidatures d'un chantier SANS exposer
--    la moindre ligne (aucune donnée personnelle), afin d'afficher le plafond.
-- ===========================================================================
create or replace function public.bl_candidature_count(p_chantier uuid)
returns int
language sql
security definer
set search_path = public
stable
as $$
  select count(*)::int from public.candidatures where chantier_id = p_chantier;
$$;

comment on function public.bl_candidature_count(uuid) is 'Nombre total de candidatures d''un chantier (leads plafonnés), sans exposer les lignes. Utilisé pour afficher « X/5 places ».';

grant execute on function public.bl_candidature_count(uuid) to anon, authenticated;

-- ===========================================================================
-- 5. INDEX utiles (comptage par chantier, candidatures d'un artisan).
-- ===========================================================================
create index if not exists candidatures_chantier_idx on public.candidatures (chantier_id);
create index if not exists candidatures_artisan_idx   on public.candidatures (artisan);

-- Fin du script. ✅ Les artisans peuvent désormais RÉPONDRE à un chantier, dans
-- la limite de 5 candidatures par chantier (leads plafonnés). Le propriétaire du
-- chantier voit et gère (accepter / refuser) les candidatures reçues.
