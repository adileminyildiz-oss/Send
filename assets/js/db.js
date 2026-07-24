// ---------------------------------------------------------------------------
// BâtiLink — window.BLDB : couche d'accès légère à Supabase (place de marché).
//
// Objectif : brancher les chantiers et profils RÉELS (Supabase Postgres) sans
// jamais casser une page. Cette couche « dégrade gracieusement » :
//   • si la librairie supabase-js n'est pas chargée, ou si les clés manquent,
//     ou si l'utilisateur n'est pas connecté, ou si les tables n'existent pas
//     encore → BLDB.ready vaut false et/ou chaque méthode renvoie [] ou null.
//   • aucune méthode ne « throw » vers l'appelant : les erreurs sont capturées
//     et transformées en résultat vide, pour que les pages retombent sur les
//     données d'exemple (assets/js/data.js).
//
// Dépendances : uniquement le CDN @supabase/supabase-js@2 (window.supabase) et
// window.SUPABASE_URL / window.SUPABASE_ANON_KEY (assets/js/config.js).
// ---------------------------------------------------------------------------
(function () {
  'use strict';

  var client = null;
  try {
    if (window.supabase && window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
      client = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
    }
  } catch (e) { client = null; }

  var BLDB = { ready: !!client, client: client };

  // --- Utilitaires internes -------------------------------------------------
  function emptyArr() { return Promise.resolve([]); }
  function nullVal() { return Promise.resolve(null); }

  // Récupère l'utilisateur courant (ou null). Ne « throw » jamais.
  function currentUser() {
    if (!client) return Promise.resolve(null);
    return client.auth.getSession().then(function (res) {
      var s = res && res.data ? res.data.session : null;
      return (s && s.user) ? s.user : null;
    }).catch(function () { return null; });
  }

  // Emoji d'illustration selon le métier (repli sur 🏗️).
  function metierEmoji(metier) {
    var m = (metier || '').toLowerCase();
    if (/plomb/.test(m)) return '🔧';
    if (/élec|elec/.test(m)) return '⚡';
    if (/toit|couvr/.test(m)) return '🧱';
    if (/chauff|pac|pompe/.test(m)) return '🔥';
    if (/menuis|bois/.test(m)) return '🪵';
    if (/peint|finit/.test(m)) return '🎨';
    if (/façad|facad|ite/.test(m)) return '🏗️';
    if (/carrel/.test(m)) return '🧱';
    if (/rénov|renov|complet|tous corps/.test(m)) return '🏠';
    return '🏗️';
  }

  // Un chantier est-il « récent » (moins de 14 jours) ?
  function isRecent(iso) {
    if (!iso) return false;
    var t = Date.parse(iso);
    if (isNaN(t)) return false;
    return (Date.now() - t) < 14 * 86400000;
  }

  // Mappe une ligne « chantiers » vers la forme attendue par recherche.js.
  function mapChantier(row) {
    row = row || {};
    return {
      titre: row.titre || 'Chantier',
      metier: row.metier || 'Tous corps d\'état',
      ville: row.ville || '',
      budget: row.budget || '',
      delai: row.delai || '',
      desc: row.description || '',
      tag: isRecent(row.created_at) ? 'Nouveau' : '',
      e: metierEmoji(row.metier),
      _real: true,
      _id: row.id || null,
      owner: row.owner || null,
      contact_email: row.contact_email || '',
      contact_nom: row.contact_nom || '',
      contact_tel: row.contact_tel || ''
    };
  }

  // Mappe une ligne « profiles » vers la forme attendue par recherche.js (artisan).
  function mapArtisan(row) {
    row = row || {};
    return {
      titre: row.nom || 'Professionnel',
      metier: row.metier || '',
      ville: row.ville || '',
      desc: row.bio || '',
      badge: (row.role === 'sous-traitant') ? 'Sous-traitant' : (row.note && row.note >= 5 ? 'Vérifié' : ''),
      e: metierEmoji(row.metier),
      note: (typeof row.note === 'number') ? row.note : 0,
      avis: 0,
      _real: true,
      _id: row.id || null,
      email: row.email || '',
      telephone: row.telephone || ''
    };
  }

  // Applique les filtres texte (.ilike) communs sur une requête.
  function applyFilters(query, opts) {
    opts = opts || {};
    if (opts.ville) query = query.ilike('ville', '%' + opts.ville + '%');
    if (opts.metier) query = query.ilike('metier', '%' + opts.metier + '%');
    // Recherche libre : on cible le titre/description (chantiers) ou nom/bio (profils)
    return query;
  }

  // --- API publique ---------------------------------------------------------

  // Utilisateur connecté (objet user) ou null.
  BLDB.session = function () { return currentUser(); };

  // Liste les chantiers réels (récents d'abord). Renvoie [] sur toute erreur.
  BLDB.listChantiers = function (opts) {
    if (!client) return emptyArr();
    opts = opts || {};
    try {
      var q = client.from('chantiers').select('*').order('created_at', { ascending: false });
      q = applyFilters(q, opts);
      if (opts.q) {
        var term = '%' + opts.q + '%';
        q = q.or('titre.ilike.' + term + ',description.ilike.' + term + ',metier.ilike.' + term + ',ville.ilike.' + term);
      }
      if (opts.limit) q = q.limit(opts.limit);
      return q.then(function (res) {
        if (!res || res.error || !res.data) return [];
        return res.data.map(mapChantier);
      }).catch(function () { return []; });
    } catch (e) { return emptyArr(); }
  };

  // Crée un chantier (owner = utilisateur courant). Renvoie la ligne créée ou null.
  BLDB.createChantier = function (obj) {
    if (!client) return nullVal();
    obj = obj || {};
    return currentUser().then(function (user) {
      if (!user) return null;
      var row = {
        owner: user.id,
        titre: obj.titre || 'Chantier',
        metier: obj.metier || null,
        ville: obj.ville || null,
        code_postal: obj.code_postal || null,
        budget: obj.budget || null,
        delai: obj.delai || null,
        description: obj.description || null,
        contact_nom: obj.contact_nom || null,
        contact_tel: obj.contact_tel || null,
        contact_email: obj.contact_email || user.email || null
      };
      return client.from('chantiers').insert(row).select().single().then(function (res) {
        if (!res || res.error || !res.data) return null;
        return res.data;
      }).catch(function () { return null; });
    }).catch(function () { return null; });
  };

  // Mes chantiers (les plus récents d'abord). Renvoie [] si non connecté / erreur.
  BLDB.myChantiers = function () {
    if (!client) return emptyArr();
    return currentUser().then(function (user) {
      if (!user) return [];
      return client.from('chantiers').select('*')
        .eq('owner', user.id)
        .order('created_at', { ascending: false })
        .then(function (res) {
          if (!res || res.error || !res.data) return [];
          return res.data;
        }).catch(function () { return []; });
    }).catch(function () { return []; });
  };

  // Profil de l'utilisateur courant ou null.
  BLDB.getProfile = function () {
    if (!client) return nullVal();
    return currentUser().then(function (user) {
      if (!user) return null;
      return client.from('profiles').select('*').eq('id', user.id).maybeSingle().then(function (res) {
        if (!res || res.error || !res.data) return null;
        return res.data;
      }).catch(function () { return null; });
    }).catch(function () { return null; });
  };

  // Enregistre (upsert) le profil de l'utilisateur courant. Renvoie la ligne ou null.
  BLDB.saveProfile = function (obj) {
    if (!client) return nullVal();
    obj = obj || {};
    return currentUser().then(function (user) {
      if (!user) return null;
      var row = {
        id: user.id,
        role: obj.role || 'artisan',
        nom: obj.nom || null,
        metier: obj.metier || null,
        ville: obj.ville || null,
        code_postal: obj.code_postal || null,
        telephone: obj.telephone || null,
        email: obj.email || user.email || null,
        bio: obj.bio || null,
        site: obj.site || null,
        updated_at: new Date().toISOString()
      };
      return client.from('profiles').upsert(row, { onConflict: 'id' }).select().single().then(function (res) {
        if (!res || res.error || !res.data) return null;
        return res.data;
      }).catch(function () { return null; });
    }).catch(function () { return null; });
  };

  // Annuaire des pros (artisans + sous-traitants). Renvoie [] sur erreur.
  BLDB.listArtisans = function (opts) {
    if (!client) return emptyArr();
    opts = opts || {};
    try {
      var q = client.from('profiles').select('*')
        .in('role', ['artisan', 'sous-traitant'])
        .order('created_at', { ascending: false });
      if (opts.ville) q = q.ilike('ville', '%' + opts.ville + '%');
      if (opts.metier) q = q.ilike('metier', '%' + opts.metier + '%');
      if (opts.q) {
        var term = '%' + opts.q + '%';
        q = q.or('nom.ilike.' + term + ',bio.ilike.' + term + ',metier.ilike.' + term + ',ville.ilike.' + term);
      }
      if (opts.limit) q = q.limit(opts.limit);
      return q.then(function (res) {
        if (!res || res.error || !res.data) return [];
        return res.data.map(mapArtisan);
      }).catch(function () { return []; });
    } catch (e) { return emptyArr(); }
  };

  window.BLDB = BLDB;
})();
