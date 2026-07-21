// BâtiLink — page de résultats (chantiers, aides, artisans, sous-traitance).
'use strict';
(function () {
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var DATA = window.BATILINK_DATA || {};
  var params = new URLSearchParams(location.search);
  var type = params.get('type');
  if (!DATA[type]) type = 'chantiers';
  var cfg = DATA[type];

  var state = { q: (params.get('q') || '').toLowerCase(), ville: params.get('ville') || '', metier: '' };

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

  function cardHtml(it) {
    if (cfg.kind === 'artisan') {
      return '<article class="rcard">' +
        '<div class="ric">' + it.e + '</div>' +
        '<div class="rmain"><div class="rtop"><h3>' + it.titre + '</h3>' +
          (it.badge ? '<span class="pill ok">' + it.badge + '</span>' : '') +
          '<span class="pill">' + it.metier + '</span></div>' +
        '<div class="rdesc">' + it.desc + '</div>' +
        '<div class="rmeta"><span>📍 <b>' + it.ville + '</b></span><span class="stars-sm">' + stars(it.note) + ' <b>' + it.note + '/5</b></span><span>' + it.avis + ' avis</span></div></div>' +
        '<div class="rside"><a class="btn btn-hi" href="../compte/index.html">Contacter</a></div></article>';
    }
    if (cfg.kind === 'aide') {
      return '<article class="rcard">' +
        '<div class="ric">' + it.e + '</div>' +
        '<div class="rmain"><div class="rtop"><h3>' + it.titre + '</h3>' +
          (it.tag ? '<span class="pill hi">' + it.tag + '</span>' : '') +
          '<span class="pill">' + it.metier + '</span></div>' +
        '<div class="rdesc">' + it.desc + '</div>' +
        '<div class="rmeta"><span>🗺️ <b>' + it.ville + '</b></span><span>⏱️ ' + it.delai + '</span></div></div>' +
        '<div class="rside"><span class="budget">' + it.budget + '</span><a class="btn btn-ghost" href="../compte/index.html">Vérifier l\'éligibilité</a></div></article>';
    }
    // offre (chantier / sous-traitance)
    return '<article class="rcard">' +
      '<div class="ric">' + it.e + '</div>' +
      '<div class="rmain"><div class="rtop"><h3>' + it.titre + '</h3>' +
        (it.tag ? '<span class="pill hi">' + it.tag + '</span>' : '') +
        '<span class="pill">' + it.metier + '</span></div>' +
      '<div class="rdesc">' + it.desc + '</div>' +
      '<div class="rmeta"><span>📍 <b>' + it.ville + '</b></span><span>⏱️ ' + it.delai + '</span></div></div>' +
      '<div class="rside"><span class="budget">' + it.budget + '</span><a class="btn btn-hi" href="../compte/index.html">Répondre</a></div></article>';
  }

  function render() {
    var list = cfg.items.filter(function (it) {
      if (state.metier && it.metier !== state.metier) return false;
      if (state.ville && it.ville !== state.ville) return false;
      if (state.q) {
        var hay = (it.titre + ' ' + it.desc + ' ' + it.metier + ' ' + it.ville).toLowerCase();
        if (hay.indexOf(state.q) === -1) return false;
      }
      return true;
    });
    $('#count').innerHTML = '<b>' + list.length + '</b> résultat' + (list.length > 1 ? 's' : '');
    $('#results').innerHTML = list.length
      ? list.map(cardHtml).join('')
      : '';
    $('#empty').style.display = list.length ? 'none' : 'block';
  }

  render();
})();
