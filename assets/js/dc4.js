// ---------------------------------------------------------------------------
// BâtiLink — window.BLDC4 : persistance des DÉCLARATIONS DE SOUS-TRAITANCE
// (DC4 — acte spécial de sous-traitance) sur Supabase.
//
// Même philosophie que window.BLDB (assets/js/db.js), window.BLDocs
// (assets/js/docs.js) et window.BLSituations (assets/js/situations.js) : cette
// couche « dégrade gracieusement ». Si supabase-js n'est pas chargé, si les
// clés manquent, si l'utilisateur n'est pas connecté, ou si les tables
// n'existent pas encore → BLDC4.ready vaut false et/ou chaque méthode renvoie
// [] / null / false. Aucune méthode ne « throw » vers l'appelant : le
// générateur DC4 continue de fonctionner localement (formulaire + impression).
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

  var BLDC4 = { ready: !!client, client: client };

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
  BLDC4.session = function () { return currentUser(); };

  // Liste les DC4 de l'utilisateur (plus récents d'abord). [] sur erreur.
  BLDC4.listDC4 = function () {
    if (!client) return emptyArr();
    return currentUser().then(function (user) {
      if (!user) return [];
      return client.from('dc4').select('*')
        .eq('owner', user.id)
        .order('created_at', { ascending: false })
        .then(function (res) {
          if (!res || res.error || !res.data) return [];
          return res.data;
        }).catch(function () { return []; });
    }).catch(function () { return []; });
  };

  // Charge un DC4 par id (propriétaire uniquement via RLS). Ligne ou null.
  BLDC4.getDC4 = function (id) {
    if (!client || !id) return nullVal();
    return client.from('dc4').select('*').eq('id', id).maybeSingle().then(function (res) {
      if (!res || res.error || !res.data) return null;
      return res.data;
    }).catch(function () { return null; });
  };

  // Upsert d'un DC4. Insert si pas d'id, update sinon. Fixe owner + updated_at.
  // Calcule montant_ttc à partir de montant_ht * (1 + tva/100) si TTC absent.
  // Renvoie la ligne enregistrée ou null. Uniquement si connecté.
  BLDC4.saveDC4 = function (obj) {
    if (!client) return nullVal();
    obj = obj || {};
    return currentUser().then(function (user) {
      if (!user) return null;

      var ht = toNum(obj.montant_ht);
      var tva = (toNum(obj.tva_taux) != null) ? toNum(obj.tva_taux) : 20;
      var ttc = toNum(obj.montant_ttc);
      // Auto-calcul du TTC si absent et HT disponible.
      if (ttc == null && ht != null) {
        ttc = ht * (1 + tva / 100);
      }

      var row = {
        owner: user.id,
        numero: obj.numero || null,
        marche_objet: obj.marche_objet || null,
        maitre_ouvrage: obj.maitre_ouvrage || null,
        mo_adresse: obj.mo_adresse || null,
        titulaire_nom: obj.titulaire_nom || null,
        titulaire_siret: obj.titulaire_siret || null,
        titulaire_adresse: obj.titulaire_adresse || null,
        soustraitant_nom: obj.soustraitant_nom || null,
        st_siret: obj.st_siret || null,
        st_adresse: obj.st_adresse || null,
        nature_prestations: obj.nature_prestations || null,
        montant_ht: ht,
        tva_taux: tva,
        montant_ttc: ttc,
        modalites_paiement: obj.modalites_paiement || null,
        statut: obj.statut || 'brouillon',
        updated_at: new Date().toISOString()
      };
      var q;
      if (obj.id) {
        row.id = obj.id;
        q = client.from('dc4').update(row).eq('id', obj.id).eq('owner', user.id).select().single();
      } else {
        q = client.from('dc4').insert(row).select().single();
      }
      return q.then(function (res) {
        if (!res || res.error || !res.data) return null;
        return res.data;
      }).catch(function () { return null; });
    }).catch(function () { return null; });
  };

  // Supprime un DC4. Renvoie true si OK, false sinon.
  BLDC4.deleteDC4 = function (id) {
    if (!client || !id) return falseVal();
    return currentUser().then(function (user) {
      if (!user) return false;
      return client.from('dc4').delete().eq('id', id).eq('owner', user.id).then(function (res) {
        return !(res && res.error);
      }).catch(function () { return false; });
    }).catch(function () { return false; });
  };

  // Appelle la fonction SQL next_dc4_number(). Renvoie 'DC4-2026-0001' ou null.
  BLDC4.nextNumber = function () {
    if (!client) return nullVal();
    return client.rpc('next_dc4_number').then(function (res) {
      if (!res || res.error || !res.data) return null;
      return String(res.data);
    }).catch(function () { return null; });
  };

  window.BLDC4 = BLDC4;
})();
