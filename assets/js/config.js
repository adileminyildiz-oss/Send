// ---------------------------------------------------------------------------
// Configuration Supabase (connexion par email).
//
// Colle ici les identifiants de TON projet Supabase :
//   Supabase → ton projet → Settings → API
//     • Project URL           -> SUPABASE_URL
//     • Project API keys > anon public -> SUPABASE_ANON_KEY
//
// ⚠️ Ces deux valeurs sont PUBLIQUES par conception : la clé « anon » est faite
// pour être exposée côté navigateur. La vraie sécurité se règle dans Supabase
// (Row Level Security). Ne colle JAMAIS ici la clé « service_role » (secrète).
// ---------------------------------------------------------------------------
window.SUPABASE_URL = "https://kneexwqmlgqdwferckkq.supabase.co";
window.SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtuZWV4d3FtbGdxZHdmZXJja2txIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2MzY5MzEsImV4cCI6MjEwMDIxMjkzMX0.gVA95To1dOX_o9BpSFWCoj_5R-OqYsdIROzjLzkqvA4";

// ---------------------------------------------------------------------------
// Formspree (envoi réel des formulaires par e-mail, sans serveur).
// Crée un formulaire gratuit sur https://formspree.io → copie ton endpoint
// (ex. "https://formspree.io/f/xxxxxxx") ci-dessous. Tant que c'est vide, les
// formulaires enregistrent localement et affichent un message de démonstration.
// ---------------------------------------------------------------------------
window.FORMSPREE_ENDPOINT = "https://formspree.io/f/mkodzqql";

// ---------------------------------------------------------------------------
// Stripe (abonnement Pro mensuel).
//
// Ces trois valeurs sont PUBLIQUES par conception (comme la clé « anon »
// Supabase) : elles peuvent figurer dans ce fichier livré au navigateur.
//   • STRIPE_PUBLISHABLE_KEY : clé publiable (Stripe → Développeurs → Clés API).
//   • STRIPE_PRICE_PRO       : id du tarif récurrent Pro (Stripe → Produits).
//   • SUPABASE_FUNCTIONS_URL : base des fonctions Edge Supabase.
//
// ⚠️ Ne colle JAMAIS ici la clé SECRÈTE Stripe (sk_...) ni la clé service_role
// Supabase : elles vivent uniquement dans les « secrets » des fonctions Edge.
//
// Tant que ces valeurs sont vides, le paiement en ligne est DÉSACTIVÉ : le site
// reste pleinement fonctionnel et affiche « bientôt disponible ». Voir
// STRIPE-SETUP.md pour la procédure complète de configuration.
// ---------------------------------------------------------------------------
window.STRIPE_PUBLISHABLE_KEY = "";      // pk_live_... ou pk_test_...
window.STRIPE_PRICE_PRO = "";            // price_... de l'abonnement Pro
window.SUPABASE_FUNCTIONS_URL = "";      // ex. https://<ref>.functions.supabase.co  (laisser vide = paiement désactivé, affichage "bientôt")

