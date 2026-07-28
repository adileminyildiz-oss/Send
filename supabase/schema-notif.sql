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
