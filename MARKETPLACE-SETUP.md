# BâtiLink — Activer la place de marché réelle

Par défaut, le site fonctionne avec des **données d'exemple** (fichier
`assets/js/data.js`). Pour passer à une vraie place de marché — où les chantiers
déposés et les profils pro sont enregistrés et visibles par tous — il suffit de
créer deux tables dans Supabase. **Tant que ce n'est pas fait, rien ne casse :**
le site continue d'afficher les exemples et enregistre localement.

## 1. Exécuter le script SQL

1. Ouvrez [Supabase](https://supabase.com) → votre projet.
2. Menu de gauche → **SQL Editor** → **New query**.
3. Copiez-collez tout le contenu de [`supabase/schema.sql`](supabase/schema.sql).
4. Cliquez sur **Run**.

Le script est **idempotent** : vous pouvez le relancer autant de fois que
nécessaire, il ne duplique rien et ne supprime aucune donnée existante.

## 2. Ce que créent les deux tables

| Table | Rôle |
|-------|------|
| `public.profiles` | Fiches publiques des pros (annuaire artisans / sous-traitants) et donneurs d'ordre. Une ligne par utilisateur, liée à son compte. |
| `public.chantiers` | Projets de travaux publiés depuis la page **Déposer un chantier**, visibles dans la **Recherche**. |

**Sécurité (Row Level Security)** — activée automatiquement par le script :

- **Lecture publique** : tout le monde (même non connecté) peut consulter
  l'annuaire et les chantiers.
- **Écriture protégée** : chacun ne peut créer / modifier / supprimer **que ses
  propres** chantiers et sa propre fiche profil (`auth.uid()`).

La clé `anon` publique de `assets/js/config.js` est faite pour être exposée ; la
vraie protection vient de ces règles RLS.

## 3. Vérifier

Une fois le script exécuté :

- **Déposer un chantier** (connecté) → le chantier apparaît immédiatement dans
  **Recherche → Chantiers**, marqué d'une pastille « Réel ».
- **Espace client → Mon profil pro** → l'enregistrement est synchronisé en base
  et alimente l'**Annuaire des artisans**.
- **Espace client → Mes chantiers déposés** → liste vos chantiers réels.

## 4. Comportement en mode dégradé

Le site ne dépend jamais entièrement de la base. Il retombe proprement sur les
exemples / le stockage local dans tous ces cas :

- script SQL pas encore exécuté (tables absentes) ;
- utilisateur non connecté ;
- Supabase hors ligne ou clés manquantes dans `assets/js/config.js`.

Aucune page ne reste blanche ou cassée : les appels à la base sont tous protégés
(voir `assets/js/db.js`, `window.BLDB`).

## 5. Option — stockage des documents de conformité

Indépendant de la place de marché : la page **Conformité** utilise un bucket
Supabase Storage privé nommé `conformite`. Créez-le dans **Supabase → Storage**
pour activer l'envoi réel des pièces (sinon elles restent locales). Voir le
message affiché sur la page.
