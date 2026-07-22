// ---------------------------------------------------------------------------
// BâtiLink — window.BLGestion : SUIVI CLIENT (CRM) & SUIVI DES DÉPENSES.
//
// Même philosophie que window.BLDB (assets/js/db.js) et window.BLDocs
// (assets/js/docs.js) : cette couche « dégrade gracieusement ». Si supabase-js
// n'est pas chargé, si les clés manquent, si l'utilisateur n'est pas connecté,
// ou si les tables (clients / depenses) n'existent pas encore → BLGestion.ready
// vaut false et/ou chaque méthode renvoie [] / null / des zéros.
// Aucune méthode ne « throw » vers l'appelant : la page gestion reste stable.
//
// Dépendances : le CDN @supabase/supabase-js@2 (window.supabase) et
// window.SUPABASE_URL / window.SUPABASE_ANON_KEY (assets/js/config.js).
// ---------------------------------------------------------------------------
(function () {
  'use strict';

  var client = null;
  try {
    if (window.supabase && window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
      // Réutilise le client BLDB si présent (évite plusieurs instances), sinon crée.
      if (window.BLDB && window.BLDB.client) {
        client = window.BLDB.client;
      } else {
        client = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
      }
    }
  } catch (e) { client = null; }

  var BLGestion = { ready: !!client, client: client };

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
  BLGestion.session = function () { return currentUser(); };

  // ==== CLIENTS (CRM) =======================================================

  // Liste les clients de l'utilisateur (plus récents d'abord). [] sur erreur.
  BLGestion.listClients = function () {
    if (!client) return emptyArr();
    return currentUser().then(function (user) {
      if (!user) return [];
      return client.from('clients').select('*')
        .eq('owner', user.id)
        .order('created_at', { ascending: false })
        .then(function (res) {
          if (!res || res.error || !res.data) return [];
          return res.data;
        }).catch(function () { return []; });
    }).catch(function () { return []; });
  };

  // Charge un client par id (propriétaire uniquement via RLS). Ligne ou null.
  BLGestion.getClient = function (id) {
    if (!client || !id) return nullVal();
    return client.from('clients').select('*').eq('id', id).maybeSingle().then(function (res) {
      if (!res || res.error || !res.data) return null;
      return res.data;
    }).catch(function () { return null; });
  };

  // Upsert d'un client. Insert si pas d'id, update sinon. Fixe owner + updated_at.
  // Renvoie la ligne enregistrée ou null. Uniquement si connecté.
  BLGestion.saveClient = function (obj) {
    if (!client) return nullVal();
    obj = obj || {};
    return currentUser().then(function (user) {
      if (!user) return null;
      var row = {
        owner: user.id,
        nom: obj.nom || 'Client',
        contact_nom: obj.contact_nom || null,
        email: obj.email || null,
        telephone: obj.telephone || null,
        adresse: obj.adresse || null,
        ville: obj.ville || null,
        code_postal: obj.code_postal || null,
        notes: obj.notes || null,
        updated_at: new Date().toISOString()
      };
      var q;
      if (obj.id) {
        row.id = obj.id;
        q = client.from('clients').update(row).eq('id', obj.id).eq('owner', user.id).select().single();
      } else {
        q = client.from('clients').insert(row).select().single();
      }
      return q.then(function (res) {
        if (!res || res.error || !res.data) return null;
        return res.data;
      }).catch(function () { return null; });
    }).catch(function () { return null; });
  };

  // Supprime un client. Renvoie true si OK, false sinon.
  BLGestion.deleteClient = function (id) {
    if (!client || !id) return falseVal();
    return currentUser().then(function (user) {
      if (!user) return false;
      return client.from('clients').delete().eq('id', id).eq('owner', user.id).then(function (res) {
        return !(res && res.error);
      }).catch(function () { return false; });
    }).catch(function () { return false; });
  };

  // ==== DÉPENSES ============================================================

  // Liste les dépenses de l'utilisateur (plus récentes d'abord). [] sur erreur.
  BLGestion.listDepenses = function () {
    if (!client) return emptyArr();
    return currentUser().then(function (user) {
      if (!user) return [];
      return client.from('depenses').select('*')
        .eq('owner', user.id)
        .order('date_depense', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .then(function (res) {
          if (!res || res.error || !res.data) return [];
          return res.data;
        }).catch(function () { return []; });
    }).catch(function () { return []; });
  };

  // Upsert d'une dépense. Insert si pas d'id, update sinon. Fixe owner.
  // Si montant_ttc est vide, on le calcule : ht * (1 + tva/100).
  // Renvoie la ligne enregistrée ou null. Uniquement si connecté.
  BLGestion.saveDepense = function (obj) {
    if (!client) return nullVal();
    obj = obj || {};
    return currentUser().then(function (user) {
      if (!user) return null;
      var ht = toNum(obj.montant_ht);
      var tva = (toNum(obj.tva_taux) != null) ? toNum(obj.tva_taux) : 20;
      var ttc = toNum(obj.montant_ttc);
      if (ttc == null && ht != null) {
        ttc = Math.round(ht * (1 + tva / 100) * 100) / 100;
      }
      var row = {
        owner: user.id,
        libelle: obj.libelle || 'Dépense',
        categorie: obj.categorie || null,
        fournisseur: obj.fournisseur || null,
        montant_ht: ht,
        tva_taux: tva,
        montant_ttc: ttc,
        date_depense: obj.date_depense || null,
        chantier: obj.chantier || null,
        notes: obj.notes || null
      };
      var q;
      if (obj.id) {
        row.id = obj.id;
        q = client.from('depenses').update(row).eq('id', obj.id).eq('owner', user.id).select().single();
      } else {
        q = client.from('depenses').insert(row).select().single();
      }
      return q.then(function (res) {
        if (!res || res.error || !res.data) return null;
        return res.data;
      }).catch(function () { return null; });
    }).catch(function () { return null; });
  };

  // Supprime une dépense. Renvoie true si OK, false sinon.
  BLGestion.deleteDepense = function (id) {
    if (!client || !id) return falseVal();
    return currentUser().then(function (user) {
      if (!user) return false;
      return client.from('depenses').delete().eq('id', id).eq('owner', user.id).then(function (res) {
        return !(res && res.error);
      }).catch(function () { return false; });
    }).catch(function () { return false; });
  };

  // ==== SYNTHÈSE ============================================================

  // Renvoie { nbClients, totalDepensesTTC } à partir des deux tables.
  // Ne « throw » jamais → zéros en cas d'erreur / table absente.
  BLGestion.summary = function () {
    var zero = { nbClients: 0, totalDepensesTTC: 0 };
    if (!client) return Promise.resolve(zero);
    return Promise.all([
      BLGestion.listClients(),
      BLGestion.listDepenses()
    ]).then(function (res) {
      var clients = res[0] || [];
      var depenses = res[1] || [];
      var totalTTC = 0;
      depenses.forEach(function (d) {
        var t = toNum(d && d.montant_ttc);
        if (t == null) {
          var ht = toNum(d && d.montant_ht);
          var tva = (toNum(d && d.tva_taux) != null) ? toNum(d.tva_taux) : 20;
          if (ht != null) t = ht * (1 + tva / 100);
        }
        if (t != null) totalTTC += t;
      });
      return { nbClients: clients.length, totalDepensesTTC: Math.round(totalTTC * 100) / 100 };
    }).catch(function () { return zero; });
  };

  window.BLGestion = BLGestion;
})();
