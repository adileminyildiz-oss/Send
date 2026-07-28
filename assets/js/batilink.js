// BâtiLink — comportements partagés (thème, menu mobile, reveal, recherche accueil).
'use strict';

// PWA : manifest + couleur de thème injectés partout, et enregistrement du service worker.
(function () {
  try {
    var head = document.head;
    if (head && !document.querySelector('link[rel="manifest"]')) {
      var m = document.createElement('link'); m.rel = 'manifest'; m.href = '/manifest.json'; head.appendChild(m);
    }
    if (head && !document.querySelector('meta[name="theme-color"]')) {
      var t = document.createElement('meta'); t.name = 'theme-color'; t.content = '#0f1115'; head.appendChild(t);
    }
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('/sw.js').catch(function () {});
      });
    }
  } catch (e) {}
})();

// Accessibilité : lien d'évitement « Aller au contenu » injecté en tête de page.
(function () {
  try {
    if (document.querySelector('.skip-link')) return;
    var target = document.querySelector('main') || document.querySelector('section');
    if (!target) return;
    if (!target.id) target.id = 'contenu';
    var a = document.createElement('a');
    a.href = '#' + target.id;
    a.className = 'skip-link';
    a.textContent = 'Aller au contenu';
    if (document.body) document.body.insertBefore(a, document.body.firstChild);
  } catch (e) {}
})();

// Thème clair / sombre
(function () {
  var root = document.documentElement;
  var btn = document.getElementById('theme');
  function curDark() {
    var a = root.getAttribute('data-theme');
    if (a) return a === 'dark';
    return matchMedia('(prefers-color-scheme: dark)').matches;
  }
  if (btn) btn.addEventListener('click', function () {
    root.setAttribute('data-theme', curDark() ? 'light' : 'dark');
  });
})();

// Menu mobile (burger)
(function () {
  var b = document.getElementById('burger');
  var m = document.getElementById('mobileNav');
  if (!b || !m) return;
  b.addEventListener('click', function () {
    var open = m.classList.toggle('open');
    b.classList.toggle('on', open);
    b.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  m.querySelectorAll('a').forEach(function (a) {
    a.addEventListener('click', function () { m.classList.remove('open'); b.classList.remove('on'); });
  });
})();

// Révélation au défilement
(function () {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
    document.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('in'); });
    return;
  }
  var io = new IntersectionObserver(function (en) {
    en.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target); } });
  }, { threshold: .12 });
  document.querySelectorAll('.reveal').forEach(function (el, i) {
    el.style.transitionDelay = (Math.min(i % 4, 3) * 60) + 'ms';
    io.observe(el);
  });
})();

// Favoris (localStorage) — partagés entre recherche, fiche détail et espace client
window.BLFav = (function () {
  var KEY = 'batilink_favoris';
  function list() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } }
  function save(a) { try { localStorage.setItem(KEY, JSON.stringify(a)); } catch (e) {} }
  function keyOf(f) { return f.type + ':' + f.id; }
  return {
    list: list,
    has: function (type, id) { return list().some(function (f) { return f.type === type && String(f.id) === String(id); }); },
    toggle: function (fav) {
      var a = list();
      var i = a.findIndex(function (f) { return keyOf(f) === keyOf(fav); });
      if (i >= 0) { a.splice(i, 1); save(a); return false; }
      a.push(fav); save(a); return true;
    },
    remove: function (type, id) {
      save(list().filter(function (f) { return !(f.type === type && String(f.id) === String(id)); }));
    }
  };
})();

// En-tête conscient de la session : distingue l'état CONNECTÉ de l'état PUBLIC.
// Détecte le jeton Supabase stocké localement (fonctionne même sans supabase-js).
(function () {
  function sessionUser() {
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (!/^sb-.*-auth-token$/.test(k)) continue;
        var raw = localStorage.getItem(k); if (!raw) continue;
        var v = JSON.parse(raw);
        var s = (v && v.access_token) ? v : (v && v.currentSession) ? v.currentSession : null;
        if (!s || !s.access_token) continue;
        if (s.expires_at && (s.expires_at * 1000) < Date.now()) continue; // session expirée
        return (s.user && s.user.email) ? s.user.email : true;
      }
    } catch (e) {}
    return null;
  }
  function clearSession() {
    try {
      var keys = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (/^sb-.*-auth-token$/.test(k)) keys.push(k);
      }
      keys.forEach(function (k) { localStorage.removeItem(k); });
    } catch (e) {}
  }

  function doLogout() {
    if (window.supabase && window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
      try { window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY).auth.signOut(); } catch (e) {}
    }
    clearSession();
    window.location.href = '/index.html';
  }

  var user = sessionUser();
  var root = document.documentElement;
  if (!user) { root.classList.add('is-guest'); return; } // état public : on ne change rien
  root.classList.add('is-auth');

  var right = document.querySelector('header.site .right');

  // « Connexion » / « Mon compte » -> « Mon espace » (chemins absolus, valides partout).
  // Le lien de compte situé dans la barre de droite devient le menu déroulant ci-dessous.
  document.querySelectorAll('a[href*="compte/index.html"], a[href$="/compte/"]').forEach(function (a) {
    if (right && right.contains(a)) return;
    a.setAttribute('href', '/espace/index.html');
    if (/connexion|mon compte|se connecter|inscription/i.test(a.textContent)) a.textContent = 'Mon espace';
  });

  // Menu déroulant « Mon espace ▾ » dans la barre de droite de l'en-tête.
  if (right && !right.querySelector('.bl-menu')) {
    var menu = document.createElement('div');
    menu.className = 'bl-menu';

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-ghost bl-menu-btn';
    btn.setAttribute('aria-haspopup', 'true');
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = 'Mon espace <span class="bl-caret" aria-hidden="true">▾</span>';

    var list = document.createElement('div');
    list.className = 'bl-menu-list';
    list.setAttribute('role', 'menu');

    var links = [
      ['Mon espace', '/espace/index.html'],
      ['Messagerie', '/messages/index.html'],
      ['Mes devis', '/devis/index.html']
    ];
    links.forEach(function (it) {
      var a = document.createElement('a');
      a.className = 'bl-menu-item';
      a.setAttribute('role', 'menuitem');
      a.href = it[1];
      a.textContent = it[0];
      list.appendChild(a);
    });

    var sep = document.createElement('div');
    sep.className = 'bl-menu-sep';
    list.appendChild(sep);

    var logout = document.createElement('button');
    logout.type = 'button';
    logout.className = 'bl-menu-item bl-menu-logout';
    logout.setAttribute('role', 'menuitem');
    logout.setAttribute('data-logout', '');
    logout.textContent = 'Déconnexion';
    list.appendChild(logout);

    menu.appendChild(btn);
    menu.appendChild(list);

    // Retire le lien de compte devenu redondant dans la barre de droite.
    var acct = right.querySelector('a[href*="compte"], a[href*="espace/index.html"]');
    if (acct) acct.parentNode.removeChild(acct);

    var burger = right.querySelector('#burger');
    if (burger) right.insertBefore(menu, burger); else right.appendChild(menu);

    function closeMenu() { menu.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); }
    function openMenu() { menu.classList.add('open'); btn.setAttribute('aria-expanded', 'true'); }

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (menu.classList.contains('open')) closeMenu(); else openMenu();
    });
    document.addEventListener('click', function (e) { if (!menu.contains(e.target)) closeMenu(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' || e.keyCode === 27) { closeMenu(); btn.focus(); }
    });

    logout.addEventListener('click', doLogout);
  }
})();

// Recherche de l'accueil : onglets + redirection vers la page de résultats
(function () {
  var tabs = document.getElementById('tabs');
  if (!tabs) return;
  var PH = {
    chantiers: 'Maçonnerie, rénovation, toiture…',
    aides: "MaPrimeRénov', TVA 5,5 %, aides régionales…",
    artisans: 'Plombier, électricien, charpentier…',
    'sous-traitance': 'Cherchez un sous-traitant par métier…'
  };
  var current = 'chantiers';
  var q = document.getElementById('q');
  var loc = document.getElementById('loc');
  tabs.addEventListener('click', function (e) {
    var t = e.target.closest('.tab'); if (!t) return;
    current = t.dataset.tab;
    tabs.querySelectorAll('.tab').forEach(function (x) { x.classList.toggle('on', x === t); });
    if (q) { q.placeholder = PH[current] || ''; q.focus(); }
  });
  function go() {
    var params = new URLSearchParams();
    params.set('type', current);
    if (q && q.value.trim()) params.set('q', q.value.trim());
    if (loc && loc.value.trim()) params.set('ville', loc.value.trim());
    window.location.href = 'recherche/index.html?' + params.toString();
  }
  var gob = document.getElementById('goSearch');
  if (gob) gob.addEventListener('click', function (e) { e.preventDefault(); go(); });
  [q, loc].forEach(function (el) {
    if (el) el.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); go(); } });
  });
  document.querySelectorAll('[data-chip]').forEach(function (c) {
    c.addEventListener('click', function () { if (q) q.value = c.textContent.trim(); go(); });
  });
})();
