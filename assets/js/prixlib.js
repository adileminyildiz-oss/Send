// ---------------------------------------------------------------------------
// BâtiLink — window.BLPrix : accès à la bibliothèque de prix (bordereau).
//
// Deux sources, combinées de façon défensive :
//   1. CATALOGUE STATIQUE (window.BATILINK_PRIX, assets/js/prix-data.js) :
//      toujours disponible, fonctionne hors-ligne. Prix INDICATIFS.
//   2. LIGNES PERSO de l'utilisateur connecté (table Supabase public.prix_perso),
//      optionnelles : uniquement si supabase-js est chargé, les clés présentes
//      et l'utilisateur connecté (voir supabase/schema-prix.sql).
//
// Cette couche « dégrade gracieusement » : aucune méthode ne « throw » vers
// l'appelant. Sans base / sans compte / sans table, les méthodes « perso »
// renvoient [] ou null, et le catalogue statique reste pleinement utilisable.
//
// API :
//   BLPrix.ready               -> booléen (Supabase dispo pour les lignes perso)
//   BLPrix.catalog()           -> tableau statique (copie)
//   BLPrix.metiers()           -> liste triée des métiers distincts (statique)
//   BLPrix.search({q, metier}) -> tableau filtré (statique)
//   BLPrix.listPerso()         -> Promise<[]> (lignes perso de l'utilisateur)
//   BLPrix.savePerso(obj)      -> Promise<row|null>
//   BLPrix.deletePerso(id)     -> Promise<bool>
// ---------------------------------------------------------------------------
(function () {
  'use strict';

  // --- Client Supabase (facultatif) ----------------------------------------
  var client = null;
  try {
    if (window.supabase && window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
      // Réutilise le client de BLDB si présent, sinon en crée un.
      if (window.BLDB && window.BLDB.client) {
        client = window.BLDB.client;
      } else {
        client = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
      }
    }
  } catch (e) { client = null; }

  var BLPrix = { ready: !!client };

  // --- Utilitaires ----------------------------------------------------------
  function catalogArr() {
    var a = window.BATILINK_PRIX;
    return (Object.prototype.toString.call(a) === '[object Array]') ? a : [];
  }

  function norm(s) {
    // minuscule + suppression des accents pour une recherche tolérante.
    s = (s == null) ? '' : String(s);
    try { s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (e) {}
    return s.toLowerCase();
  }

  function toNum(v) {
    var n = parseFloat(String(v).replace(',', '.'));
    return (isFinite(n) && n >= 0) ? n : 0;
  }

  function currentUser() {
    if (!client) return Promise.resolve(null);
    try {
      return client.auth.getSession().then(function (res) {
        var s = res && res.data ? res.data.session : null;
        return (s && s.user) ? s.user : null;
      }).catch(function () { return null; });
    } catch (e) { return Promise.resolve(null); }
  }

  // Normalise une ligne perso vers la même forme que le catalogue statique.
  function mapPerso(row) {
    row = row || {};
    return {
      metier: row.metier || 'Mes prix',
      designation: row.designation || '',
      unite: row.unite || 'u',
      pu: (typeof row.pu === 'number') ? row.pu : toNum(row.pu),
      _perso: true,
      _id: row.id || null
    };
  }

  // --- API statique (toujours dispo) ---------------------------------------

  // Copie défensive du catalogue statique.
  BLPrix.catalog = function () {
    return catalogArr().slice();
  };

  // Liste triée des métiers distincts présents dans le catalogue statique.
  BLPrix.metiers = function () {
    var seen = {}, out = [];
    catalogArr().forEach(function (e) {
      var m = e && e.metier;
      if (m && !seen[m]) { seen[m] = true; out.push(m); }
    });
    out.sort(function (a, b) { return a.localeCompare(b, 'fr'); });
    return out;
  };

  // Recherche filtrée sur le catalogue statique.
  //   opts.q      : texte libre (désignation ou métier)
  //   opts.metier : métier exact (tel que retourné par metiers())
  BLPrix.search = function (opts) {
    opts = opts || {};
    var q = norm(opts.q).trim();
    var terms = q ? q.split(/\s+/) : [];
    var metier = opts.metier || '';
    return catalogArr().filter(function (e) {
      if (!e) return false;
      if (metier && e.metier !== metier) return false;
      if (terms.length) {
        var hay = norm(e.designation) + ' ' + norm(e.metier);
        for (var i = 0; i < terms.length; i++) {
          if (hay.indexOf(terms[i]) === -1) return false;
        }
      }
      return true;
    });
  };

  // --- API perso (Supabase, facultative) -----------------------------------

  // Lignes de prix personnalisées de l'utilisateur connecté. [] sinon / erreur.
  BLPrix.listPerso = function () {
    if (!client) return Promise.resolve([]);
    return currentUser().then(function (user) {
      if (!user) return [];
      try {
        return client.from('prix_perso').select('*')
          .eq('owner', user.id)
          .order('created_at', { ascending: false })
          .then(function (res) {
            if (!res || res.error || !res.data) return [];
            return res.data.map(mapPerso);
          }).catch(function () { return []; });
      } catch (e) { return []; }
    }).catch(function () { return []; });
  };

  // Enregistre une ligne perso (owner = utilisateur courant). row|null.
  BLPrix.savePerso = function (obj) {
    if (!client) return Promise.resolve(null);
    obj = obj || {};
    if (!obj.designation) return Promise.resolve(null);
    return currentUser().then(function (user) {
      if (!user) return null;
      var row = {
        owner: user.id,
        metier: obj.metier || null,
        designation: obj.designation,
        unite: obj.unite || 'u',
        pu: toNum(obj.pu)
      };
      try {
        return client.from('prix_perso').insert(row).select().single().then(function (res) {
          if (!res || res.error || !res.data) return null;
          return mapPerso(res.data);
        }).catch(function () { return null; });
      } catch (e) { return null; }
    }).catch(function () { return null; });
  };

  // Supprime une ligne perso par son id (RLS : uniquement la sienne). bool.
  BLPrix.deletePerso = function (id) {
    if (!client || !id) return Promise.resolve(false);
    return currentUser().then(function (user) {
      if (!user) return false;
      try {
        return client.from('prix_perso').delete().eq('id', id).eq('owner', user.id)
          .then(function (res) { return !(res && res.error); })
          .catch(function () { return false; });
      } catch (e) { return false; }
    }).catch(function () { return false; });
  };

  window.BLPrix = BLPrix;
})();
