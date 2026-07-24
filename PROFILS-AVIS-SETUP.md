# Profils publics & avis clients — mise en route

Cette brique ajoute deux choses au site :

- **Fiches pro publiques** — chaque professionnel a une page publique
  `pro/index.html?id=<identifiant>` qui affiche son nom, son métier, sa ville,
  sa présentation et son site. Depuis l'annuaire (`recherche/index.html?type=artisans`),
  le lien **« Voir le profil »** d'un pro réel pointe vers cette fiche.
- **Avis clients** — les utilisateurs connectés peuvent laisser un avis (note de
  1 à 5 étoiles + commentaire) sur la fiche d'un pro. La note moyenne et la liste
  des avis sont **publiques**.

## 1. Exécuter le script SQL (une seule fois)

Dans **Supabase → ton projet → SQL Editor → New query → Run**, colle et exécute :

```
supabase/schema-avis.sql
```

Le script est **idempotent** : tu peux le relancer sans risque. Il crée la table
`public.avis` et ses règles de sécurité (RLS).

> Les **profils** (`public.profiles`) sont déjà créés par `supabase/schema.sql`
> et sont en **lecture publique** : aucune étape supplémentaire n'est nécessaire
> pour afficher les fiches pro.

## 2. Règles des avis (sécurité RLS)

- **Lecture publique** : tout le monde (même non connecté) voit les avis.
- **Écriture réservée à l'auteur** : un utilisateur connecté ne peut créer /
  modifier / supprimer que **son propre** avis. Il est **impossible** d'écrire
  un avis au nom de quelqu'un d'autre.
- **Un seul avis par couple (auteur, cible)** : contrainte `unique (cible,
  auteur)`. Laisser un nouvel avis **met à jour** l'avis existant (upsert).
- **Pas d'auto-avis** : on ne peut pas se noter soi-même (`auteur <> cible`),
  côté serveur (RLS) comme côté client.

## 3. Dégradation gracieuse

Tant que le script SQL n'est pas exécuté (ou si la connexion Supabase est
absente / l'utilisateur n'est pas connecté) :

- la fiche pro reste **fonctionnelle** : elle affiche les informations du profil
  et « Aucun avis pour le moment » ;
- le formulaire d'avis n'apparaît que pour un utilisateur **connecté** consultant
  la fiche d'un **autre** pro (jamais sur sa propre fiche) ;
- si le profil est introuvable, une page d'invitation claire est affichée
  (retour à l'annuaire) — **jamais** de page cassée.

## 4. Fichiers concernés

- `supabase/schema-avis.sql` — table `avis` + RLS (à exécuter).
- `assets/js/avis.js` — `window.BLAvis` (liste, résumé, mon avis, création,
  suppression).
- `assets/js/db.js` — `BLDB.getProfileById(id)` (lecture publique d'un profil).
- `pro/index.html` — la fiche pro publique.
- `assets/js/recherche.js` — lien « Voir le profil » des pros réels vers la fiche.
