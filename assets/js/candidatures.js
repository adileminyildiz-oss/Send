// ---------------------------------------------------------------------------
// BâtiLink — window.BLCand : CANDIDATURES (réponses des artisans à un chantier)
// + LEADS PLAFONNÉS (plafond de candidatures par chantier).
//
// Même philosophie que window.BLDB (assets/js/db.js) et window.BLMsg
// (assets/js/messagerie.js) : cette couche « dégrade gracieusement ». Si
// supabase-js n'est pas chargé, si les clés manquent, si l'utilisateur n'est
// pas connecté, ou si la table `candidatures` n'existe pas encore → BLCand.ready
// vaut false et/ou chaque méthode renvoie une valeur neutre ([] / null / 0 /
// false / { error }). AUCUNE méthode ne « throw » vers l'appelant : la page
// chantier/index.html retombe alors sur un état propre plutôt que de casser.
//
// CONCEPT « LEADS PLAFONNÉS » : un chantier n'accepte qu'un nombre limité de
// candidatures (CAP, 5 par défaut). Au-delà, le chantier est « complet ». Le
// plafond est réellement appliqué côté base (trigger BEFORE INSERT) — les
// contrôles ci-dessous ne sont qu'une couche de confort côté navigateur.
//
// Dépendances : le CDN @supabase/supabase-js@2 (window.supabase),
// window.SUPABASE_URL / window.SUPABASE_ANON_KEY (assets/js/config.js), et de
// préférence window.BLDB (réutilise son client Supabase).
// ---------------------------------------------------------------------------
(function () {
  'use strict';

  // Plafond de candidatures par chantier (doit refléter public.bl_candidatures_cap()).
  var CAP = 5;

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

  var BLCand = { ready: !!client, client: client, CAP: CAP };

  // --- Utilitaires internes -------------------------------------------------
  function emptyArr() { return Promise.resolve([]); }
  function nullVal() { return Promise.resolve(null); }
  function falseVal() { return Promise.resolve(false); }
  function zeroVal() { return Promise.resolve(0); }

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
  BLCand.session = function () { return currentUser(); };

  // Nombre TOTAL de candidatures d'un chantier (pour l'affichage « X/5 »).
  // Utilise la fonction SECURITY DEFINER bl_candidature_count (comptage fiable
  // même pour un artisan qui ne « voit » que ses propres candidatures via RLS).
  // Repli best effort sur un comptage des lignes visibles. Renvoie 0 sur erreur.
  BLCand.countFor = function (chantierId) {
    if (!client || !chantierId) return zeroVal();
    try {
      return client.rpc('bl_candidature_count', { p_chantier: chantierId })
        .then(function (res) {
          if (res && !res.error && typeof res.data === 'number') return res.data;
          // Repli : compte les lignes visibles (partiel, mais mieux que rien).
          return client.from('candidatures')
            .select('id', { count: 'exact', head: true })
            .eq('chantier_id', chantierId)
            .then(function (r2) {
              if (!r2 || r2.error) return 0;
              return (typeof r2.count === 'number') ? r2.count : 0;
            }).catch(function () { return 0; });
        }).catch(function () { return 0; });
    } catch (e) { return zeroVal(); }
  };

  // true si le chantier a atteint son plafond de candidatures (complet).
  BLCand.isFull = function (chantierId) {
    return BLCand.countFor(chantierId).then(function (n) { return n >= CAP; });
  };

  // L'utilisateur courant a-t-il déjà candidaté à ce chantier ? Renvoie bool.
  BLCand.hasApplied = function (chantierId) {
    if (!client || !chantierId) return falseVal();
    return currentUser().then(function (user) {
      if (!user) return false;
      return client.from('candidatures').select('id')
        .eq('chantier_id', chantierId)
        .eq('artisan', user.id)
        .limit(1)
        .then(function (res) {
          if (!res || res.error || !res.data) return false;
          return res.data.length > 0;
        }).catch(function () { return false; });
    }).catch(function () { return false; });
  };

  // Candidate à un chantier (artisan = utilisateur courant).
  // Garde-fous (côté confort ; la base reste la source de vérité) :
  //   • connecté,
  //   • pas le propriétaire du chantier,
  //   • pas déjà candidaté,
  //   • sous le plafond.
  // Renvoie la ligne créée, ou { error: '...' } (jamais de « throw »).
  BLCand.apply = function (chantierId, message) {
    if (!client) return Promise.resolve({ error: 'indisponible' });
    if (!chantierId) return Promise.resolve({ error: 'chantier_invalide' });
    message = (message == null) ? '' : String(message);
    return currentUser().then(function (user) {
      if (!user) return { error: 'non_connecte' };

      // Vérifie propriétaire + doublon + plafond en parallèle (best effort).
      var pOwner = client.from('chantiers').select('owner').eq('id', chantierId).maybeSingle()
        .then(function (r) { return (r && r.data) ? r.data.owner : null; })
        .catch(function () { return null; });
      var pApplied = BLCand.hasApplied(chantierId);
      var pCount = BLCand.countFor(chantierId);

      return Promise.all([pOwner, pApplied, pCount]).then(function (arr) {
        var owner = arr[0], applied = arr[1], count = arr[2];
        if (owner && String(owner) === String(user.id)) return { error: 'proprietaire' };
        if (applied) return { error: 'deja_candidate' };
        if (typeof count === 'number' && count >= CAP) return { error: 'complet' };

        var row = { chantier_id: chantierId, artisan: user.id, message: message.trim() || null };
        return client.from('candidatures').insert(row).select().single().then(function (res) {
          if (res && !res.error && res.data) return res.data;
          // Le trigger de plafond ou l'unicité peuvent refuser l'insertion :
          // on renvoie une erreur exploitable plutôt que de « throw ».
          var msg = (res && res.error && res.error.message) ? res.error.message : '';
          if (/complet|maximal|cap/i.test(msg)) return { error: 'complet' };
          if (/duplicate|unique/i.test(msg)) return { error: 'deja_candidate' };
          return { error: 'echec' };
        }).catch(function () { return { error: 'echec' }; });
      }).catch(function () { return { error: 'echec' }; });
    }).catch(function () { return { error: 'echec' }; });
  };

  // Les candidatures de l'utilisateur courant, enrichies (best effort) des infos
  // du chantier concerné : _chantier = { id, titre, ville, metier, statut }.
  // Plus récentes d'abord. Renvoie [] sur toute erreur.
  BLCand.listMine = function () {
    if (!client) return emptyArr();
    return currentUser().then(function (user) {
      if (!user) return [];
      return client.from('candidatures').select('*')
        .eq('artisan', user.id)
        .order('created_at', { ascending: false })
        .then(function (res) {
          if (!res || res.error || !res.data) return [];
          var rows = res.data;
          if (!rows.length) return rows;

          // Enrichissement : titres des chantiers concernés (best effort).
          var ids = [];
          rows.forEach(function (r) { if (r && r.chantier_id) ids.push(r.chantier_id); });
          if (!ids.length) return rows;
          return client.from('chantiers').select('id,titre,ville,metier,statut')
            .in('id', ids)
            .then(function (cr) {
              var byId = {};
              if (cr && !cr.error && cr.data) {
                cr.data.forEach(function (c) { byId[c.id] = c; });
              }
              rows.forEach(function (r) { r._chantier = byId[r.chantier_id] || null; });
              return rows;
            }).catch(function () { return rows; });
        }).catch(function () { return []; });
    }).catch(function () { return []; });
  };

  // Les candidatures reçues sur un chantier — RÉSERVÉ au propriétaire (RLS le
  // garantit côté base : un non-propriétaire ne verra que ses propres lignes).
  // Plus récentes d'abord. Renvoie [] sur toute erreur.
  BLCand.listForChantier = function (chantierId) {
    if (!client || !chantierId) return emptyArr();
    return client.from('candidatures').select('*')
      .eq('chantier_id', chantierId)
      .order('created_at', { ascending: false })
      .then(function (res) {
        if (!res || res.error || !res.data) return [];
        return res.data;
      }).catch(function () { return []; });
  };

  // Met à jour le statut d'une candidature (accepter / refuser) — RÉSERVÉ au
  // propriétaire du chantier (RLS). statut ∈ { acceptee, refusee, envoyee }.
  // Renvoie la ligne mise à jour ou null.
  BLCand.setStatut = function (candidatureId, statut) {
    if (!client || !candidatureId) return nullVal();
    var allowed = { envoyee: 1, acceptee: 1, refusee: 1 };
    if (!allowed[statut]) return nullVal();
    return client.from('candidatures').update({ statut: statut })
      .eq('id', candidatureId)
      .select().single()
      .then(function (res) {
        if (!res || res.error || !res.data) return null;
        return res.data;
      }).catch(function () { return null; });
  };

  window.BLCand = BLCand;
})();
