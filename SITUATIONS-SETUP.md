# Situations de travaux — installation & fonctionnement

Ce module ajoute à BâtiLink un générateur de **situations de travaux**
(facturation par avancement, un classique du BTP). Il fonctionne comme le
générateur de devis : une page autonome, imprimable en PDF, qui se branche
sur Supabase pour l'enregistrement lorsque l'utilisateur est connecté.

Fichiers ajoutés :

- `supabase/schema-situations.sql` — tables, sécurité (RLS) et numérotation.
- `assets/js/situations.js` — couche d'accès `window.BLSituations`.
- `situations/index.html` — la page (calculateur + aperçu imprimable).
- `SITUATIONS-SETUP.md` — ce document.

---

## 1. Qu'est-ce qu'une situation de travaux ?

Sur un marché de travaux, on ne facture pas tout d'un coup : on facture
**l'avancement** à intervalles réguliers (souvent mensuels). Chaque facture
intermédiaire est une **situation de travaux**.

Le principe, poste par poste :

- on connaît le **montant du marché** de chaque poste (HT) ;
- on constate le **pourcentage d'avancement cumulé** atteint à ce jour ;
- on connaît le **pourcentage déjà facturé** lors des situations précédentes.

Le montant dû au titre de la **présente situation** vaut donc :

```
montant présente situation = montant du marché × (avancement actuel − avancement précédent)
```

En bas de document, on applique la **TVA**, puis on retranche la
**retenue de garantie** (5 % par défaut, retenue sur le montant HT de la
situation) pour obtenir le **NET À PAYER** :

```
Total HT   = Σ (montants des présentes situations, poste par poste)
TVA        = Total HT × taux de TVA
Total TTC  = Total HT + TVA
Retenue    = Total HT × taux de retenue de garantie
Net à payer = Total TTC − Retenue
```

La retenue de garantie est libérable à l'expiration du délai de garantie
(généralement un an) ou remplaçable par une caution bancaire
(loi n° 71-584 du 16 juillet 1971).

---

## 2. Installation de la base (Supabase)

1. Ouvrez votre projet Supabase → **SQL Editor** → **New query**.
2. Copiez-collez le contenu de `supabase/schema-situations.sql`.
3. Cliquez sur **Run**.

Le script est **idempotent** : vous pouvez le relancer sans risque. Il crée :

- la table `public.situations` (une situation par ligne, privée à son
  propriétaire) ;
- la table `public.situation_counters` (compteur de numérotation par
  utilisateur et par année) ;
- les politiques **RLS** « propriétaire uniquement » sur les deux tables ;
- la fonction `public.next_situation_number()` (`SECURITY DEFINER`) qui
  attribue atomiquement le prochain numéro.

> Les clés Supabase sont lues depuis `assets/js/config.js`
> (`window.SUPABASE_URL` / `window.SUPABASE_ANON_KEY`), comme pour le reste
> du site. Aucune configuration supplémentaire n'est nécessaire.

---

## 3. Numérotation

Le premier enregistrement d'une situation déclenche l'appel à
`next_situation_number()`, qui renvoie un numéro séquentiel de la forme :

```
SIT-2026-0001
SIT-2026-0002
…
```

Le compteur est **par utilisateur et par année** : il repart à `0001` au
changement d'année. Le numéro attribué s'affiche dans le champ
« Numéro attribué » et sur l'aperçu imprimable. Une situation rechargée
conserve son numéro (les enregistrements suivants ne le réattribuent pas).

---

## 4. Dégradation gracieuse

La page est conçue pour **fonctionner sans compte et sans base** :

- **Déconnecté ou base absente** → la page est un **calculateur autonome** :
  lignes, avancement, TVA, retenue de garantie, totaux et net à payer se
  calculent en direct, et le document reste **imprimable / exportable en PDF**
  (bouton « Imprimer / Télécharger en PDF »).
- **Connecté + base présente** → apparaissent en plus le sélecteur de statut
  (brouillon / envoyée / payée) et le bouton **« Enregistrer la situation »**.
  Une situation enregistrée est rechargeable via l'URL `?id=<uuid>`.

`assets/js/situations.js` (`window.BLSituations`) suit la même philosophie que
`assets/js/db.js` et `assets/js/docs.js` : si supabase-js n'est pas chargé, si
les clés manquent, si l'utilisateur n'est pas connecté ou si les tables
n'existent pas encore, chaque méthode renvoie `[]` / `null` / `false` **sans
jamais lever d'exception**. Le calculateur reste donc toujours utilisable.

---

## 5. Mentions légales — à compléter

L'aperçu reprend l'approche du générateur de devis : le bloc **Émetteur**
comporte des marqueurs `.tofill` pour le **SIREN** et le **numéro de TVA
intracommunautaire**, qui doivent être remplacés par les **identifiants réels
de l'entreprise** avant tout envoi à un client.

De même, le texte des **mentions légales** (retenue de garantie, délais de
paiement, pénalités de retard, indemnité forfaitaire de recouvrement de 40 €…)
est pré-rempli **à titre indicatif** et modifiable : adaptez-le à votre marché,
à votre CCAP et à votre situation fiscale réelle. Une situation de travaux
destinée à un client est une pièce comptable : les identifiants d'entreprise
et les mentions obligatoires doivent y figurer correctement.
