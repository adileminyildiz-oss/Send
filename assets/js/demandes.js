// ---------------------------------------------------------------------------
// BâtiLink — window.BLDemandes : DEMANDES DE DOCUMENTS (Supabase).
//
// Même philosophie que window.BLDB (assets/js/db.js) : cette couche
// « dégrade gracieusement ». Si supabase-js n'est pas chargé, si les clés
// manquent, si l'utilisateur n'est pas connecté, ou si la table n'existe pas
// encore → BLDemandes.ready vaut false et/ou chaque méthode renvoie [] / null.
// Aucune méthode ne « throw » vers l'appelant : la page conformite/index.html
// continue de fonctionner (notification Formspree + repli local).
//
// CONCEPT : l'utilisateur DEMANDE un document au cabinet (AEM-CONSEIL). Le
// cabinet traite la demande (statut/reponse/fichier_path) et lui envoie le
// document ; le fichier livré vit dans le bucket privé « conformite ».
//
// Dépendances : le CDN @supabase/supabase-js@2 (window.supabase) et
// window.SUPABASE_URL / window.SUPABASE_ANON_KEY (assets/js/config.js).
// ---------------------------------------------------------------------------
(function () {
  'use strict';

  var BUCKET = 'conformite';   // bucket privé Supabase Storage où le cabinet dépose les fichiers livrés

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

  var BLDemandes = { ready: !!client, client: client };

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

  // --- API publique ---------------------------------------------------------

  // Utilisateur connecté (objet user) ou null.
  BLDemandes.session = function () { return currentUser(); };

  // Liste les demandes de l'utilisateur (plus récentes d'abord). Renvoie [] sur erreur.
  BLDemandes.listDemandes = function () {
    if (!client) return emptyArr();
    return currentUser().then(function (user) {
      if (!user) return [];
      return client.from('demandes_documents').select('*')
        .eq('owner', user.id)
        .order('created_at', { ascending: false })
        .then(function (res) {
          if (!res || res.error || !res.data) return [];
          return res.data;
        }).catch(function () { return []; });
    }).catch(function () { return []; });
  };

  // Crée une demande (owner = utilisateur courant). Renvoie la ligne créée ou null.
  // Uniquement si connecté ET base disponible.
  BLDemandes.createDemande = function (obj) {
    if (!client) return nullVal();
    obj = obj || {};
    return currentUser().then(function (user) {
      if (!user) return null;
      var row = {
        owner: user.id,
        type_document: obj.type_document || 'Document',
        precisions: obj.precisions || null,
        urgence: (obj.urgence === 'urgente') ? 'urgente' : 'normale'
      };
      return client.from('demandes_documents').insert(row).select().single().then(function (res) {
        if (!res || res.error || !res.data) return null;
        return res.data;
      }).catch(function () { return null; });
    }).catch(function () { return null; });
  };

  // Annule une demande (best effort). Passe statut='refusee' ; renvoie true si OK.
  BLDemandes.cancelDemande = function (id) {
    if (!client || !id) return falseVal();
    return currentUser().then(function (user) {
      if (!user) return false;
      return client.from('demandes_documents')
        .update({ statut: 'refusee', updated_at: new Date().toISOString() })
        .eq('id', id).eq('owner', user.id)
        .then(function (res) {
          return !(res && res.error);
        }).catch(function () { return false; });
    }).catch(function () { return false; });
  };

  // URL signée temporaire (5 min) vers un fichier livré du bucket privé 'conformite'.
  // Renvoie l'URL (chaîne) ou null.
  BLDemandes.fileUrl = function (path) {
    if (!client || !path) return nullVal();
    try {
      return client.storage.from(BUCKET).createSignedUrl(path, 300).then(function (res) {
        if (!res || res.error || !res.data || !res.data.signedUrl) return null;
        return res.data.signedUrl;
      }).catch(function () { return null; });
    } catch (e) { return nullVal(); }
  };

  window.BLDemandes = BLDemandes;
})();
