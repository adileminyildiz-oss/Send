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
