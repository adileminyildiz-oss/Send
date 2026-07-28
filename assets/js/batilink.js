// BâtiLink — comportements partagés (thème, menu mobile, reveal, recherche accueil).
'use strict';

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

  var user = sessionUser();
  var root = document.documentElement;
  if (!user) { root.classList.add('is-guest'); return; } // état public : on ne change rien
  root.classList.add('is-auth');

  // « Connexion » / « Mon compte » -> « Mon espace » (chemins absolus, valides partout)
  document.querySelectorAll('a[href*="compte/index.html"], a[href$="/compte/"]').forEach(function (a) {
    a.setAttribute('href', '/espace/index.html');
    if (/connexion|mon compte|se connecter|inscription/i.test(a.textContent)) a.textContent = 'Mon espace';
  });

  // Bouton Déconnexion dans la barre de droite de l'en-tête
  var right = document.querySelector('header.site .right');
  if (right && !right.querySelector('[data-logout]')) {
    var btn = document.createElement('button');
    btn.className = 'btn btn-ghost';
    btn.type = 'button';
    btn.setAttribute('data-logout', '');
    btn.textContent = 'Déconnexion';
    var burger = right.querySelector('#burger');
    if (burger) right.insertBefore(btn, burger); else right.appendChild(btn);
    btn.addEventListener('click', function () {
      if (window.supabase && window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
        try { window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY).auth.signOut(); } catch (e) {}
      }
      clearSession();
      window.location.href = '/index.html';
    });
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
