// ---------------------------------------------------------------------------
// BâtiLink — window.BLBilling : couche légère « abonnement Pro » (Stripe).
//
// Même philosophie que window.BLDB : DÉGRADE GRACIEUSEMENT et ne « throw »
// jamais vers l'appelant.
//   • Si Stripe n'est pas encore configuré (clés vides dans config.js), ou si
//     supabase-js n'est pas chargé, BLBilling.ready vaut false : les boutons
//     affichent « bientôt disponible » et l'utilisateur reste « Gratuit ».
//   • getSubscription() / isPro() renvoient toujours une valeur (jamais d'erreur).
//
// Dépendances : le CDN @supabase/supabase-js@2 (window.supabase), les clés
// Supabase (config.js) et la config Stripe (config.js).
// ---------------------------------------------------------------------------
(function () {
  'use strict';

  // --- Client Supabase (créé comme dans db.js). ----------------------------
  var client = null;
  try {
    if (window.supabase && window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
      client = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
    }
  } catch (e) { client = null; }

  // Base des fonctions Edge, sans « / » final.
  var FN_URL = (window.SUPABASE_FUNCTIONS_URL || '').replace(/\/+$/, '');

  // « ready » = Stripe entièrement configuré côté front.
  var ready = !!(window.STRIPE_PUBLISHABLE_KEY && window.STRIPE_PRICE_PRO && FN_URL);

  var BLBilling = { ready: ready, client: client };

  // --- Utilitaires internes -------------------------------------------------
  function nullVal() { return Promise.resolve(null); }

  // Session Supabase courante (ou null). Ne « throw » jamais.
  function currentSession() {
    if (!client) return Promise.resolve(null);
    return client.auth.getSession().then(function (res) {
      return (res && res.data) ? res.data.session : null;
    }).catch(function () { return null; });
  }

  // Appel POST vers une fonction Edge avec le jeton d'accès. Renvoie l'objet
  // JSON ({ url } ou { error }) ou null en cas d'échec réseau.
  function callFunction(name, token) {
    if (!FN_URL) return Promise.resolve(null);
    return fetch(FN_URL + '/' + name, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: '{}'
    }).then(function (res) {
      return res.json().then(function (data) { return data; })
        .catch(function () { return null; });
    }).catch(function () { return null; });
  }

  // --- API publique ---------------------------------------------------------

  // Utilisateur connecté (objet user) ou null.
  BLBilling.session = function () {
    return currentSession().then(function (s) { return (s && s.user) ? s.user : null; });
  };

  // Ligne d'abonnement de l'utilisateur (ou null). Ne « throw » jamais.
  BLBilling.getSubscription = function () {
    if (!client) return nullVal();
    return currentSession().then(function (s) {
      if (!s || !s.user) return null;
      return client.from('subscriptions').select('*').eq('user_id', s.user.id)
        .maybeSingle().then(function (res) {
          if (!res || res.error || !res.data) return null;
          return res.data;
        }).catch(function () { return null; });
    }).catch(function () { return null; });
  };

  // true si l'abonnement est actif/en essai et non expiré. Ne « throw » jamais.
  BLBilling.isPro = function () {
    return BLBilling.getSubscription().then(function (sub) {
      if (!sub) return false;
      var active = (sub.status === 'active' || sub.status === 'trialing');
      if (!active) return false;
      if (!sub.current_period_end) return true; // actif sans échéance connue
      var end = Date.parse(sub.current_period_end);
      if (isNaN(end)) return true;
      return end > Date.now();
    }).catch(function () { return false; });
  };

  // Lance la souscription (Checkout Stripe).
  //   • non connecté → redirige vers la page compte.
  //   • non configuré → message « bientôt disponible ».
  //   • sinon → crée la session Checkout et redirige vers Stripe.
  BLBilling.startCheckout = function () {
    return currentSession().then(function (s) {
      if (!s || !s.user) {
        // Redirection relative robuste (pages en sous-dossier ou racine).
        window.location.href = pathTo('compte/index.html');
        return;
      }
      if (!BLBilling.ready) {
        alert("L'abonnement en ligne sera bientôt disponible.");
        return;
      }
      var token = s.access_token;
      return callFunction('create-checkout', token).then(function (data) {
        if (data && data.url) {
          window.location = data.url;
        } else {
          alert("Le paiement est momentanément indisponible. Merci de réessayer plus tard.");
        }
      });
    }).catch(function () {
      alert("Le paiement est momentanément indisponible. Merci de réessayer plus tard.");
    });
  };

  // Ouvre le portail de facturation Stripe (gérer / résilier).
  BLBilling.openPortal = function () {
    return currentSession().then(function (s) {
      if (!s || !s.user) {
        window.location.href = pathTo('compte/index.html');
        return;
      }
      if (!BLBilling.ready) {
        alert("La gestion de l'abonnement sera bientôt disponible.");
        return;
      }
      return callFunction('customer-portal', s.access_token).then(function (data) {
        if (data && data.url) {
          window.location = data.url;
        } else {
          alert("La gestion de l'abonnement est momentanément indisponible. Merci de réessayer plus tard.");
        }
      });
    }).catch(function () {
      alert("La gestion de l'abonnement est momentanément indisponible. Merci de réessayer plus tard.");
    });
  };

  // Construit un chemin vers une page à la racine du site, quelle que soit la
  // profondeur de la page courante (racine, /espace/, /guides/x/, …).
  function pathTo(rel) {
    var path = window.location.pathname;
    // Nombre de segments de dossier après la racine (hors fichier).
    var dir = path.replace(/[^\/]*$/, '');           // ex. "/espace/"
    var depth = dir.split('/').filter(Boolean).length;
    var prefix = depth > 0 ? new Array(depth + 1).join('../') : '';
    return prefix + rel;
  }

  window.BLBilling = BLBilling;
})();
