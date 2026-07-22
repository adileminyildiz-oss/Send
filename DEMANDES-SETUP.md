# Demandes de documents — mise en route

La page **/conformite/** n'est plus un coffre-fort où le pro dépose ses pièces.
C'est désormais un espace où l'utilisateur connecté **demande un document au
cabinet** (BâtiLink / AEM-CONSEIL) : il décrit le document dont il a besoin
(attestation de vigilance, modèle de contrat de sous-traitance, modèle de
devis…), le cabinet le prépare puis le lui **envoie**.

## 1. Exécuter le script SQL (une seule fois)

Dans **Supabase → ton projet → SQL Editor → New query → Run**, colle et exécute :

```
supabase/schema-demandes.sql
```

Le script est **idempotent** : tu peux le relancer sans risque. Il crée la table
`public.demandes_documents` et ses règles de sécurité (RLS) : chaque utilisateur
ne voit et ne crée que **ses propres** demandes.

## 2. Le flux : demande → traitement → envoi

1. **Demande** — l'utilisateur remplit le formulaire (type de document, urgence,
   précisions). La demande est enregistrée avec le statut `soumise`. Une
   notification e-mail est aussi envoyée au cabinet via Formspree (voir §4).
2. **Traitement** — le cabinet (AEM-CONSEIL) traite la demande depuis le
   **tableau de bord Supabase** (Table Editor) ou un futur outil d'administration
   en *service role*. Il met à jour :
   - `statut` : `soumise` → `en_traitement` → `envoyee` (ou `refusee`) ;
   - `reponse` : un message affiché à l'utilisateur (facultatif) ;
   - `fichier_path` : le chemin du fichier livré (voir §3).
   > La clé *service_role* contourne la RLS : aucune politique dédiée n'est
   > nécessaire côté cabinet.
3. **Envoi** — dès que `statut = envoyee` et que `fichier_path` est renseigné, un
   bouton **« Télécharger le document »** apparaît côté utilisateur (URL signée
   temporaire de 5 minutes).

## 3. Déposer le fichier livré

Le fichier livré vit dans le **bucket privé `conformite`** (Supabase → Storage),
sous le dossier de l'utilisateur, par exemple :

```
conformite/<user_id>/reponse-<id-demande>.pdf
```

Renseigne ce chemin exact dans la colonne `fichier_path` de la demande. Si le
bucket `conformite` n'existe pas encore, crée un bucket **privé** nommé
`conformite`.

## 4. Notification e-mail (Formspree)

Le formulaire réutilise l'endpoint Formspree existant
(`window.FORMSPREE_ENDPOINT` dans `assets/js/config.js`). Chaque demande envoie
un e-mail au cabinet, **même si la base n'est pas encore configurée**.

## 5. Dégradation gracieuse

Tant que le script SQL n'est pas exécuté (ou si la connexion Supabase est
absente) :

- la page reste **fonctionnelle** : le formulaire notifie le cabinet par e-mail
  et conserve un **repli local** (localStorage) des demandes ;
- la liste « Mes demandes » affiche les demandes locales, sinon un état vide ;
- aucune page n'est jamais cassée.

Une fois le script exécuté et un utilisateur connecté, les demandes sont
enregistrées en base (privées, propriétaire uniquement) et suivies en temps réel.
