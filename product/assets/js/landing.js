// Dropscope — landing (menu mobile, reveal, liens Stripe démo).
'use strict';
const t = document.getElementById('navToggle'), l = document.getElementById('navLinks');
if (t && l) { t.addEventListener('click', () => l.classList.toggle('open')); l.querySelectorAll('a').forEach(a => a.addEventListener('click', () => l.classList.remove('open'))); }

const io = new IntersectionObserver((es) => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.12 });
document.querySelectorAll('.reveal').forEach(el => io.observe(el));

// Liens de paiement (à configurer avec vos Stripe Payment Links). Vides => démo.
const STRIPE = { pro: '', agence: '' };
document.querySelectorAll('[data-stripe]').forEach(b => {
  const u = STRIPE[b.getAttribute('data-stripe')];
  if (u) { b.href = u; b.target = '_blank'; b.rel = 'noopener'; }
  else b.addEventListener('click', (e) => { e.preventDefault(); alert('Démo : le paiement Stripe serait ici. Configurez vos liens dans assets/js/landing.js.'); });
});
