// ---------------------------------------------------------------------------
// BâtiLink — window.BLAvis : avis clients publics (Supabase).
//
// Couche défensive au-dessus de window.BLDB (client Supabase partagé). Comme le
// reste du site, elle « dégrade gracieusement » : si la librairie supabase-js
// n'est pas chargée, si les clés manquent, ou si la table `avis` n'existe pas
// encore, chaque méthode renvoie une valeur vide plutôt que de « throw ».
//
// Table : public.avis (id, cible, auteur, note 1-5, commentaire, created_at),
// unique(cible, auteur) — cf. supabase/schema-avis.sql.
//
// RÈGLE : on ne peut créer/modifier QUE son propre avis (RLS côté serveur ;
// createReview renseigne toujours auteur = utilisateur courant).
// ---------------------------------------------------------------------------
(function () {
  'use strict';

  // Réutilise le client partagé de BLDB (une seule connexion pour tout le site).
  var client = (window.BLDB && window.BLDB.client) ? window.BLDB.client : null;

  var BLAvis = { ready: !!client };

  function emptyArr() { return Promise.resolve([]); }
  function nullVal() { return Promise.resolve(null); }

  // Utilisateur courant (objet user) ou null. Ne « throw » jamais.
  function currentUser() {
    if (!client) return Promise.resolve(null);
    return client.auth.getSession().then(function (res) {
      var s = res && res.data ? res.data.session : null;
      return (s && s.user) ? s.user : null;
    }).catch(function () { return null; });
  }

  // --- Lecture --------------------------------------------------------------

  // Liste les avis reçus par un pro (cibleId), du plus récent au plus ancien.
  // Renvoie [] sur toute erreur / table absente.
  BLAvis.listFor = function (cibleId) {
    if (!client || !cibleId) return emptyArr();
    try {
      return client.from('avis').select('*')
        .eq('cible', cibleId)
        .order('created_at', { ascending: false })
        .then(function (res) {
          if (!res || res.error || !res.data) return [];
          return res.data;
        }).catch(function () { return []; });
    } catch (e) { return emptyArr(); }
  };

  // Résumé de la note d'un pro : { moyenne:Number, total:Number }.
  // Renvoie { moyenne:0, total:0 } sur erreur / absence d'avis.
  BLAvis.summary = function (cibleId) {
    var zero = { moyenne: 0, total: 0 };
    if (!client || !cibleId) return Promise.resolve(zero);
    try {
      return client.from('avis').select('note')
        .eq('cible', cibleId)
        .then(function (res) {
          if (!res || res.error || !res.data || !res.data.length) return zero;
          var total = res.data.length, somme = 0;
          for (var i = 0; i < total; i++) {
            var n = Number(res.data[i] && res.data[i].note);
            if (!isNaN(n)) somme += n;
          }
          var moyenne = total ? Math.round((somme / total) * 10) / 10 : 0;
          return { moyenne: moyenne, total: total };
        }).catch(function () { return zero; });
    } catch (e) { return Promise.resolve(zero); }
  };

  // Avis de l'utilisateur courant pour un pro (cibleId), ou null.
  BLAvis.myReview = function (cibleId) {
    if (!client || !cibleId) return nullVal();
    return currentUser().then(function (user) {
      if (!user) return null;
      return client.from('avis').select('*')
        .eq('cible', cibleId)
        .eq('auteur', user.id)
        .maybeSingle()
        .then(function (res) {
          if (!res || res.error || !res.data) return null;
          return res.data;
        }).catch(function () { return null; });
    }).catch(function () { return null; });
  };

  // --- Écriture -------------------------------------------------------------

  // Crée ou met à jour son propre avis (upsert sur la clé unique cible+auteur).
  //   { cible, note (1-5), commentaire } -> ligne créée/màj ou null.
  // L'auteur est TOUJOURS l'utilisateur courant (jamais un tiers), et on ne
  // peut pas se noter soi-même.
  BLAvis.createReview = function (obj) {
    if (!client) return nullVal();
    obj = obj || {};
    return currentUser().then(function (user) {
      if (!user) return null;
      var cible = obj.cible;
      if (!cible || String(cible) === String(user.id)) return null;  // pas d'auto-avis
      var note = parseInt(obj.note, 10);
      if (isNaN(note) || note < 1 || note > 5) return null;
      var row = {
        cible: cible,
        auteur: user.id,
        note: note,
        commentaire: (obj.commentaire != null ? String(obj.commentaire) : null)
      };
      return client.from('avis').upsert(row, { onConflict: 'cible,auteur' })
        .select().single()
        .then(function (res) {
          if (!res || res.error || !res.data) return null;
          return res.data;
        }).catch(function () { return null; });
    }).catch(function () { return null; });
  };

  // Supprime son propre avis pour un pro (cibleId). Renvoie true/false.
  BLAvis.deleteMine = function (cibleId) {
    if (!client || !cibleId) return Promise.resolve(false);
    return currentUser().then(function (user) {
      if (!user) return false;
      return client.from('avis').delete()
        .eq('cible', cibleId)
        .eq('auteur', user.id)
        .then(function (res) {
          return !(res && res.error);
        }).catch(function () { return false; });
    }).catch(function () { return false; });
  };

  window.BLAvis = BLAvis;
})();
