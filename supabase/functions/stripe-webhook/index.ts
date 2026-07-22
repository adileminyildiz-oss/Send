// ---------------------------------------------------------------------------
// BâtiLink — Fonction Edge « stripe-webhook »
//
// Rôle : recevoir les événements Stripe (serveur → serveur) et tenir à jour la
// table public.subscriptions. C'est le SEUL rédacteur de cette table : il
// utilise la clé SERVICE_ROLE, qui contourne la RLS.
//
// Sécurité :
//   • La signature Stripe est OBLIGATOIREMENT vérifiée
//     (stripe.webhooks.constructEventAsync avec le CORPS BRUT + STRIPE_WEBHOOK_SECRET).
//     Un corps non signé / mal signé est rejeté (400). Aucune écriture sans
//     signature valide → impossible de forger un « faux » abonnement.
//   • Pas de CORS : appel machine à machine (Stripe), pas depuis un navigateur.
//
// Événements traités :
//   checkout.session.completed
//   customer.subscription.created / updated / deleted
//   invoice.paid / invoice.payment_failed
//
// Variables d'environnement requises (Supabase → Functions → Secrets) :
//   STRIPE_SECRET_KEY            clé secrète Stripe
//   STRIPE_WEBHOOK_SECRET       secret de signature du endpoint (whsec_...)
//   SUPABASE_URL                fourni automatiquement par Supabase
//   SUPABASE_SERVICE_ROLE_KEY   clé service_role (contourne la RLS) — SECRÈTE
// ---------------------------------------------------------------------------

import Stripe from 'https://esm.sh/stripe@17.7.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2024-06-20',
});

// Client Supabase « admin » (service_role) : contourne la RLS pour écrire.
const admin = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
  { auth: { persistSession: false } },
);

const WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET') || '';

// Convertit un timestamp Stripe (secondes) en ISO, ou null.
function toIso(seconds: number | null | undefined): string | null {
  return typeof seconds === 'number' ? new Date(seconds * 1000).toISOString() : null;
}

// Retrouve l'id utilisateur Supabase à partir des données Stripe :
// 1) metadata.supabase_user_id  2) metadata du client Stripe.
async function resolveUserId(opts: {
  clientReferenceId?: string | null;
  metadataUserId?: string | null;
  customerId?: string | null;
}): Promise<string | null> {
  if (opts.metadataUserId) return opts.metadataUserId;
  if (opts.clientReferenceId) return opts.clientReferenceId;
  if (opts.customerId) {
    try {
      const customer = await stripe.customers.retrieve(opts.customerId);
      if (customer && !(customer as Stripe.DeletedCustomer).deleted) {
        const meta = (customer as Stripe.Customer).metadata || {};
        if (meta.supabase_user_id) return meta.supabase_user_id;
      }
    } catch (_e) { /* ignore */ }
    // Dernier recours : ligne existante portant ce client Stripe.
    try {
      const { data } = await admin
        .from('subscriptions')
        .select('user_id')
        .eq('stripe_customer_id', opts.customerId)
        .maybeSingle();
      if (data && data.user_id) return data.user_id;
    } catch (_e) { /* ignore */ }
  }
  return null;
}

// Écrit (upsert) l'état d'abonnement pour un utilisateur.
async function upsertSubscription(row: {
  user_id: string;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  status?: string | null;
  price_id?: string | null;
  current_period_end?: string | null;
}) {
  const payload: Record<string, unknown> = {
    user_id: row.user_id,
    updated_at: new Date().toISOString(),
  };
  // On ne surécrit que les champs réellement fournis (évite d'effacer une
  // valeur connue avec un null d'un événement partiel).
  if (row.stripe_customer_id !== undefined) payload.stripe_customer_id = row.stripe_customer_id;
  if (row.stripe_subscription_id !== undefined) payload.stripe_subscription_id = row.stripe_subscription_id;
  if (row.status !== undefined) payload.status = row.status;
  if (row.price_id !== undefined) payload.price_id = row.price_id;
  if (row.current_period_end !== undefined) payload.current_period_end = row.current_period_end;

  const { error } = await admin
    .from('subscriptions')
    .upsert(payload, { onConflict: 'user_id' });
  if (error) console.error('upsertSubscription:', error.message);
}

// Applique un objet Stripe.Subscription à la table.
async function applySubscription(sub: Stripe.Subscription) {
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
  const priceId = sub.items?.data?.[0]?.price?.id || null;
  const userId = await resolveUserId({
    metadataUserId: sub.metadata?.supabase_user_id,
    customerId,
  });
  if (!userId) {
    console.error('applySubscription: utilisateur introuvable pour', sub.id);
    return;
  }
  await upsertSubscription({
    user_id: userId,
    stripe_customer_id: customerId,
    stripe_subscription_id: sub.id,
    status: sub.status,
    price_id: priceId,
    current_period_end: toIso(sub.current_period_end),
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Méthode non autorisée', { status: 405 });
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature || !WEBHOOK_SECRET) {
    return new Response('Signature manquante.', { status: 400 });
  }

  // Corps BRUT indispensable à la vérification de signature.
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, WEBHOOK_SECRET);
  } catch (err) {
    console.error('Signature Stripe invalide:', (err as Error).message);
    return new Response('Signature invalide.', { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
        const userId = await resolveUserId({
          clientReferenceId: session.client_reference_id,
          metadataUserId: session.metadata?.supabase_user_id,
          customerId,
        });
        // Récupère l'abonnement complet pour un état précis.
        if (session.subscription) {
          const subId = typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription.id;
          const sub = await stripe.subscriptions.retrieve(subId);
          // Assure la présence de l'id utilisateur dans les metadata.
          if (userId && !sub.metadata?.supabase_user_id) {
            sub.metadata = { ...(sub.metadata || {}), supabase_user_id: userId };
          }
          await applySubscription(sub);
        } else if (userId && customerId) {
          await upsertSubscription({
            user_id: userId,
            stripe_customer_id: customerId,
            status: 'active',
          });
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        // Sur « deleted », le statut Stripe est déjà 'canceled'.
        await applySubscription(sub);
        break;
      }

      case 'invoice.paid':
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = typeof invoice.subscription === 'string'
          ? invoice.subscription
          : invoice.subscription?.id;
        if (subId) {
          const sub = await stripe.subscriptions.retrieve(subId);
          await applySubscription(sub);
        }
        break;
      }

      default:
        // Événement non géré : on l'accuse en 200 pour éviter les relances.
        break;
    }
  } catch (err) {
    console.error('Traitement webhook:', err);
    // 500 → Stripe réessaiera l'événement plus tard.
    return new Response('Erreur de traitement.', { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
