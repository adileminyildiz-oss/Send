# Bibliothèque de prix — mise en service

La bibliothèque de prix fonctionne **sans configuration** : le catalogue
(`assets/js/prix-data.js`, ~90 ouvrages) est statique et disponible tout de suite,
dans la page `bibliotheque/` et via le bouton **« 📚 Bibliothèque de prix »** du
générateur de devis (`devis/`).

## Prix indicatifs
Les prix unitaires HT sont des **moyennes indicatives 2026**. Le prix réel dépend
du chantier, des matériaux et de la région. À ajuster dans chaque devis.

## Lignes personnalisées (optionnel)
Pour que chaque pro enregistre ses **propres ouvrages/prix** :
1. Exécute `supabase/schema-prix.sql` (déjà inclus dans `schema-all.sql`).
2. Une fois connecté, les lignes perso apparaissent dans le sélecteur, en plus du
   catalogue.

Tant que le schéma n'est pas exécuté, seul le catalogue statique est proposé — le
reste fonctionne normalement.
