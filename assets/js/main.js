// AEM Conseil — interactions du site vitrine.
'use strict';

// Menu mobile
const toggle = document.getElementById('navToggle');
const links = document.getElementById('navLinks');
if (toggle && links) {
  toggle.addEventListener('click', () => links.classList.toggle('open'));
  links.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => links.classList.remove('open')));
}

// Révélation au défilement
const io = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    });
  },
  { threshold: 0.12 },
);
document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

// Boutons de forfaits -> lien de paiement Stripe (à configurer).
// Remplacez les URL ci-dessous par vos "Payment Links" créés sur https://dashboard.stripe.com/payment-links
const STRIPE_LINKS = {
  vitrine: '',     // ex : 'https://buy.stripe.com/xxxxxxxx'
  pro: '',
  ecommerce: '',
};
document.querySelectorAll('[data-stripe]').forEach((btn) => {
  const key = btn.getAttribute('data-stripe');
  const url = STRIPE_LINKS[key];
  if (url) {
    btn.setAttribute('href', url);
    btn.setAttribute('target', '_blank');
    btn.setAttribute('rel', 'noopener');
  }
  // Si aucun lien Stripe n'est configuré, le bouton mène au formulaire de contact
  // (comportement par défaut défini dans le HTML : href="#contact").
});
