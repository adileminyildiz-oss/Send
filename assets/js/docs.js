// ---------------------------------------------------------------------------
// BâtiLink — window.BLDocs : persistance des DEVIS & FACTURES (Supabase).
//
// Même philosophie que window.BLDB (assets/js/db.js) : cette couche
// « dégrade gracieusement ». Si supabase-js n'est pas chargé, si les clés
// manquent, si l'utilisateur n'est pas connecté, ou si les tables n'existent
// pas encore → BLDocs.ready vaut false et/ou chaque méthode renvoie [] / null.
// Aucune méthode ne « throw » vers l'appelant : le générateur de devis
// continue de fonctionner localement (sans enregistrement).
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

  var BLDocs = { ready: !!client, client: client };

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

  // Date du jour au format ISO court (YYYY-MM-DD).
  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  // Date + n jours au format ISO court.
  function plusDaysISO(days) {
    var d = new Date();
    d.setDate(d.getDate() + (days || 0));
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  function toNum(v) {
    var n = parseFloat(v);
    return isFinite(n) ? n : null;
  }

  // --- API publique ---------------------------------------------------------

  // Utilisateur connecté (objet user) ou null.
  BLDocs.session = function () { return currentUser(); };

  // Liste les documents de l'utilisateur (plus récents d'abord).
  // opts.type ('devis' | 'facture') filtre facultativement. Renvoie [] sur erreur.
  BLDocs.listDocs = function (opts) {
    if (!client) return emptyArr();
    opts = opts || {};
    return currentUser().then(function (user) {
      if (!user) return [];
      var q = client.from('documents').select('*')
        .eq('owner', user.id)
        .order('created_at', { ascending: false });
      if (opts.type) q = q.eq('type', opts.type);
      return q.then(function (res) {
        if (!res || res.error || !res.data) return [];
        return res.data;
      }).catch(function () { return []; });
    }).catch(function () { return []; });
  };

  // Charge un document par id (propriétaire uniquement via RLS). Renvoie ligne ou null.
  BLDocs.getDoc = function (id) {
    if (!client || !id) return nullVal();
    return client.from('documents').select('*').eq('id', id).maybeSingle().then(function (res) {
      if (!res || res.error || !res.data) return null;
      return res.data;
    }).catch(function () { return null; });
  };

  // Upsert d'un document. Insert si pas d'id, update sinon. Fixe owner + updated_at.
  // Renvoie la ligne enregistrée ou null. Uniquement si connecté.
  BLDocs.saveDoc = function (obj) {
    if (!client) return nullVal();
    obj = obj || {};
    return currentUser().then(function (user) {
      if (!user) return null;
      var row = {
        owner: user.id,
        type: (obj.type === 'facture') ? 'facture' : 'devis',
        numero: obj.numero || null,
        client_nom: obj.client_nom || null,
        client_adresse: obj.client_adresse || null,
        client_email: obj.client_email || null,
        objet: obj.objet || null,
        lignes: Array.isArray(obj.lignes) ? obj.lignes : [],
        tva_taux: (toNum(obj.tva_taux) != null) ? toNum(obj.tva_taux) : 20,
        total_ht: toNum(obj.total_ht),
        total_tva: toNum(obj.total_tva),
        total_ttc: toNum(obj.total_ttc),
        statut: obj.statut || 'brouillon',
        notes: obj.notes || null,
        date_emission: obj.date_emission || null,
        date_echeance: obj.date_echeance || null,
        devis_source: obj.devis_source || null,
        updated_at: new Date().toISOString()
      };
      var q;
      if (obj.id) {
        row.id = obj.id;
        q = client.from('documents').update(row).eq('id', obj.id).eq('owner', user.id).select().single();
      } else {
        q = client.from('documents').insert(row).select().single();
      }
      return q.then(function (res) {
        if (!res || res.error || !res.data) return null;
        return res.data;
      }).catch(function () { return null; });
    }).catch(function () { return null; });
  };

  // Supprime un document. Renvoie true si OK, false sinon.
  BLDocs.deleteDoc = function (id) {
    if (!client || !id) return falseVal();
    return currentUser().then(function (user) {
      if (!user) return false;
      return client.from('documents').delete().eq('id', id).eq('owner', user.id).then(function (res) {
        return !(res && res.error);
      }).catch(function () { return false; });
    }).catch(function () { return false; });
  };

  // Appelle la fonction SQL next_doc_number(type). Renvoie une chaîne ou null.
  BLDocs.nextNumber = function (type) {
    if (!client) return nullVal();
    var t = (type === 'facture') ? 'facture' : 'devis';
    return client.rpc('next_doc_number', { p_type: t }).then(function (res) {
      if (!res || res.error || !res.data) return null;
      return String(res.data);
    }).catch(function () { return null; });
  };

  // Convertit un devis existant en une NOUVELLE facture (copie lignes/client/totaux).
  // Numéro via nextNumber('facture'), devis_source, statut 'brouillon',
  // date d'émission = aujourd'hui, échéance = +30 jours. Passe le devis en 'facturé'.
  // Renvoie la nouvelle facture ou null.
  BLDocs.convertToInvoice = function (devisId) {
    if (!client || !devisId) return nullVal();
    return BLDocs.getDoc(devisId).then(function (devis) {
      if (!devis) return null;
      return BLDocs.nextNumber('facture').then(function (numero) {
        var facture = {
          type: 'facture',
          numero: numero || null,
          client_nom: devis.client_nom,
          client_adresse: devis.client_adresse,
          client_email: devis.client_email,
          objet: devis.objet,
          lignes: Array.isArray(devis.lignes) ? devis.lignes : [],
          tva_taux: devis.tva_taux,
          total_ht: devis.total_ht,
          total_tva: devis.total_tva,
          total_ttc: devis.total_ttc,
          statut: 'brouillon',
          notes: devis.notes,
          date_emission: todayISO(),
          date_echeance: plusDaysISO(30),
          devis_source: devisId
        };
        return BLDocs.saveDoc(facture).then(function (row) {
          if (!row) return null;
          // Marque le devis source comme « facturé » (best effort).
          BLDocs.saveDoc({
            id: devisId,
            type: 'devis',
            numero: devis.numero,
            client_nom: devis.client_nom,
            client_adresse: devis.client_adresse,
            client_email: devis.client_email,
            objet: devis.objet,
            lignes: devis.lignes,
            tva_taux: devis.tva_taux,
            total_ht: devis.total_ht,
            total_tva: devis.total_tva,
            total_ttc: devis.total_ttc,
            statut: 'facturé',
            notes: devis.notes,
            date_emission: devis.date_emission,
            date_echeance: devis.date_echeance,
            devis_source: devis.devis_source
          }).catch(function () {});
          return row;
        });
      });
    }).catch(function () { return null; });
  };

  window.BLDocs = BLDocs;
})();
