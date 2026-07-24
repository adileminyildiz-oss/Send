// ---------------------------------------------------------------------------
// BâtiLink — window.BLSituations : persistance des SITUATIONS DE TRAVAUX
// (facturation par avancement) sur Supabase.
//
// Même philosophie que window.BLDB (assets/js/db.js) et window.BLDocs
// (assets/js/docs.js) : cette couche « dégrade gracieusement ». Si supabase-js
// n'est pas chargé, si les clés manquent, si l'utilisateur n'est pas connecté,
// ou si les tables n'existent pas encore → BLSituations.ready vaut false et/ou
// chaque méthode renvoie [] / null / false. Aucune méthode ne « throw » vers
// l'appelant : le calculateur de situations continue de fonctionner localement
// (sans enregistrement).
//
// Dépendances : le CDN @supabase/supabase-js@2 (window.supabase) et
// window.SUPABASE_URL / window.SUPABASE_ANON_KEY (assets/js/config.js).
// ---------------------------------------------------------------------------
(function () {
  'use strict';

  var client = null;
  try {
    if (window.supabase && window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
      // Réutilise le client BLDB si présent (évite deux instances), sinon crée.
      if (window.BLDB && window.BLDB.client) {
        client = window.BLDB.client;
      } else {
        client = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
      }
    }
  } catch (e) { client = null; }

  var BLSituations = { ready: !!client, client: client };

  // --- Utilitaires internes -------------------------------------------------
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

  function toNum(v) {
    var n = parseFloat(v);
    return isFinite(n) ? n : null;
  }

  // --- API publique ---------------------------------------------------------

  // Utilisateur connecté (objet user) ou null.
  BLSituations.session = function () { return currentUser(); };

  // Liste les situations de l'utilisateur (plus récentes d'abord). [] sur erreur.
  BLSituations.listSituations = function () {
    if (!client) return emptyArr();
    return currentUser().then(function (user) {
      if (!user) return [];
      return client.from('situations').select('*')
        .eq('owner', user.id)
        .order('created_at', { ascending: false })
        .then(function (res) {
          if (!res || res.error || !res.data) return [];
          return res.data;
        }).catch(function () { return []; });
    }).catch(function () { return []; });
  };

  // Charge une situation par id (propriétaire uniquement via RLS). Ligne ou null.
  BLSituations.getSituation = function (id) {
    if (!client || !id) return nullVal();
    return client.from('situations').select('*').eq('id', id).maybeSingle().then(function (res) {
      if (!res || res.error || !res.data) return null;
      return res.data;
    }).catch(function () { return null; });
  };

  // Upsert d'une situation. Insert si pas d'id, update sinon. Fixe owner + updated_at.
  // Renvoie la ligne enregistrée ou null. Uniquement si connecté.
  BLSituations.saveSituation = function (obj) {
    if (!client) return nullVal();
    obj = obj || {};
    return currentUser().then(function (user) {
      if (!user) return null;
      var row = {
        owner: user.id,
        numero: obj.numero || null,
        chantier: obj.chantier || null,
        client_nom: obj.client_nom || null,
        client_adresse: obj.client_adresse || null,
        objet: obj.objet || null,
        montant_marche: toNum(obj.montant_marche),
        lignes: Array.isArray(obj.lignes) ? obj.lignes : [],
        tva_taux: (toNum(obj.tva_taux) != null) ? toNum(obj.tva_taux) : 20,
        retenue_garantie_taux: (toNum(obj.retenue_garantie_taux) != null) ? toNum(obj.retenue_garantie_taux) : 5,
        cumul_precedent: (toNum(obj.cumul_precedent) != null) ? toNum(obj.cumul_precedent) : 0,
        avancement_pct: toNum(obj.avancement_pct),
        total_ht: toNum(obj.total_ht),
        total_ttc: toNum(obj.total_ttc),
        net_a_payer: toNum(obj.net_a_payer),
        statut: obj.statut || 'brouillon',
        date_situation: obj.date_situation || null,
        updated_at: new Date().toISOString()
      };
      var q;
      if (obj.id) {
        row.id = obj.id;
        q = client.from('situations').update(row).eq('id', obj.id).eq('owner', user.id).select().single();
      } else {
        q = client.from('situations').insert(row).select().single();
      }
      return q.then(function (res) {
        if (!res || res.error || !res.data) return null;
        return res.data;
      }).catch(function () { return null; });
    }).catch(function () { return null; });
  };

  // Supprime une situation. Renvoie true si OK, false sinon.
  BLSituations.deleteSituation = function (id) {
    if (!client || !id) return falseVal();
    return currentUser().then(function (user) {
      if (!user) return false;
      return client.from('situations').delete().eq('id', id).eq('owner', user.id).then(function (res) {
        return !(res && res.error);
      }).catch(function () { return false; });
    }).catch(function () { return false; });
  };

  // Appelle la fonction SQL next_situation_number(). Renvoie 'SIT-2026-0001' ou null.
  BLSituations.nextNumber = function () {
    if (!client) return nullVal();
    return client.rpc('next_situation_number').then(function (res) {
      if (!res || res.error || !res.data) return null;
      return String(res.data);
    }).catch(function () { return null; });
  };

  window.BLSituations = BLSituations;
})();
