// ---------------------------------------------------------------------------
// BâtiLink — window.BLAlertes : couche d'accès aux ALERTES appels d'offres.
//
// Objectif : permettre à un utilisateur connecté d'enregistrer des recherches
// BOAMP (mots-clés + département) et de recevoir par email les nouveaux avis.
// Cette couche « dégrade gracieusement », comme window.BLDB :
//   • si supabase-js n'est pas chargé, ou si les clés manquent, ou si la table
//     public.alertes_ao n'existe pas encore, ou si l'utilisateur n'est pas
//     connecté → BLAlertes.ready vaut false et/ou chaque méthode renvoie
//     [] / null / false. Aucune méthode ne « throw » vers l'appelant.
//
// Dépendances : le CDN @supabase/supabase-js@2 (window.supabase),
// window.SUPABASE_URL / window.SUPABASE_ANON_KEY (assets/js/config.js) et,
// si présent, window.BLDB (on réutilise son client pour partager la session).
// ---------------------------------------------------------------------------
(function () {
  'use strict';

  // On réutilise le client de BLDB si possible (session partagée), sinon on en
  // crée un — tout en restant tolérant si supabase-js / les clés manquent.
  var client = null;
  try {
    if (window.BLDB && window.BLDB.client) {
      client = window.BLDB.client;
    } else if (window.supabase && window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
      client = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
    }
  } catch (e) { client = null; }

  var BLAlertes = { ready: !!client, client: client };

  function emptyArr() { return Promise.resolve([]); }
  function nullVal() { return Promise.resolve(null); }
  function falseVal() { return Promise.resolve(false); }

  // Utilisateur courant (objet user) ou null. Ne « throw » jamais.
  function currentUser() {
    if (!client) return Promise.resolve(null);
    return client.auth.getSession().then(function (res) {
      var s = res && res.data ? res.data.session : null;
      return (s && s.user) ? s.user : null;
    }).catch(function () { return null; });
  }

  // --- API publique ---------------------------------------------------------

  // Utilisateur connecté (objet user) ou null.
  BLAlertes.session = function () { return currentUser(); };

  // Liste les alertes de l'utilisateur courant (récentes d'abord).
  // Renvoie [] si non connecté / table absente / erreur.
  BLAlertes.listAlertes = function () {
    if (!client) return emptyArr();
    return currentUser().then(function (user) {
      if (!user) return [];
      return client.from('alertes_ao').select('*')
        .eq('owner', user.id)
        .order('created_at', { ascending: false })
        .then(function (res) {
          if (!res || res.error || !res.data) return [];
          return res.data;
        }).catch(function () { return []; });
    }).catch(function () { return []; });
  };

  // Crée une alerte (owner = utilisateur courant). Renvoie la ligne ou null.
  BLAlertes.createAlerte = function (obj) {
    if (!client) return nullVal();
    obj = obj || {};
    return currentUser().then(function (user) {
      if (!user) return null;
      var freq = obj.frequence || 'quotidienne';
      var row = {
        owner: user.id,
        mots_cles: (obj.mots_cles != null && obj.mots_cles !== '') ? obj.mots_cles : null,
        departement: (obj.departement != null && obj.departement !== '') ? obj.departement : null,
        frequence: freq,
        actif: true
      };
      return client.from('alertes_ao').insert(row).select().single().then(function (res) {
        if (!res || res.error || !res.data) return null;
        return res.data;
      }).catch(function () { return null; });
    }).catch(function () { return null; });
  };

  // Active / met en pause une alerte. Renvoie true si mise à jour, sinon false.
  BLAlertes.toggleAlerte = function (id, actif) {
    if (!client || !id) return falseVal();
    return currentUser().then(function (user) {
      if (!user) return false;
      return client.from('alertes_ao')
        .update({ actif: !!actif })
        .eq('id', id)
        .eq('owner', user.id)
        .then(function (res) {
          return !!(res && !res.error);
        }).catch(function () { return false; });
    }).catch(function () { return false; });
  };

  // Supprime une alerte. Renvoie true si supprimée, sinon false.
  BLAlertes.deleteAlerte = function (id) {
    if (!client || !id) return falseVal();
    return currentUser().then(function (user) {
      if (!user) return false;
      return client.from('alertes_ao')
        .delete()
        .eq('id', id)
        .eq('owner', user.id)
        .then(function (res) {
          return !!(res && !res.error);
        }).catch(function () { return false; });
    }).catch(function () { return false; });
  };

  window.BLAlertes = BLAlertes;
})();
