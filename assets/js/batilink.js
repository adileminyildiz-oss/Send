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
