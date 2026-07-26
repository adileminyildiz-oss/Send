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
