-- ===========================================================================
-- BâtiLink — SCHÉMA COMPLET (installation en une seule fois)
--
-- Exécute ce fichier dans Supabase → SQL Editor → New query → Run.
-- Il regroupe TOUS les schémas de la plateforme, dans le bon ordre, et reste
-- IDEMPOTENT (tu peux le relancer sans risque). Équivaut à exécuter, dans
-- l'ordre : schema.sql, schema-documents.sql, schema-gestion.sql,
-- schema-billing.sql, schema-demandes.sql, schema-messages.sql.
--
-- Storage : pense aussi à créer le bucket PRIVÉ « conformite » (Storage).
-- ===========================================================================


-- ###########################################################################
-- # Bloc : schema.sql
-- ###########################################################################

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


-- ###########################################################################
-- # Bloc : schema-documents.sql
-- ###########################################################################

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


-- ###########################################################################
-- # Bloc : schema-gestion.sql
-- ###########################################################################

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


-- ###########################################################################
-- # Bloc : schema-billing.sql
-- ###########################################################################

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


-- ###########################################################################
-- # Bloc : schema-demandes.sql
-- ###########################################################################

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


-- ###########################################################################
-- # Bloc : schema-messages.sql
-- ###########################################################################

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

