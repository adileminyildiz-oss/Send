// Dropscope — interface de démonstration.
// Toutes les données ci-dessous sont FICTIVES (démo). Aucune donnée réelle.
'use strict';

const PRODUITS = [
  { id: 1,  name: 'Casque anti-bruit sans fil',   emoji: '🎧', niche: 'Tech',    price: 39.9, margin: 62, trend: 38, score: 92, ads: 41, spark: [12,18,20,28,35,52,68] },
  { id: 2,  name: 'Lampe coucher de soleil',       emoji: '💡', niche: 'Maison',  price: 19.9, margin: 71, trend: 24, score: 84, ads: 33, spark: [30,28,34,40,44,50,58] },
  { id: 3,  name: 'Sérum acide hyaluronique',      emoji: '🧴', niche: 'Beauté',  price: 24.9, margin: 68, trend: 15, score: 79, ads: 27, spark: [40,42,41,45,48,52,55] },
  { id: 4,  name: 'Gourde isotherme 1L',           emoji: '🧊', niche: 'Fitness', price: 22.5, margin: 58, trend: 12, score: 74, ads: 18, spark: [22,25,24,28,30,33,36] },
  { id: 5,  name: 'Distributeur croquettes auto',  emoji: '🐾', niche: 'Animaux', price: 44.9, margin: 55, trend: 41, score: 88, ads: 22, spark: [10,14,18,26,34,48,60] },
  { id: 6,  name: 'Mini projecteur portable',      emoji: '📽️', niche: 'Tech',    price: 59.0, margin: 49, trend: 9,  score: 70, ads: 15, spark: [38,36,40,39,42,44,45] },
  { id: 7,  name: 'Organiseur de bureau bambou',   emoji: '🗂️', niche: 'Maison',  price: 17.9, margin: 64, trend: 6,  score: 66, ads: 11, spark: [26,27,25,28,27,29,30] },
  { id: 8,  name: 'Bandes de résistance (set)',    emoji: '💪', niche: 'Fitness', price: 15.9, margin: 73, trend: 19, score: 77, ads: 24, spark: [20,22,26,29,33,37,42] },
  { id: 9,  name: 'Roll-on massage cryo',          emoji: '❄️', niche: 'Beauté',  price: 12.9, margin: 76, trend: 33, score: 83, ads: 30, spark: [14,18,22,27,34,41,49] },
  { id: 10, name: 'Support téléphone voiture',     emoji: '📱', niche: 'Tech',    price: 13.5, margin: 70, trend: 5,  score: 62, ads: 9,  spark: [24,25,23,26,25,27,26] },
  { id: 11, name: 'Fontaine à eau pour chat',      emoji: '🐱', niche: 'Animaux', price: 29.9, margin: 60, trend: 27, score: 81, ads: 20, spark: [16,18,24,28,33,39,46] },
  { id: 12, name: 'Diffuseur huiles essentielles', emoji: '🌫️', niche: 'Maison',  price: 26.9, margin: 66, trend: 14, score: 75, ads: 17, spark: [28,30,29,33,35,38,41] },
  { id: 13, name: 'Montre connectée sport',        emoji: '⌚', niche: 'Tech',    price: 34.9, margin: 52, trend: 22, score: 80, ads: 35, spark: [30,32,34,38,41,46,52] },
  { id: 14, name: 'Tapis de yoga antidérapant',    emoji: '🧘', niche: 'Fitness', price: 27.0, margin: 61, trend: 8,  score: 68, ads: 12, spark: [22,23,24,23,26,27,28] },
];

const PUBS = [
  { emoji: '🎧', plat: 'Meta',   pn: 'Casque anti-bruit',     head: 'Le silence, enfin. -50% aujourd\'hui', likes: '12,4k', days: 18, grad: 'linear-gradient(135deg,#4a3aff,#8b5cff)' },
  { emoji: '💡', plat: 'TikTok', pn: 'Lampe coucher de soleil', head: 'Ambiance cosy en 1 clic 🌅',        likes: '48,1k', days: 24, grad: 'linear-gradient(135deg,#ff6b3d,#ffb020)' },
  { emoji: '🐾', plat: 'Meta',   pn: 'Distributeur croquettes', head: 'Ne ratez plus jamais un repas',      likes: '8,9k',  days: 9,  grad: 'linear-gradient(135deg,#1c7fb8,#22d3ee)' },
  { emoji: '🧴', plat: 'Meta',   pn: 'Sérum hydratant',        head: 'Une peau repulpée en 14 jours',       likes: '21,7k', days: 31, grad: 'linear-gradient(135deg,#ff5d9e,#ff9bc2)' },
  { emoji: '❄️', plat: 'TikTok', pn: 'Roll-on cryo',           head: 'Dégonfle le visage en 60s ❄️',        likes: '63,5k', days: 12, grad: 'linear-gradient(135deg,#22d3ee,#4a3aff)' },
  { emoji: '⌚', plat: 'TikTok', pn: 'Montre connectée',       head: 'Suivez tout, sans vous ruiner',       likes: '30,2k', days: 21, grad: 'linear-gradient(135deg,#2fe08a,#22d3ee)' },
  { emoji: '💪', plat: 'Meta',   pn: 'Bandes de résistance',   head: 'La salle à la maison, sans matériel', likes: '15,0k', days: 16, grad: 'linear-gradient(135deg,#8b5cff,#22d3ee)' },
  { emoji: '🐱', plat: 'Meta',   pn: 'Fontaine à chat',        head: 'De l\'eau fraîche toute la journée',   likes: '9,6k',  days: 7,  grad: 'linear-gradient(135deg,#1c7fb8,#2fe08a)' },
  { emoji: '📱', plat: 'TikTok', pn: 'Support voiture',        head: 'Fini le téléphone qui glisse',        likes: '27,8k', days: 14, grad: 'linear-gradient(135deg,#ff6b3d,#ff5d6c)' },
];

const NICHES = ['Toutes', 'Tech', 'Maison', 'Beauté', 'Fitness', 'Animaux'];
const state = { niche: 'Toutes', q: '', sort: 'score', dir: -1, favs: new Set() };

const $ = (s) => document.querySelector(s);
const fmt = (n) => n.toFixed(2).replace('.', ',') + ' €';
const scoreColor = (s) => s >= 85 ? 'var(--green)' : s >= 72 ? 'var(--amber)' : 'var(--muted)';

function sparkline(data) {
  const w = 90, h = 28, max = Math.max(...data), min = Math.min(...data);
  const rng = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / rng) * (h - 4) - 2}`).join(' ');
  return `<svg class="spark" viewBox="0 0 ${w} ${h}"><polyline fill="none" stroke="url(#g)" stroke-width="2" points="${pts}"/><defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#8b5cff"/><stop offset="1" stop-color="#22d3ee"/></linearGradient></defs></svg>`;
}

function filtered() {
  let list = PRODUITS.filter((p) =>
    (state.niche === 'Toutes' || p.niche === state.niche) &&
    (p.name.toLowerCase().includes(state.q) || p.niche.toLowerCase().includes(state.q)));
  list.sort((a, b) => {
    let x = a[state.sort], y = b[state.sort];
    if (typeof x === 'string') { x = x.toLowerCase(); y = y.toLowerCase(); }
    return x < y ? -1 * state.dir : x > y ? 1 * state.dir : 0;
  });
  return list;
}

function renderStats() {
  const list = PRODUITS;
  const avgTrend = Math.round(list.reduce((s, p) => s + p.trend, 0) / list.length);
  const totalAds = list.reduce((s, p) => s + p.ads, 0);
  const med = [...list].sort((a, b) => a.price - b.price)[Math.floor(list.length / 2)].price;
  const cards = [
    ['Produits suivis', list.length, '+' + avgTrend + '% tendance moy.', 'up'],
    ['Score max', Math.max(...list.map((p) => p.score)), 'Top produit du jour', 'up'],
    ['Pubs actives', totalAds, 'sur l\'ensemble suivi', ''],
    ['Prix médian', fmt(med), 'panier type', ''],
  ];
  $('#stats').innerHTML = cards.map(([l, v, d, c]) =>
    `<div class="stat"><div class="lbl">${l}</div><div class="val">${v}</div><div class="delta ${c}">${d}</div></div>`).join('');
}

function renderNiches() {
  $('#nicheFilters').innerHTML = NICHES.map((n) =>
    `<button class="chip ${n === state.niche ? 'on' : ''}" data-niche="${n}">${n}</button>`).join('') +
    `<select class="sel" id="sortSel">
      <option value="score">Trier : Score</option>
      <option value="trend">Trier : Tendance</option>
      <option value="price">Trier : Prix</option>
      <option value="margin">Trier : Marge</option>
    </select>`;
  $('#nicheFilters').querySelectorAll('[data-niche]').forEach((b) =>
    b.addEventListener('click', () => { state.niche = b.dataset.niche; render(); }));
  const sel = $('#sortSel'); sel.value = state.sort;
  sel.addEventListener('change', () => { state.sort = sel.value; state.dir = -1; render(); });
}

function rowHtml(p, compact) {
  const fav = state.favs.has(p.id);
  if (compact) {
    return `<tr>
      <td><div class="prod"><div class="pi" style="background:rgba(124,92,255,.14)">${p.emoji}</div><div><div class="pn">${p.name}</div></div></div></td>
      <td class="hide-sm"><span class="badge">${p.niche}</span></td>
      <td>${fmt(p.price)}</td>
      <td><span class="score"><span class="dot" style="background:${scoreColor(p.score)}"></span>${p.score}</span></td>
      <td><button class="fav on" data-fav="${p.id}" title="Retirer">★</button></td>
    </tr>`;
  }
  return `<tr>
    <td><div class="prod"><div class="pi" style="background:rgba(124,92,255,.14)">${p.emoji}</div><div><div class="pn">${p.name}</div><div class="pc">${p.ads} pubs actives</div></div></div></td>
    <td class="hide-sm"><span class="badge">${p.niche}</span></td>
    <td>${fmt(p.price)}</td>
    <td class="hide-sm">${p.margin}%</td>
    <td><span class="up">▲ +${p.trend}%</span></td>
    <td class="hide-sm">${sparkline(p.spark)}</td>
    <td><span class="score"><span class="dot" style="background:${scoreColor(p.score)}"></span><b>${p.score}</b></span></td>
    <td><button class="fav ${fav ? 'on' : ''}" data-fav="${p.id}" title="Favori">${fav ? '★' : '☆'}</button></td>
  </tr>`;
}

function bindFavs(scope) {
  scope.querySelectorAll('[data-fav]').forEach((b) => b.addEventListener('click', () => {
    const id = +b.dataset.fav;
    state.favs.has(id) ? state.favs.delete(id) : state.favs.add(id);
    render();
  }));
}

function render() {
  const list = filtered();
  $('#rows').innerHTML = list.map((p) => rowHtml(p)).join('');
  $('#emptyProducts').classList.toggle('hidden', list.length > 0);
  bindFavs($('#rows'));

  // Favoris
  const favList = PRODUITS.filter((p) => state.favs.has(p.id));
  $('#favRows').innerHTML = favList.map((p) => rowHtml(p, true)).join('');
  $('#emptyFavs').classList.toggle('hidden', favList.length > 0);
  bindFavs($('#favRows'));
  $('#favCount').textContent = state.favs.size;

  // maj chips actives
  document.querySelectorAll('#nicheFilters [data-niche]').forEach((b) =>
    b.classList.toggle('on', b.dataset.niche === state.niche));
}

function renderAds() {
  $('#adGrid').innerHTML = PUBS.map((a) => `
    <div class="ad">
      <div class="creative" style="background:${a.grad}">
        <span class="plat">${a.plat}</span>${a.emoji}
      </div>
      <div class="abody">
        <div class="ahead">${a.head}</div>
        <div class="ameta"><span>❤️ ${a.likes}</span><span>⏱️ ${a.days} j. actives</span><span>${a.pn}</span></div>
      </div>
    </div>`).join('');
}

// En-têtes triables
document.querySelectorAll('th[data-sort]').forEach((th) => th.addEventListener('click', () => {
  const key = th.dataset.sort;
  state.dir = (state.sort === key) ? -state.dir : -1;
  state.sort = key;
  const sel = document.getElementById('sortSel'); if (sel && ['score','trend','price','margin'].includes(key)) sel.value = key;
  render();
}));

// Recherche
$('#search').addEventListener('input', (e) => { state.q = e.target.value.trim().toLowerCase(); render(); });

// Navigation entre vues
const views = { products: '#view-products', ads: '#view-ads', favs: '#view-favs' };
document.querySelectorAll('#nav a[data-view]').forEach((a) => a.addEventListener('click', () => {
  document.querySelectorAll('#nav a').forEach((x) => x.classList.remove('active'));
  a.classList.add('active');
  Object.values(views).forEach((v) => document.querySelector(v).classList.add('hidden'));
  document.querySelector(views[a.dataset.view]).classList.remove('hidden');
  document.getElementById('side').classList.remove('open');
}));

// Menu mobile
document.getElementById('mobileMenu').addEventListener('click', () =>
  document.getElementById('side').classList.toggle('open'));

// Init
renderStats();
renderNiches();
renderAds();
render();
