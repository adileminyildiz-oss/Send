-- BâtiLink — SCHÉMA COMPLET (idempotent). Supabase → SQL Editor → Run.
-- Storage : crée aussi le bucket PRIVÉ « conformite ».

-- ########## Bloc : schema.sql ##########

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


-- ########## Bloc : schema-verif.sql ##########

-- ---------------------------------------------------------------------------
-- BâtiLink — Vérification d'entreprise (SIRET) — colonnes additionnelles.
--
-- À exécuter APRÈS supabase/schema.sql (qui crée la table public.profiles).
-- Dans : Supabase → ton projet → SQL Editor → New query → Run.
--
-- Ce script est IDEMPOTENT : tu peux le relancer sans risque. Il n'ajoute que
-- des colonnes « if not exists » à la table profiles existante.
--
-- Aucune modification des politiques RLS n'est nécessaire : les politiques de
-- profiles couvrent déjà ces colonnes (lecture publique ; écriture réservée au
-- propriétaire de la fiche via profiles_update_self / profiles_insert_self).
--
-- Tant que ce script n'est pas exécuté, le site continue de fonctionner : la
-- vérification d'entreprise reste simplement masquée / optionnelle.
-- ---------------------------------------------------------------------------

-- Numéro SIRET (14 chiffres) saisi par le pro. Facultatif.
alter table public.profiles add column if not exists siret text;

-- Vrai lorsque l'entreprise a été vérifiée avec succès via l'API officielle
-- « recherche-entreprises » (annuaire des entreprises, données publiques).
alter table public.profiles add column if not exists siret_verifie boolean default false;

-- Dénomination officielle de l'entreprise, telle que renvoyée par l'API.
alter table public.profiles add column if not exists denomination text;

-- Date/heure de la dernière vérification réussie.
alter table public.profiles add column if not exists verifie_le timestamptz;

comment on column public.profiles.siret         is 'Numéro SIRET (14 chiffres) de l''entreprise du pro.';
comment on column public.profiles.siret_verifie is 'Entreprise vérifiée via l''API officielle recherche-entreprises.';
comment on column public.profiles.denomination  is 'Dénomination officielle renvoyée par l''API (annuaire des entreprises).';
comment on column public.profiles.verifie_le    is 'Horodatage de la dernière vérification réussie.';

-- Fin du script. ✅ Les fiches pros peuvent désormais porter un badge
-- « ✓ Entreprise vérifiée ».


-- ########## Bloc : schema-documents.sql ##########

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


-- ########## Bloc : schema-gestion.sql ##########

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


-- ########## Bloc : schema-billing.sql ##########

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


-- ########## Bloc : schema-demandes.sql ##########

-- ---------------------------------------------------------------------------
-- BâtiLink — MODULE DEMANDES DE DOCUMENTS
-- (Supabase / PostgreSQL)
--
-- À exécuter dans : Supabase → ton projet → SQL Editor → New query → Run.
-- Ce script est IDEMPOTENT : tu peux le relancer sans risque, il ne casse rien
-- et ne duplique rien.
--
-- CONCEPT — l'utilisateur connecté DEMANDE un document AU cabinet (BâtiLink /
-- AEM-CONSEIL). Il ne dépose pas ses propres pièces : il décrit le document
-- dont il a besoin (attestation de vigilance, modèle de contrat de
-- sous-traitance, modèle de devis…), le cabinet reçoit la demande, la traite,
-- puis lui ENVOIE le document.
--
-- FLUX : soumise → en_traitement → envoyee (ou refusee).
-- Le cabinet (AEM-CONSEIL) traite les demandes et met à jour statut / reponse /
-- fichier_path depuis le tableau de bord Supabase ou un futur outil
-- d'administration en « service role » (qui contourne la RLS). Le fichier
-- livré est déposé dans le bucket privé « conformite » existant, sous le
-- dossier de l'utilisateur (ex. <user_id>/reponse-<id>.pdf), et l'utilisateur
-- le télécharge via une URL signée temporaire.
--
-- Tant que ce script n'est pas exécuté, la page conformite/index.html reste
-- fonctionnelle mais dégradée : le formulaire notifie quand même le cabinet
-- par e-mail (Formspree) et conserve un repli local ; la liste « Mes demandes »
-- reste vide (BLDemandes renvoie []).
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- 1. TABLE demandes_documents — une demande de document par ligne.
-- ===========================================================================
create table if not exists public.demandes_documents (
  id            uuid primary key default gen_random_uuid(),
  owner         uuid references auth.users(id) on delete cascade,  -- demandeur (propriétaire)
  type_document text not null,                    -- type de document demandé
  precisions    text,                             -- précisions libres du demandeur
  urgence       text default 'normale',           -- 'normale' | 'urgente'
  statut        text default 'soumise'            -- suivi du traitement par le cabinet
    check (statut in ('soumise', 'en_traitement', 'envoyee', 'refusee')),
  reponse       text,                             -- message / réponse du cabinet
  fichier_path  text,                             -- chemin du fichier livré dans le bucket 'conformite'
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

comment on table public.demandes_documents is
  'Demandes de documents adressées par l''utilisateur au cabinet AEM-CONSEIL. Le cabinet traite chaque demande et met à jour statut/reponse/fichier_path via le tableau de bord (service role, contourne la RLS). Le fichier livré vit dans le bucket privé « conformite » sous le dossier de l''utilisateur.';

-- ===========================================================================
-- 2. SÉCURITÉ (Row Level Security) — le demandeur ne voit que SES demandes.
--
-- Le propriétaire peut LIRE et CRÉER ses propres demandes. Il peut aussi les
-- METTRE À JOUR (ce qui, côté page, sert uniquement à annuler sa demande) et
-- les SUPPRIMER. Le cabinet (AEM-CONSEIL) met à jour statut / reponse /
-- fichier_path en « service role » depuis le back-office : la clé service_role
-- contourne la RLS, aucune politique dédiée n'est donc nécessaire pour lui.
-- ===========================================================================
alter table public.demandes_documents enable row level security;

-- --- Lecture : propriétaire uniquement --------------------------------------
drop policy if exists "demandes_select_owner" on public.demandes_documents;
create policy "demandes_select_owner"
  on public.demandes_documents for select
  to authenticated
  using (owner = auth.uid());

-- --- Insertion : le propriétaire crée sa propre demande ---------------------
drop policy if exists "demandes_insert_owner" on public.demandes_documents;
create policy "demandes_insert_owner"
  on public.demandes_documents for insert
  to authenticated
  with check (owner = auth.uid());

-- --- Mise à jour : propriétaire uniquement (sert à annuler sa demande) -------
drop policy if exists "demandes_update_owner" on public.demandes_documents;
create policy "demandes_update_owner"
  on public.demandes_documents for update
  to authenticated
  using (owner = auth.uid())
  with check (owner = auth.uid());

-- --- Suppression : le propriétaire peut supprimer sa propre demande ----------
drop policy if exists "demandes_delete_owner" on public.demandes_documents;
create policy "demandes_delete_owner"
  on public.demandes_documents for delete
  to authenticated
  using (owner = auth.uid());

-- ===========================================================================
-- 3. INDEX utiles (liste par propriétaire, tri par date récente).
-- ===========================================================================
create index if not exists demandes_owner_idx      on public.demandes_documents (owner);
create index if not exists demandes_created_at_idx  on public.demandes_documents (created_at desc);

-- Fin du script. ✅ Le module « Demandes de documents » est maintenant actif :
-- les demandes sont enregistrées par utilisateur (privées, propriétaire
-- uniquement) et le cabinet les traite depuis le tableau de bord Supabase.


-- ########## Bloc : schema-messages.sql ##########

-- ---------------------------------------------------------------------------
-- BâtiLink — MESSAGERIE INTERNE (Supabase / PostgreSQL)
--
-- À exécuter dans : Supabase → ton projet → SQL Editor → New query → Run.
-- Ce script est IDEMPOTENT : tu peux le relancer sans risque, il ne casse rien
-- et ne duplique rien.
--
-- Tant que ce script n'est pas exécuté, le site continue de fonctionner : la
-- page messages/index.html affiche simplement un état vide, et le bouton
-- « Contacter » retombe sur l'invitation à se connecter. Une fois exécuté, les
-- utilisateurs connectés peuvent échanger des messages SANS s'exposer leur
-- téléphone ni leur email : tout passe par la messagerie interne.
--
-- OBJECTIF DE CONFIDENTIALITÉ : la messagerie permet de discuter à propos d'un
-- chantier sans jamais dévoiler les coordonnées personnelles.
--
-- RÈGLE D'OR RLS : un utilisateur ne doit JAMAIS pouvoir lire une conversation
-- ou un message dont il n'est pas participant. Les politiques ci-dessous sont
-- écrites en conséquence (sous-requêtes EXISTS pour les messages).
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- 1. TABLE conversations — un fil de discussion entre DEUX utilisateurs, lié
--    (facultativement) à un chantier.
--
--    ORDRE CANONIQUE DES PARTICIPANTS : pour éviter les doublons (A→B et B→A),
--    l'application DOIT toujours ranger les deux identifiants dans un ordre
--    stable avant l'insert : participant_a = min(uuid1, uuid2) et
--    participant_b = max(uuid1, uuid2) (comparaison lexicographique des UUID,
--    cf. BLMsg.canonPair dans assets/js/messagerie.js). L'index unique
--    (chantier_id, participant_a, participant_b) garantit alors l'unicité d'un
--    fil par paire + chantier.
-- ===========================================================================
create table if not exists public.conversations (
  id              uuid primary key default gen_random_uuid(),
  chantier_id     uuid references public.chantiers(id) on delete set null,
  participant_a   uuid not null references auth.users(id) on delete cascade,  -- min(uuid)
  participant_b   uuid not null references auth.users(id) on delete cascade,  -- max(uuid)
  sujet           text,
  created_at      timestamptz default now(),
  last_message_at timestamptz default now()
);

comment on table public.conversations is 'Fils de discussion (messagerie interne) entre deux utilisateurs, liés à un chantier. Participants rangés dans un ordre canonique (a=min, b=max).';

-- Unicité : un seul fil par (chantier + paire canonique de participants).
-- NB : lorsque chantier_id est NULL, PostgreSQL considère les NULL comme
-- distincts, donc plusieurs fils « sans chantier » pourraient coexister ;
-- l'application privilégie de toujours réutiliser un fil existant via BLMsg.
create unique index if not exists conversations_unique_pair_chantier
  on public.conversations (chantier_id, participant_a, participant_b);

-- ===========================================================================
-- 2. TABLE messages — un message appartenant à une conversation.
-- ===========================================================================
create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender          uuid not null references auth.users(id) on delete cascade,
  contenu         text not null,
  lu              boolean default false,   -- lu par le destinataire ?
  created_at      timestamptz default now()
);

comment on table public.messages is 'Messages de la messagerie interne. lu = true quand le destinataire a lu le message.';

-- ===========================================================================
-- 3. SÉCURITÉ (Row Level Security)
--    Un utilisateur n'accède qu'aux conversations dont il est participant,
--    et qu'aux messages de ces conversations.
-- ===========================================================================
alter table public.conversations enable row level security;
alter table public.messages      enable row level security;

-- --- Politiques conversations ------------------------------------------------
-- Lecture : uniquement si l'utilisateur est l'un des deux participants.
drop policy if exists "conversations_select_participant" on public.conversations;
create policy "conversations_select_participant"
  on public.conversations for select
  to authenticated
  using (auth.uid() in (participant_a, participant_b));

-- Création : l'utilisateur doit être l'un des deux participants du fil créé.
drop policy if exists "conversations_insert_participant" on public.conversations;
create policy "conversations_insert_participant"
  on public.conversations for insert
  to authenticated
  with check (auth.uid() in (participant_a, participant_b));

-- Mise à jour (last_message_at, sujet) : réservée aux participants.
drop policy if exists "conversations_update_participant" on public.conversations;
create policy "conversations_update_participant"
  on public.conversations for update
  to authenticated
  using (auth.uid() in (participant_a, participant_b))
  with check (auth.uid() in (participant_a, participant_b));

-- --- Politiques messages -----------------------------------------------------
-- Lecture : uniquement si la conversation du message a l'utilisateur pour
-- participant (sous-requête EXISTS — jamais de fuite hors des fils de l'user).
drop policy if exists "messages_select_participant" on public.messages;
create policy "messages_select_participant"
  on public.messages for select
  to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and auth.uid() in (c.participant_a, c.participant_b)
    )
  );

-- Insertion : l'expéditeur est l'utilisateur courant ET il est participant de
-- la conversation ciblée.
drop policy if exists "messages_insert_sender" on public.messages;
create policy "messages_insert_sender"
  on public.messages for insert
  to authenticated
  with check (
    sender = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and auth.uid() in (c.participant_a, c.participant_b)
    )
  );

-- Mise à jour : sert UNIQUEMENT au destinataire à marquer un message comme lu
-- (lu = true). L'utilisateur doit être participant du fil ET ne pas être
-- l'expéditeur (on ne marque « lu » que les messages reçus).
drop policy if exists "messages_update_recipient_read" on public.messages;
create policy "messages_update_recipient_read"
  on public.messages for update
  to authenticated
  using (
    auth.uid() <> sender
    and exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and auth.uid() in (c.participant_a, c.participant_b)
    )
  )
  with check (
    auth.uid() <> sender
    and exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and auth.uid() in (c.participant_a, c.participant_b)
    )
  );

-- ===========================================================================
-- 4. INDEX utiles (liste des messages d'un fil, fils d'un utilisateur, tri).
-- ===========================================================================
create index if not exists messages_conversation_idx
  on public.messages (conversation_id, created_at);
create index if not exists conversations_participant_a_idx
  on public.conversations (participant_a);
create index if not exists conversations_participant_b_idx
  on public.conversations (participant_b);
create index if not exists conversations_last_message_idx
  on public.conversations (last_message_at desc);

-- ===========================================================================
-- 5. REALTIME (facultatif, pour les messages en direct).
--    Pour recevoir les nouveaux messages en temps réel (sans rafraîchir la
--    page), active la réplication Realtime sur la table `messages` :
--      Supabase → Database → Replication → publication supabase_realtime →
--      ajoute la table public.messages.
--    L'application fonctionne aussi SANS Realtime (rafraîchissement manuel /
--    à l'ouverture d'une conversation).
--
--    Décommente la ligne ci-dessous pour activer la publication par SQL :
--    alter publication supabase_realtime add table public.messages;
-- ===========================================================================

-- Fin du script. ✅ La messagerie interne est prête : les utilisateurs peuvent
-- se contacter à propos d'un chantier sans dévoiler leurs coordonnées.


-- ########## Bloc : schema-notif.sql ##########

-- ---------------------------------------------------------------------------
-- BâtiLink — NOTIFICATIONS EMAIL DES MESSAGES (Supabase / PostgreSQL)
--
-- À exécuter dans : Supabase → ton projet → SQL Editor → New query → Run.
--
-- ⚠️ ORDRE : ce script s'exécute APRÈS `schema-messages.sql` (il ajoute une
-- colonne à la table public.messages créée par ce dernier). Si tu relances
-- l'ensemble des schémas, garde cet ordre : messages d'abord, notif ensuite.
--
-- Ce script est IDEMPOTENT : tu peux le relancer sans risque.
--
-- RÔLE : ajouter le suivi « ce message a-t-il déjà déclenché un email de
-- notification à son destinataire ? ». La fonction Edge `notify-messages`
-- (planifiée) lit les messages non lus et non encore notifiés, envoie un email
-- récapitulatif au destinataire, puis passe ces messages à notifie = true.
--
-- CONFIDENTIALITÉ : la colonne ne stocke qu'un booléen ; aucun contenu de
-- message n'est copié ni exposé. Les emails de notification ne contiennent pas
-- le corps des messages (cf. fonction notify-messages).
--
-- DÉGRADATION GRACIEUSE : tant que la fonction Edge n'est pas déployée / que la
-- clé Resend n'est pas configurée, cette colonne reste simplement à false pour
-- tous les messages et n'a aucun effet sur la messagerie.
-- ---------------------------------------------------------------------------

-- Colonne de suivi de notification (false = pas encore notifié par email).
alter table public.messages
  add column if not exists notifie boolean default false;

comment on column public.messages.notifie is
  'true quand le destinataire a reçu un email de notification pour ce message (fonction Edge notify-messages). Aucun contenu de message n''est copié : simple drapeau anti-doublon.';

-- Index PARTIEL sur les messages restant à notifier : la fonction planifiée
-- ne s'intéresse qu'à notifie = false, cet index garde son balayage rapide même
-- quand la table grossit (les messages déjà notifiés n'y figurent pas).
create index if not exists messages_notifie_idx
  on public.messages (notifie)
  where notifie = false;

-- Fin du script. ✅ Le suivi des notifications email est prêt.


-- ########## Bloc : schema-candidatures.sql ##########

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


-- ########## Bloc : schema-avis.sql ##########

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


-- ########## Bloc : schema-alertes.sql ##########

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


-- ########## Bloc : schema-situations.sql ##########

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


-- ########## Bloc : schema-dc4.sql ##########

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


-- ########## Bloc : schema-prix.sql ##########

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

