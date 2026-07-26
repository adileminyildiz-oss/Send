// ---------------------------------------------------------------------------
// BâtiLink — window.BLVerify : vérification d'entreprise (SIRET/SIREN/nom).
//
// S'appuie sur l'API publique et GRATUITE (sans clé) « recherche-entreprises »
// (annuaire des entreprises, data.gouv.fr) :
//   https://recherche-entreprises.api.gouv.fr/search?q=<SIREN|SIRET|nom>
//
// CORS est autorisé par cette API : l'appel se fait directement depuis le
// navigateur. Limite indicative : 7 requêtes/seconde.
//
// Principe « dégrade gracieusement » : AUCUNE méthode ne « throw ». En cas
// d'erreur réseau / CORS / réponse inattendue, lookup() renvoie null (promesse
// résolue), pour ne jamais casser la page appelante.
// ---------------------------------------------------------------------------
(function () {
  'use strict';

  var API = 'https://recherche-entreprises.api.gouv.fr/search';

  var BLVerify = {};

  // Ne garde que les chiffres d'une chaîne (utile pour SIREN/SIRET).
  function digits(s) { return String(s == null ? '' : s).replace(/\D/g, ''); }

  // Premier champ non vide parmi une liste de clés d'un objet.
  function pick(o) {
    if (!o) return '';
    for (var i = 1; i < arguments.length; i++) {
      var v = o[arguments[i]];
      if (v != null && v !== '') return v;
    }
    return '';
  }

  // Construit une adresse lisible à partir du siège (champs tolérants).
  function formatAdresse(siege) {
    if (!siege || typeof siege !== 'object') return '';
    // L'API expose souvent une adresse déjà formatée.
    var direct = pick(siege, 'adresse', 'geo_adresse', 'adresse_complete');
    if (direct) return String(direct);
    var parts = [];
    var num = pick(siege, 'numero_voie');
    var voie = pick(siege, 'type_voie', 'libelle_voie');
    var libVoie = pick(siege, 'libelle_voie');
    var ligne1 = [num, voie === libVoie ? voie : (voie + ' ' + libVoie)].join(' ').trim();
    if (ligne1) parts.push(ligne1);
    var cp = pick(siege, 'code_postal');
    var ville = pick(siege, 'libelle_commune', 'commune', 'ville');
    var ligne2 = [cp, ville].filter(Boolean).join(' ').trim();
    if (ligne2) parts.push(ligne2);
    return parts.join(', ');
  }

  // Traduit l'état administratif ('A' actif / 'F'|'C' fermé) en libellé FR.
  function formatEtat(v) {
    var s = String(v == null ? '' : v).toUpperCase();
    if (s === 'A' || s === 'ACTIF') return 'actif';
    if (s === 'F' || s === 'C' || s === 'FERME' || s === 'CESSE') return 'fermé';
    return s ? s.toLowerCase() : '';
  }

  // Premier dirigeant lisible (personne physique de préférence), ou ''.
  function formatDirigeant(list) {
    if (!Array.isArray(list) || !list.length) return '';
    for (var i = 0; i < list.length; i++) {
      var d = list[i] || {};
      var nom = pick(d, 'nom', 'nom_naissance');
      var prenom = pick(d, 'prenoms', 'prenom');
      var raison = pick(d, 'denomination', 'nom_complet');
      if (nom || prenom) return (String(prenom) + ' ' + String(nom)).trim();
      if (raison) return String(raison);
    }
    return '';
  }

  // Normalise un « result » de l'API vers un objet stable.
  //   { siren, siret, denomination, adresse, activite, activiteCode, etat, dirigeant }
  function normalize(r) {
    if (!r || typeof r !== 'object') return null;
    var siege = r.siege || r.etablissement_siege || {};
    return {
      siren: digits(pick(r, 'siren')),
      siret: digits(pick(siege, 'siret')),
      denomination: String(pick(r, 'nom_complet', 'nom_raison_sociale', 'denomination', 'nom') || ''),
      adresse: formatAdresse(siege),
      activite: String(pick(r, 'libelle_activite_principale') ||
        pick(siege, 'libelle_activite_principale') ||
        pick(r, 'activite_principale') ||
        pick(siege, 'activite_principale') || ''),
      activiteCode: String(pick(r, 'activite_principale') || pick(siege, 'activite_principale') || ''),
      etat: formatEtat(pick(siege, 'etat_administratif') || pick(r, 'etat_administratif')),
      dirigeant: formatDirigeant(r.dirigeants)
    };
  }

  // Choisit le meilleur résultat. Si la requête est un SIREN/SIRET, on tente une
  // correspondance exacte ; sinon on prend le premier résultat.
  function bestMatch(results, query) {
    if (!Array.isArray(results) || !results.length) return null;
    var num = digits(query);
    if (num.length === 9 || num.length === 14) {
      for (var i = 0; i < results.length; i++) {
        var r = results[i] || {};
        var siege = r.siege || {};
        if (digits(r.siren) === num) return r;
        if (digits(siege.siret) === num) return r;
        if (num.length === 14 && digits(siege.siret) === num) return r;
      }
    }
    return results[0];
  }

  // --- API publique ---------------------------------------------------------

  // lookup(query) -> Promise<objet normalisé | null>. Ne « throw » jamais.
  BLVerify.lookup = function (query) {
    var q = String(query == null ? '' : query).trim();
    if (!q) return Promise.resolve(null);
    // Pour un SIREN/SIRET, on interroge avec les seuls chiffres (plus fiable).
    var num = digits(q);
    var term = (num.length === 9 || num.length === 14) ? num : q;
    var url = API + '?q=' + encodeURIComponent(term) + '&page=1&per_page=5';
    try {
      return fetch(url, { headers: { 'Accept': 'application/json' } })
        .then(function (res) {
          if (!res || !res.ok) return null;
          return res.json().catch(function () { return null; });
        })
        .then(function (data) {
          if (!data) return null;
          var results = data.results || data.etablissements || [];
          var r = bestMatch(results, q);
          return r ? normalize(r) : null;
        })
        .catch(function () { return null; });
    } catch (e) {
      return Promise.resolve(null);
    }
  };

  // isBatiment(activite) -> booléen au mieux : l'activité/NAF ressemble-t-elle à
  // du bâtiment / BTP ? (aide facultative, jamais bloquante)
  BLVerify.isBatiment = function (activite) {
    var s = String(activite == null ? '' : activite).toLowerCase();
    if (!s) return false;
    // Codes NAF section F (construction) : 41, 42, 43. Ex : "43.99C", "4321A".
    var code = s.replace(/[^0-9]/g, '');
    if (/^4[123]/.test(code)) return true;
    // Repli sur des mots-clés du libellé.
    return /b[aâ]timent|construction|travaux|ma[çc]onn|couvertur|toiture|plomb|[ée]lectric|menuis|peinture|charpent|terrass|g[ée]nie civil|r[ée]novat|isolat|chauffag|carrelag|pl[aâ]trerie|fa[çc]ade/.test(s);
  };

  window.BLVerify = BLVerify;
})();
