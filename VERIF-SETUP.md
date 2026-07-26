# Vérification d'entreprise (SIRET) — Guide d'activation

Cette fonctionnalité permet à un professionnel de **vérifier son entreprise**
via l'API officielle et gratuite `recherche-entreprises.api.gouv.fr` (annuaire
des entreprises, data.gouv.fr). En cas de succès, un badge
**« ✓ Entreprise vérifiée »** s'affiche sur sa fiche publique et dans les
résultats de recherche — un gage de confiance sur la place de marché.

## 1. Base de données (à faire une fois)

Dans **Supabase → votre projet → SQL Editor → New query → Run**, exécutez le
script :

```
supabase/schema-verif.sql
```

⚠️ À lancer **APRÈS** `supabase/schema.sql` (qui crée la table `profiles`).
Le script est **idempotent** : il ajoute uniquement des colonnes
`if not exists` à la table `profiles` (`siret`, `siret_verifie`,
`denomination`, `verifie_le`).

Aucune modification des politiques de sécurité (RLS) n'est nécessaire : les
règles existantes de `profiles` couvrent déjà ces colonnes (lecture publique,
écriture réservée au propriétaire de la fiche).

## 2. API de vérification (aucune clé requise)

La vérification utilise l'API **publique et gratuite** :

```
https://recherche-entreprises.api.gouv.fr/search?q=<SIREN|SIRET|nom>
```

- Aucune clé, aucun secret, aucune configuration.
- CORS autorisé : l'appel se fait directement depuis le navigateur.
- Limite indicative : ~7 requêtes/seconde (largement suffisant ici).

Le code correspondant est dans `assets/js/verify.js` (`window.BLVerify`).

## 3. Utilisation

1. Le pro se rend dans **Espace client → Mon profil pro**.
2. Il saisit son **SIRET** (14 chiffres) ou son SIREN (9 chiffres) et clique
   sur **« Vérifier mon entreprise »**.
3. Si l'entreprise est trouvée, la dénomination officielle, l'adresse et l'état
   (actif / fermé) s'affichent, et la vérification est **enregistrée**
   automatiquement.
4. Le badge **« ✓ Entreprise vérifiée »** apparaît alors :
   - sur sa **fiche publique** (`pro/`), à côté du nom ;
   - dans les **résultats de recherche** des artisans (`recherche/`).

## 4. Dégradation gracieuse

La fonctionnalité ne casse jamais une page :

- Si `assets/js/verify.js` n'est pas chargé, le champ SIRET reste **masqué**.
- Si l'API est **indisponible** ou l'entreprise **introuvable**, un message
  courtois s'affiche (« Entreprise introuvable ou service indisponible —
  réessayez plus tard ») et **le reste du profil peut être enregistré
  normalement**.
- Si les colonnes SQL n'ont pas encore été ajoutées, la vérification reste
  simplement optionnelle et le badge ne s'affiche pas.

## Fichiers concernés

- `supabase/schema-verif.sql` — colonnes ajoutées à `profiles`.
- `assets/js/verify.js` — appel de l'API officielle (`window.BLVerify`).
- `assets/js/db.js` — persistance des champs SIRET + exposition du drapeau `verifie`.
- `espace/index.html` — champ SIRET + bouton de vérification dans le profil pro.
- `pro/index.html` — badge « ✓ Entreprise vérifiée » sur la fiche publique.
- `assets/js/recherche.js` — pastille « ✓ Vérifié » sur les cartes d'artisans.
