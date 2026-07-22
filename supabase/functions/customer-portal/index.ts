// ---------------------------------------------------------------------------
// BâtiLink — Fonction Edge « customer-portal »
//
// Rôle : ouvrir le portail de facturation Stripe (Billing Portal) pour que
// l'utilisateur connecté gère/résilie son abonnement, mette à jour sa carte,
// télécharge ses factures, etc.
//
// Flux :
//   1. Le navigateur envoie POST avec « Authorization: Bearer <JWT> ».
//   2. On vérifie le JWT via supabase.auth.getUser(jwt).
//   3. On lit son stripe_customer_id dans public.subscriptions.
//   4. On crée une session de portail Stripe et on renvoie { url }.
//
// Variables d'environnement requises (Supabase → Functions → Secrets) :
//   STRIPE_SECRET_KEY           clé secrète Stripe
//   SUPABASE_URL                fourni automatiquement par Supabase
//   SUPABASE_ANON_KEY           fourni automatiquement (vérifie le JWT)
//   SUPABASE_SERVICE_ROLE_KEY   clé service_role (lit la ligne malgré la RLS)
//   SITE_URL                    ex. https://send.aemconseil.eu (return_url)
// ---------------------------------------------------------------------------

import Stripe from 'https://esm.sh/stripe@17.7.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, handleOptions } from '../_shared/cors.ts';

const SITE_URL = (Deno.env.get('SITE_URL') || 'https://send.aemconseil.eu').replace(/\/+$/, '');

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return handleOptions(req);

  const cors = corsHeaders(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });

  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);

  try {
    // --- 1. Authentification. ------------------------------------------------
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

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) return json({ error: 'Paiement non configuré.' }, 500);
    const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' });

    // --- 2. Récupérer le client Stripe de l'utilisateur. ---------------------
    // On lit via service_role pour être certain d'accéder à la ligne.
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    );
    const { data: sub } = await admin
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle();

    const customerId = sub?.stripe_customer_id;
    if (!customerId) {
      return json({ error: "Aucun abonnement associé à ce compte." }, 404);
    }

    // --- 3. Créer la session de portail. -------------------------------------
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: SITE_URL + '/espace/index.html',
    });

    return json({ url: portal.url });
  } catch (err) {
    console.error('customer-portal:', err);
    return json({ error: 'Impossible d\'ouvrir le portail de facturation.' }, 500);
  }
});
