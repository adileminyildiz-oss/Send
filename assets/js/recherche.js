// BâtiLink — page de résultats (chantiers, aides, artisans, sous-traitance).
// Fusionne les données RÉELLES (Supabase via window.BLDB) devant les données
// d'exemple (window.BATILINK_DATA). Si Supabase n'est pas prêt (tables absentes,
// hors ligne, non connecté), la page retombe simplement sur les exemples.
'use strict';
(function () {
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var DATA = window.BATILINK_DATA || {};
  var params = new URLSearchParams(location.search);
  var type = params.get('type');
  if (!DATA[type]) type = 'chantiers';
  var cfg = DATA[type];

  var state = { q: (params.get('q') || '').toLowerCase(), ville: params.get('ville') || '', metier: '' };

  // Rangées réelles (chargées depuis Supabase) et état de connexion.
  var realItems = [];
  var loggedIn = false;

  // Titre + fil d'ariane
  var TITLES = {
    chantiers: ['Chantiers disponibles', 'Des projets de travaux près de chez vous. Filtrez par métier et localisation.'],
    aides: ['Aides & subventions', 'Les dispositifs de financement mobilisables pour vos travaux et vos clients.'],
    artisans: ['Annuaire des artisans', 'Des professionnels du bâtiment vérifiés, avec avis et disponibilités.'],
    'sous-traitance': ['Offres de sous-traitance', 'Lots à pourvoir et disponibilités entre professionnels du BTP.']
  };
  var t = TITLES[type];
  $('#pageTitle').textContent = t[0];
  $('#pageSub').textContent = t[1];
  $('#crumbType').textContent = cfg.label;
  document.title = t[0] + ' — BâtiLink';

  // Onglets univers (navigation entre types)
  var TYPES = ['chantiers', 'aides', 'artisans', 'sous-traitance'];
  $('#typeTabs').innerHTML = TYPES.map(function (k) {
    return '<button class="fchip ' + (k === type ? 'on' : '') + '" data-type="' + k + '">' + DATA[k].label + '</button>';
  }).join('');
  $('#typeTabs').querySelectorAll('[data-type]').forEach(function (b) {
    b.addEventListener('click', function () { location.href = 'index.html?type=' + b.dataset.type; });
  });

  // Filtres métier (dérivés des données)
  var metiers = Array.from(new Set(cfg.items.map(function (i) { return i.metier; })));
  $('#metierChips').innerHTML = '<button class="fchip on" data-metier="">Tous</button>' +
    metiers.map(function (m) { return '<button class="fchip" data-metier="' + m + '">' + m + '</button>'; }).join('');
  $('#metierChips').querySelectorAll('[data-metier]').forEach(function (b) {
    b.addEventListener('click', function () {
      state.metier = b.dataset.metier;
      $('#metierChips').querySelectorAll('.fchip').forEach(function (x) { x.classList.toggle('on', x === b); });
      render();
    });
  });

  // Recherche + ville
  var qinput = $('#q'); qinput.value = params.get('q') || '';
  qinput.addEventListener('input', function () { state.q = qinput.value.trim().toLowerCase(); render(); });
  var villeSel = $('#ville');
  var villes = Array.from(new Set(cfg.items.map(function (i) { return i.ville; })));
  villeSel.innerHTML = '<option value="">Toutes les localisations</option>' +
    villes.map(function (v) { return '<option' + (v === state.ville ? ' selected' : '') + '>' + v + '</option>'; }).join('');
  villeSel.addEventListener('change', function () { state.ville = villeSel.value; render(); });

  function stars(n) {
    var s = ''; for (var i = 0; i < 5; i++) s += i < n ? '★' : '☆'; return s;
  }

  // Carte d'une annonce.
  //   it   : l'objet donnée
  //   idx  : index d'origine dans BATILINK_DATA (pour le lien detail.html)
  //   real : true si la rangée provient de Supabase (pas de page détail)
  function cardHtml(it, idx, real) {
    // Les rangées réelles n'ont pas de page détail (index basé sur les exemples).
    var d = real ? '#' : ('detail.html?type=' + type + '&id=' + idx);
    var titre = real
      ? '<span>' + it.titre + '</span>'
      : '<a href="' + d + '" style="color:inherit">' + it.titre + '</a>';
    var realTag = real ? '<span class="pill ok">Réel</span>' : '';

    if (cfg.kind === 'artisan') {
      // Contact d'un pro réel : mailto si email connu, sinon compte.
      var contactHref = real ? (it.email ? ('mailto:' + it.email) : '../compte/index.html') : d;
      return '<article class="rcard">' +
        '<div class="ric">' + it.e + '</div>' +
        '<div class="rmain"><div class="rtop"><h3>' + titre + '</h3>' +
          realTag +
          (it.badge ? '<span class="pill ok">' + it.badge + '</span>' : '') +
          '<span class="pill">' + it.metier + '</span></div>' +
        '<div class="rdesc">' + it.desc + '</div>' +
        '<div class="rmeta"><span>📍 <b>' + it.ville + '</b></span>' +
          (real ? '' : '<span class="stars-sm">' + stars(it.note) + ' <b>' + it.note + '/5</b></span><span>' + it.avis + ' avis</span>') +
          (real ? '' : '<a href="' + d + '" style="color:var(--hi);font-weight:600">Voir le profil →</a>') + '</div></div>' +
        '<div class="rside"><a class="btn btn-hi" href="' + contactHref + '">Contacter</a></div></article>';
    }
    if (cfg.kind === 'aide') {
      return '<article class="rcard">' +
        '<div class="ric">' + it.e + '</div>' +
        '<div class="rmain"><div class="rtop"><h3>' + titre + '</h3>' +
          (it.tag ? '<span class="pill hi">' + it.tag + '</span>' : '') +
          '<span class="pill">' + it.metier + '</span></div>' +
        '<div class="rdesc">' + it.desc + '</div>' +
        '<div class="rmeta"><span>🗺️ <b>' + it.ville + '</b></span><span>⏱️ ' + it.delai + '</span><a href="' + d + '" style="color:var(--hi);font-weight:600">En savoir plus →</a></div></div>' +
        '<div class="rside"><span class="budget">' + it.budget + '</span><a class="btn btn-ghost" href="' + d + '">Détails</a></div></article>';
    }
    // offre (chantier / sous-traitance)
    // « Répondre » sur une annonce réelle : mailto si connecté et email connu,
    // sinon invitation à créer un compte / se connecter.
    var repHref, repLabel = 'Répondre';
    if (real) {
      if (loggedIn && it.contact_email) repHref = 'mailto:' + it.contact_email;
      else if (loggedIn) repHref = '../espace/index.html';
      else { repHref = '../compte/index.html'; repLabel = 'Se connecter pour répondre'; }
    } else {
      repHref = d;
    }
    return '<article class="rcard">' +
      '<div class="ric">' + it.e + '</div>' +
      '<div class="rmain"><div class="rtop"><h3>' + titre + '</h3>' +
        realTag +
        (it.tag ? '<span class="pill hi">' + it.tag + '</span>' : '') +
        '<span class="pill">' + it.metier + '</span></div>' +
      '<div class="rdesc">' + it.desc + '</div>' +
      '<div class="rmeta"><span>📍 <b>' + it.ville + '</b></span><span>⏱️ ' + it.delai + '</span>' +
        (real ? '' : '<a href="' + d + '" style="color:var(--hi);font-weight:600">Voir le détail →</a>') + '</div></div>' +
      '<div class="rside">' + (it.budget ? '<span class="budget">' + it.budget + '</span>' : '') +
        '<a class="btn btn-hi" href="' + repHref + '">' + repLabel + '</a></div></article>';
  }

  function matches(it) {
    if (state.metier && it.metier !== state.metier) return false;
    if (state.ville && it.ville !== state.ville) return false;
    if (state.q) {
      var hay = ((it.titre || '') + ' ' + (it.desc || '') + ' ' + (it.metier || '') + ' ' + (it.ville || '')).toLowerCase();
      if (hay.indexOf(state.q) === -1) return false;
    }
    return true;
  }

  function render() {
    var html = '';
    var n = 0;
    // 1) Rangées réelles (Supabase) — affichées en premier.
    realItems.forEach(function (it) {
      if (!matches(it)) return;
      html += cardHtml(it, -1, true);
      n++;
    });
    // 2) Rangées d'exemple — conservent leur index d'origine (liens détail).
    cfg.items.forEach(function (it, idx) {
      if (!matches(it)) return;
      html += cardHtml(it, idx, false);
      n++;
    });

    $('#count').innerHTML = '<b>' + n + '</b> résultat' + (n > 1 ? 's' : '') +
      (realItems.length ? ' <span style="color:var(--muted-2)">· dont ' + realItems.length + ' réel' + (realItems.length > 1 ? 's' : '') + '</span>' : '');
    $('#results').innerHTML = n ? html : '';
    $('#empty').style.display = n ? 'none' : 'block';
  }

  render();

  // --- Chargement des données réelles (non bloquant) ------------------------
  if (window.BLDB && window.BLDB.ready) {
    var opts = { q: state.q || '', ville: state.ville || '', limit: 100 };
    // Fetch selon le type d'univers.
    var loader = null;
    if (type === 'chantiers' || type === 'sous-traitance') {
      loader = window.BLDB.listChantiers(opts);
    } else if (type === 'artisans') {
      loader = window.BLDB.listArtisans(opts);
    }

    // État de connexion (pour le bouton « Répondre »).
    window.BLDB.session().then(function (u) { loggedIn = !!u; if (realItems.length) render(); }).catch(function () {});

    if (loader) {
      loader.then(function (rows) {
        realItems = Array.isArray(rows) ? rows : [];
        var fn = document.getElementById('footNote');
        if (fn) fn.textContent = realItems.length ? 'DONNÉES RÉELLES + EXEMPLES' : 'DONNÉES D\'EXEMPLE';
        render();
      }).catch(function () { /* on garde les exemples */ });
    }
  } else {
    var fn0 = document.getElementById('footNote');
    if (fn0) fn0.textContent = 'DONNÉES D\'EXEMPLE';
  }
})();
