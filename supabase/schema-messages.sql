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
