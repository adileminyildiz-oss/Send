# Candidatures & leads plafonnés — activation

Ce module ajoute à BâtiLink :

1. une **page détail de chantier** (`chantier/index.html?id=<uuid>`) ;
2. un système de **candidatures** : un artisan répond à un chantier (message + suivi de statut) ;
3. des **leads plafonnés** : un chantier n'accepte qu'un nombre limité de candidatures (5 par défaut), pour ne jamais revendre le même lead à tout le monde.

Tant que le script SQL n'est pas exécuté, **le site continue de fonctionner** : la page chantier affiche l'annonce, et l'action « Postuler » retombe gracieusement (message clair, aucun écran cassé).

---

## 1. Exécuter le script SQL

Dans **Supabase → votre projet → SQL Editor → New query**, collez et exécutez le contenu de :

```
supabase/schema-candidatures.sql
```

Le script est **idempotent** : vous pouvez le relancer sans risque. Il crée :

- la table `public.candidatures` ;
- le **trigger de plafond** (leads plafonnés) ;
- les **politiques RLS** ;
- la fonction de **comptage public** `bl_candidature_count`.

> Prérequis : les tables `public.chantiers` et `public.profiles` doivent déjà exister (script `supabase/schema.sql`). La messagerie interne (`supabase/schema-messages.sql`) est recommandée pour le bouton « Contacter », mais pas obligatoire.

---

## 2. La table `candidatures`

| Colonne | Rôle |
|---|---|
| `id` | identifiant (uuid) |
| `chantier_id` | chantier concerné (→ `chantiers.id`, supprimé en cascade) |
| `artisan` | artisan qui postule (→ `auth.users.id`) |
| `message` | message de motivation (facultatif) |
| `statut` | `envoyee` (défaut), `acceptee`, `refusee` |
| `created_at` | date de la candidature |

Contrainte `unique(chantier_id, artisan)` : **un artisan ne peut candidater qu'une seule fois** par chantier.

---

## 3. Leads plafonnés (plafond de 5)

Un chantier = un lead. Pour préserver la valeur d'une mise en relation, **le nombre de candidatures par chantier est plafonné à 5**.

- Le plafond est défini par la fonction `public.bl_candidatures_cap()` (renvoie `5`). Pour le changer, modifiez la valeur retournée et relancez le script.
- Il est **réellement appliqué côté base** par un **trigger `BEFORE INSERT`** (`bl_enforce_candidature_cap`, en `SECURITY DEFINER`) : au-delà du plafond, l'insertion est refusée avec une exception. Impossible donc de contourner la limite depuis le navigateur.
- Côté interface, la page chantier affiche une jauge **« X/5 places »** et bascule en état **« Complet »** une fois le plafond atteint.

La fonction `bl_candidature_count(chantier_id)` (SECURITY DEFINER, exposée à `anon`/`authenticated`) renvoie **uniquement le nombre** de candidatures d'un chantier, sans exposer la moindre ligne : elle sert à afficher les places restantes même à un visiteur qui n'a pas le droit de lire les candidatures.

---

## 4. Sécurité (RLS) — qui voit quoi

La règle d'or : **un artisan ne lit jamais les candidatures des autres artisans.**

| Action | Autorisé pour |
|---|---|
| **Lire** une candidature | le **propriétaire du chantier** (toutes celles de ses chantiers) **ou** l'**artisan** auteur (les siennes uniquement) |
| **Créer** une candidature | un utilisateur connecté, **en son propre nom** (`artisan = auth.uid()`), et **pas sur son propre chantier** |
| **Modifier** le statut (accepter / refuser) | le **propriétaire du chantier** uniquement |

Le comptage pour l'affichage passe par la fonction `SECURITY DEFINER` afin de rester exact sans lever le voile RLS sur les lignes.

---

## 5. Ce que ça change dans le site

- **`chantier/index.html?id=<uuid>`** : nouvelle page détail. Selon le visiteur :
  - **déconnecté** → invitation à se connecter pour postuler ;
  - **artisan** → formulaire de candidature (ou état « déjà candidaté » / « complet ») + bouton **Contacter** (messagerie interne) ;
  - **propriétaire** → liste des candidatures reçues, avec **Accepter / Refuser** et **Contacter**.
- **`recherche/index.html`** : les cartes de chantiers/sous-traitance **réels** pointent désormais vers cette page détail (« Voir / postuler »). Les annonces d'exemple sont inchangées.
- **`espace/index.html`** : nouveau panneau **« Mes candidatures »** (chantier, statut, date, lien vers le chantier).

---

## 6. Dégradation gracieuse

- **Supabase non configuré** (clés absentes dans `assets/js/config.js`) → la page chantier affiche « Chantiers en ligne non activés » et renvoie vers les exemples.
- **Table `candidatures` absente** (script non exécuté) → la fiche du chantier s'affiche normalement ; les candidatures retombent sur des états neutres (aucune erreur visible).
- **Chantier introuvable / id manquant** → écran « Chantier introuvable ».

Aucune de ces situations ne casse une page : tout le code JavaScript (`window.BLCand` dans `assets/js/candidatures.js`) est défensif et ne « throw » jamais.
