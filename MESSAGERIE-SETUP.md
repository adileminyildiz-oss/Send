# Messagerie interne BâtiLink — mise en route

La messagerie permet à deux utilisateurs connectés d'échanger à propos d'un
chantier **sans se dévoiler leur téléphone ni leur email**. Tout passe par la
base Supabase, avec une sécurité stricte (RLS).

## 1. Exécuter le schéma SQL (une seule fois)

Dans **Supabase → votre projet → SQL Editor → New query → Run**, exécutez :

```
supabase/schema-messages.sql
```

Le script est **idempotent** : vous pouvez le relancer sans risque. Il crée deux
tables (`conversations`, `messages`), leurs index, et active la sécurité au
niveau ligne (RLS).

> Prérequis : le schéma principal `supabase/schema.sql` doit déjà avoir été
> exécuté (la table `chantiers` est référencée par les conversations).

## 2. (Facultatif) Activer le temps réel

Pour recevoir les nouveaux messages **en direct** (sans rafraîchir la page) :

**Supabase → Database → Replication → publication `supabase_realtime`** →
ajoutez la table **`public.messages`**.

Ou en SQL (ligne fournie en commentaire à la fin du script) :

```sql
alter publication supabase_realtime add table public.messages;
```

Sans cette étape, la messagerie fonctionne quand même : les messages
apparaissent à l'ouverture d'une conversation et après chaque envoi.

## 3. Comment ça marche

- Une **conversation** relie **deux participants** et (facultativement) **un
  chantier**. Les deux identifiants sont rangés dans un **ordre canonique**
  (`participant_a` = plus petit UUID, `participant_b` = plus grand) pour éviter
  les doublons A→B / B→A. C'est l'application (`BLMsg.canonPair`) qui garantit
  cet ordre ; un index unique `(chantier_id, participant_a, participant_b)`
  verrouille l'unicité.
- Chaque **message** appartient à une conversation, porte un `sender` et un
  indicateur `lu`. Le destinataire (jamais l'expéditeur) peut passer un message
  à `lu = true`.
- Depuis la recherche, le bouton **« Contacter »** d'un chantier ou d'un artisan
  **réel** ouvre `messages/index.html?to=<propriétaire>&chantier=<id>`, qui
  démarre (ou rouvre) le fil correspondant.
- L'**espace client** affiche une carte « Messagerie » avec le nombre de
  messages non lus.

## 4. Sécurité (RLS)

Les politiques garantissent qu'un utilisateur **ne peut lire que les
conversations et messages dont il est participant** (sous-requêtes `EXISTS` sur
`conversations` pour les messages). Un tiers ne peut jamais lire un fil qui ne
le concerne pas. L'insertion d'un message exige `sender = auth.uid()` **et**
d'être participant de la conversation ciblée.

## 5. Dégradation gracieuse

Rien ne casse si la messagerie n'est pas configurée :

- Clés Supabase absentes → la page `messages/index.html` affiche « Messagerie à
  configurer ».
- Utilisateur non connecté → invitation à se connecter.
- Tables absentes ou base injoignable → état vide, aucun plantage.
- Realtime indisponible → rafraîchissement manuel, l'envoi/réception reste
  fonctionnel.

Le libellé de l'interlocuteur est volontairement neutre (« Contact » + 4
caractères de son identifiant) : **aucune coordonnée personnelle n'est
exposée**.
