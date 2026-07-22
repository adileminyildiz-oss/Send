// ---------------------------------------------------------------------------
// BâtiLink — Fonction Edge « create-checkout »
//
// Rôle : créer une session Stripe Checkout (mode abonnement) pour l'utilisateur
// connecté, afin qu'il souscrive à l'abonnement Pro mensuel.
//
// Flux :
//   1. Le navigateur envoie POST avec l'en-tête « Authorization: Bearer <JWT> ».
//   2. On vérifie le JWT via supabase.auth.getUser(jwt) → identité fiable.
//   3. On récupère (ou crée) le client Stripe rattaché à cet utilisateur.
//   4. On crée une session Checkout (subscription) avec le prix STRIPE_PRICE_PRO.
//   5. On renvoie { url } ; le front redirige le navigateur vers cette URL.
//
// Variables d'environnement requises (Supabase → Functions → Secrets) :
//   STRIPE_SECRET_KEY          clé secrète Stripe (sk_live_... / sk_test_...)
//   STRIPE_PRICE_PRO           id du tarif récurrent Pro (price_...)
//   SUPABASE_URL               fourni automatiquement par Supabase
//   SUPABASE_ANON_KEY          fourni automatiquement (sert à vérifier le JWT)
//   SITE_URL                   ex. https://send.aemconseil.eu (success/cancel)
// ---------------------------------------------------------------------------

import Stripe from 'https://esm.sh/stripe@17.7.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, handleOptions } from '../_shared/cors.ts';

const SITE_URL = (Deno.env.get('SITE_URL') || 'https://send.aemconseil.eu').replace(/\/+$/, '');

Deno.serve(async (req: Request) => {
  // Preflight CORS.
  if (req.method === 'OPTIONS') return handleOptions(req);

  const cors = corsHeaders(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });

  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);

  try {
    // --- 1. Authentification : on vérifie le JWT de l'appelant. ---------------
    const authHeader = req.headers.get('Authorization') || '';
    const jwt = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!jwt) return json({ error: 'Authentification requise.' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
    );
    const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
    const user = userData?.user;
    if (userErr || !user) return json({ error: 'Session invalide.' }, 401);

    // --- 2. Configuration Stripe. --------------------------------------------
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    const priceId = Deno.env.get('STRIPE_PRICE_PRO');
    if (!stripeKey || !priceId) {
      return json({ error: 'Paiement non configuré.' }, 500);
    }
    const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' });

    // --- 3. Réutiliser le client Stripe existant, sinon le créer. ------------
    // On cherche d'abord une éventuelle ligne d'abonnement déjà connue.
    let customerId: string | null = null;
    try {
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('stripe_customer_id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (sub && sub.stripe_customer_id) customerId = sub.stripe_customer_id;
    } catch (_e) { /* table absente ou RLS : on créera un client */ }

    // Repli : recherche par e-mail chez Stripe (évite les doublons de clients).
    if (!customerId && user.email) {
      const found = await stripe.customers.list({ email: user.email, limit: 1 });
      if (found.data.length > 0) customerId = found.data[0].id;
    }

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email || undefined,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
    }

    // --- 4. Créer la session Checkout (mode abonnement). ---------------------
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      client_reference_id: user.id,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { supabase_user_id: user.id },
      subscription_data: { metadata: { supabase_user_id: user.id } },
      allow_promotion_codes: true,
      success_url: SITE_URL + '/espace/index.html?abonnement=succes',
      cancel_url: SITE_URL + '/index.html?abonnement=annule#tarifs',
    });

    return json({ url: session.url });
  } catch (err) {
    console.error('create-checkout:', err);
    return json({ error: 'Impossible de créer la session de paiement.' }, 500);
  }
});
