// ---------------------------------------------------------------------------
// BâtiLink — carte des chantiers (carte/index.html).
//
// Affiche les chantiers publiés sous forme de marqueurs sur une carte de France.
// Chaque chantier est géocodé à la volée à partir de sa commune.
//
// DÉPENDANCES EXTERNES (chargées UNIQUEMENT sur cette page « opt-in ») :
//   • Leaflet 1.9.4 (CDN unpkg)         — moteur de carte interactive (window.L)
//   • Tuiles OpenStreetMap              — fond cartographique (attribution requise)
//   • Base Adresse Nationale (BAN)      — géocodage gratuit, sans clé, CORS ouvert
//     https://api-adresse.data.gouv.fr/search/
//
// PRINCIPE : « dégrade gracieusement ». Aucune erreur ne doit blanchir la page :
//   - si Leaflet n'est pas là → message de repli dans #map, on s'arrête ;
//   - si aucun chantier n'est géolocalisable → message informatif ;
//   - toute erreur réseau/géocodage sur un item → l'item est simplement ignoré.
// ---------------------------------------------------------------------------
(function () {
  'use strict';

  // --- Petits utilitaires sûrs ---------------------------------------------
  function $(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // Affiche un message de repli à l'intérieur du conteneur #map.
  function mapFallback(html) {
    var el = $('map');
    if (!el) return;
    el.innerHTML = '<div class="map-fallback"><div class="inner">' + html + '</div></div>';
  }

  // Met à jour la petite pastille « N chantiers localisés ».
  function setCount(html, isErr) {
    var el = $('carteCount');
    if (!el) return;
    el.innerHTML = html;
    el.hidden = false;
    if (isErr) el.className = 'carte-count err';
    else el.className = 'carte-count';
  }

  // Tout le démarrage est protégé : on ne « throw » jamais vers la page.
  try {
    start();
  } catch (e) {
    mapFallback('La carte n\'a pas pu s\'afficher. Vous pouvez consulter les projets dans la '
      + '<a href="../recherche/index.html?type=chantiers">liste des chantiers</a>.');
  }

  // -------------------------------------------------------------------------
  function start() {
    // 1) Leaflet est-il disponible ? (le <script> unpkg peut avoir échoué).
    if (!window.L) {
      mapFallback('<span class="e">🗺️</span>La carte interactive n\'a pas pu se charger '
        + '(ressource externe indisponible). Consultez plutôt la '
        + '<a href="../recherche/index.html?type=chantiers">liste des chantiers</a>.');
      return;
    }

    // 2) Prépare le conteneur (on retire le message « Chargement… »).
    var mapEl = $('map');
    if (!mapEl) return;
    mapEl.innerHTML = '';

    // 3) Récupère les chantiers : réels (Supabase) devant les exemples.
    collectChantiers().then(function (items) {
      renderMap(items);
    }).catch(function () {
      // En dernier recours : au moins les exemples.
      renderMap(sampleChantiers());
    });
  }

  // --- Sources de données ---------------------------------------------------
  function sampleChantiers() {
    try {
      var d = window.BATILINK_DATA;
      if (d && d.chantiers && Array.isArray(d.chantiers.items)) return d.chantiers.items.slice();
    } catch (e) {}
    return [];
  }

  // Renvoie une Promise d'un tableau fusionné (réels + exemples).
  function collectChantiers() {
    var samples = sampleChantiers();
    if (window.BLDB && window.BLDB.ready && typeof window.BLDB.listChantiers === 'function') {
      try {
        return window.BLDB.listChantiers({ limit: 100 }).then(function (rows) {
          var real = Array.isArray(rows) ? rows : [];
          return real.concat(samples);
        }).catch(function () { return samples; });
      } catch (e) {
        return Promise.resolve(samples);
      }
    }
    return Promise.resolve(samples);
  }

  // --- Carte ----------------------------------------------------------------
  function renderMap(items) {
    var L = window.L;
    var map;
    try {
      map = L.map('map', { scrollWheelZoom: true }).setView([46.6, 2.4], 6);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '© OpenStreetMap'
      }).addTo(map);
    } catch (e) {
      mapFallback('La carte n\'a pas pu s\'initialiser. Consultez la '
        + '<a href="../recherche/index.html?type=chantiers">liste des chantiers</a>.');
      return;
    }

    items = Array.isArray(items) ? items : [];

    // Rien à afficher : carte de France seule + note.
    if (!items.length) {
      setCount('Aucun chantier à localiser pour l\'instant.', false);
      return;
    }

    // On ne garde que les items ayant une commune exploitable.
    var geoItems = items.filter(function (it) { return it && it.ville; });
    if (!geoItems.length) {
      setCount('Aucun chantier localisable pour l\'instant.', false);
      return;
    }

    setCount('Localisation des chantiers…', false);

    var bounds = [];
    var located = 0;
    var geocodeCache = {};   // clé (ville|cp) → {lat, lon} ou null (échec mémorisé)

    // Géocode un item ; ajoute un marqueur en cas de succès. Ne « throw » jamais.
    function processItem(it) {
      return geocode(it.ville, it.code_postal, geocodeCache).then(function (pt) {
        if (!pt) return;   // échec silencieux : on saute cet item
        try {
          var marker = L.marker([pt.lat, pt.lon]).addTo(map);
          marker.bindPopup(popupHtml(it));
          bounds.push([pt.lat, pt.lon]);
          located++;
        } catch (e) { /* marqueur ignoré */ }
      }).catch(function () { /* item ignoré */ });
    }

    // Pool d'exécution limité (~4 requêtes en parallèle) pour rester poli
    // envers l'API publique gratuite.
    runPool(geoItems, 4, processItem).then(function () {
      if (located > 0) {
        setCount('<b>' + located + '</b> chantier' + (located > 1 ? 's' : '') + ' localisé' + (located > 1 ? 's' : ''), false);
        try {
          if (bounds.length === 1) {
            map.setView(bounds[0], 12);
          } else {
            map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
          }
        } catch (e) {}
      } else {
        setCount('Aucun chantier n\'a pu être localisé pour l\'instant.', true);
      }
    });
  }

  // Contenu HTML d'un popup de marqueur.
  function popupHtml(it) {
    it = it || {};
    var titre = esc(it.titre || 'Chantier');
    var metier = it.metier ? '<div class="meta">' + esc(it.metier) + '</div>' : '';
    var ville = it.ville
      ? '<div class="meta">📍 ' + esc(it.ville) + (it.code_postal ? ' (' + esc(it.code_postal) + ')' : '') + '</div>'
      : '';
    var budget = it.budget ? '<div class="meta budget">💶 ' + esc(it.budget) + '</div>' : '';

    // Rangée réelle → fiche détaillée ; exemple → retour vers la recherche.
    var href, label;
    if (it._real && it._id) {
      href = '../chantier/index.html?id=' + encodeURIComponent(it._id);
      label = 'Voir le chantier →';
    } else {
      href = '../recherche/index.html?type=chantiers';
      label = 'Voir les chantiers →';
    }

    return '<div class="bl-pop">' +
      '<h3>' + titre + '</h3>' +
      metier + ville + budget +
      '<a class="go" href="' + href + '">' + label + '</a>' +
    '</div>';
  }

  // --- Géocodage BAN --------------------------------------------------------
  // Renvoie une Promise de {lat, lon} ou null (jamais de rejet).
  function geocode(ville, codePostal, cache) {
    var key = String(ville || '').toLowerCase().trim() + '|' + String(codePostal || '').trim();
    if (Object.prototype.hasOwnProperty.call(cache, key)) {
      return Promise.resolve(cache[key]);
    }
    if (!window.fetch || !ville) {
      cache[key] = null;
      return Promise.resolve(null);
    }

    var url = 'https://api-adresse.data.gouv.fr/search/?limit=1&type=municipality&q='
      + encodeURIComponent(ville);
    if (codePostal) url += '&postcode=' + encodeURIComponent(codePostal);

    return fetch(url).then(function (res) {
      if (!res || !res.ok) return null;
      return res.json();
    }).then(function (json) {
      var pt = null;
      try {
        if (json && json.features && json.features.length) {
          var coords = json.features[0].geometry && json.features[0].geometry.coordinates;
          if (coords && coords.length >= 2) {
            // BAN renvoie [lon, lat].
            pt = { lat: coords[1], lon: coords[0] };
          }
        }
      } catch (e) { pt = null; }
      cache[key] = pt;
      return pt;
    }).catch(function () {
      cache[key] = null;
      return null;
    });
  }

  // --- Pool d'exécution (concurrence limitée) -------------------------------
  // Exécute `worker(item)` (qui renvoie une Promise) sur `list`, au plus
  // `size` en parallèle. Résout quand tout est terminé. N'échoue jamais.
  function runPool(list, size, worker) {
    return new Promise(function (resolve) {
      var i = 0, active = 0, done = 0;
      var total = list.length;
      if (!total) { resolve(); return; }
      size = Math.max(1, Math.min(size, total));

      function next() {
        while (active < size && i < total) {
          var item = list[i++];
          active++;
          Promise.resolve().then(function () { return worker(item); })
            .then(finish, finish);
        }
      }
      function finish() {
        active--; done++;
        if (done >= total) { resolve(); return; }
        next();
      }
      next();
    });
  }

})();
