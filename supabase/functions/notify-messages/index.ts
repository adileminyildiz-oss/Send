// ---------------------------------------------------------------------------
// BâtiLink — Fonction Edge « notify-messages »
//
// Rôle : notifier par email les utilisateurs qui ont reçu de NOUVEAUX messages
// dans la messagerie interne (tables public.conversations + public.messages) et
// qui ne les ont pas encore lus. Comme la messagerie n'envoyait jusqu'ici aucun
// email, elle était sous-utilisée : cette fonction prévient le destinataire
// qu'un message l'attend, avec un lien vers la page Messages.
//
// Déclenchement : appelée SUR PLANNING (pg_cron ou « Scheduled function »
// Supabase), typiquement toutes les quelques minutes. Voir NOTIFICATIONS-SETUP.md.
// Appel machine-à-machine : pas de CORS, pas d'authentification navigateur.
//
// Fonctionnement :
//   1. Lit un lot de messages où lu = false ET notifie = false, créés il y a
//      plus de ~2 minutes (délai de grâce : si le destinataire est en train de
//      lire en direct, on ne le spamme pas d'un email inutile).
//   2. Pour chaque message, le DESTINATAIRE = le participant de la conversation
//      qui n'est PAS l'expéditeur. On regroupe par destinataire.
//   3. Un SEUL email récapitulatif par destinataire (« Vous avez N nouveaux
//      messages sur BâtiLink »), avec un lien vers /messages/index.html.
//   4. Après un envoi réussi, ces messages passent à notifie = true (anti-doublon).
//
// CONFIDENTIALITÉ : l'email ne contient JAMAIS le contenu des messages (la
// messagerie interne sert justement à échanger sans dévoiler ses coordonnées).
// On se contente de notifier + lien ; tout au plus le nombre de messages.
//
// Un try/catch entoure chaque destinataire : une erreur isolée n'arrête pas le lot.
//
// Variables d'environnement (Supabase → Functions → Secrets) :
//   SUPABASE_URL                fourni automatiquement par Supabase
//   SUPABASE_SERVICE_ROLE_KEY   clé service_role (contourne la RLS) — SECRÈTE
//   RESEND_API_KEY              clé API Resend (envoi des emails). Si absente,
//                               AUCUN email n'est envoyé ET aucun message n'est
//                               marqué notifie=true (dégradation gracieuse) :
//                               ainsi, activer Resend plus tard notifiera bien
//                               les messages en attente, sans backlog perdu.
//   SITE_URL                    ex. https://send.aemconseil.eu (liens de l'email)
//   NOTIF_FROM                  expéditeur, défaut « BâtiLink <notifications@aemconseil.eu> »
//                               (à faire correspondre à un domaine vérifié Resend)
//
// Planification (exemple pg_cron), voir NOTIFICATIONS-SETUP.md pour le détail.
// ---------------------------------------------------------------------------

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SITE_URL = (Deno.env.get('SITE_URL') || 'https://send.aemconseil.eu').replace(/\/+$/, '');
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
// Expéditeur : à faire correspondre à un domaine/adresse vérifié sur Resend.
const FROM_EMAIL = Deno.env.get('NOTIF_FROM') || 'BâtiLink <notifications@aemconseil.eu>';

// Délai de grâce : on ne notifie que les messages datant de plus de 2 minutes,
// pour laisser le temps à un destinataire connecté de lire en direct.
const GRACE_MS = 2 * 60 * 1000;
// Taille du lot traité à chaque exécution.
const BATCH_LIMIT = 200;

// Client Supabase « admin » (service_role) : contourne la RLS pour lire tous les
// messages non notifiés et les marquer notifie = true après envoi.
const admin = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
  { auth: { persistSession: false } },
);

// Message avec les deux participants de sa conversation (jointure intégrée).
interface MessageRow {
  id: string;
  conversation_id: string;
  sender: string;
  created_at: string;
  conversations:
    | { participant_a: string; participant_b: string }
    | { participant_a: string; participant_b: string }[]
    | null;
}

// Regroupement par destinataire.
interface RecipientGroup {
  recipient: string;
  messageIds: string[];
  conversationIds: Set<string>;
}

// Échappe le HTML pour l'email.
function esc(s: unknown): string {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } as Record<string, string>)[c]);
}

// Extrait la paire de participants, que la jointure renvoie un objet ou un tableau.
function participantsOf(row: MessageRow): { participant_a: string; participant_b: string } | null {
  const c = row.conversations;
  if (!c) return null;
  return Array.isArray(c) ? (c[0] || null) : c;
}

// Construit le corps HTML de l'email — SANS contenu de message (confidentialité).
function buildEmail(count: number, conversationCount: number): string {
  const nbMsg = count === 1 ? '1 nouveau message' : count + ' nouveaux messages';
  const deQui = conversationCount === 1
    ? 'dans une conversation'
    : 'dans ' + conversationCount + ' conversations';
  return (
    '<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">' +
    '<h2 style="font-size:19px">✉️ ' + esc(nbMsg) + ' — BâtiLink</h2>' +
    '<p style="color:#444;font-size:14px">Vous avez <b>' + esc(String(count)) + '</b> message(s) ' +
    'non lu(s) ' + esc(deQui) + ' sur votre messagerie BâtiLink.</p>' +
    '<p style="color:#444;font-size:14px">Pour préserver la confidentialité des échanges, ' +
    'le contenu des messages n\'est pas repris dans cet email : connectez-vous pour le lire.</p>' +
    '<p style="font-size:14px;margin:22px 0"><a href="' + SITE_URL + '/messages/index.html" ' +
    'style="display:inline-block;background:#b26a00;color:#fff;font-weight:700;text-decoration:none;' +
    'padding:11px 20px;border-radius:6px">Ouvrir ma messagerie →</a></p>' +
    '<hr style="border:none;border-top:1px solid #eee;margin:24px 0">' +
    '<p style="color:#999;font-size:12px">Vous recevez cet email car un utilisateur de BâtiLink ' +
    'vous a écrit via la messagerie interne. Répondez directement depuis la page ' +
    '<a href="' + SITE_URL + '/messages/index.html" style="color:#999">Messages</a>.</p>' +
    '</div>'
  );
}

// Envoie l'email via l'API Resend. Renvoie true si envoyé.
async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_API_KEY) return false; // pas de clé → pas d'envoi (gracieux).
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + RESEND_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error('Resend HTTP ' + res.status + ' ' + t);
  }
  return true;
}

Deno.serve(async (_req: Request) => {
  const summary = {
    messages_examines: 0,
    destinataires: 0,
    emails_envoyes: 0,
    messages_notifies: 0,
    erreurs: 0,
    resend_configure: !!RESEND_API_KEY,
  };

  try {
    // Fenêtre : messages non lus, non notifiés, créés il y a plus de GRACE_MS.
    const cutoff = new Date(Date.now() - GRACE_MS).toISOString();

    const { data: rows, error } = await admin
      .from('messages')
      .select('id, conversation_id, sender, created_at, conversations(participant_a, participant_b)')
      .eq('lu', false)
      .eq('notifie', false)
      .lte('created_at', cutoff)
      .order('created_at', { ascending: true })
      .limit(BATCH_LIMIT);

    if (error) {
      console.error('Lecture messages:', error.message);
      return new Response(JSON.stringify({ error: 'Lecture des messages impossible.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const list = (rows || []) as MessageRow[];
    summary.messages_examines = list.length;

    // Regroupe par destinataire = le participant qui n'est pas l'expéditeur.
    const groups = new Map<string, RecipientGroup>();
    for (const row of list) {
      const pair = participantsOf(row);
      if (!pair) continue; // conversation supprimée / illisible : on saute.
      const recipient = pair.participant_a === row.sender ? pair.participant_b : pair.participant_a;
      if (!recipient || recipient === row.sender) continue; // garde-fou.
      let g = groups.get(recipient);
      if (!g) {
        g = { recipient, messageIds: [], conversationIds: new Set<string>() };
        groups.set(recipient, g);
      }
      g.messageIds.push(row.id);
      g.conversationIds.add(row.conversation_id);
    }

    summary.destinataires = groups.size;

    // Si Resend n'est pas configuré : on NE marque RIEN (backlog conservé pour
    // le jour où la clé sera renseignée). On renvoie juste un récapitulatif.
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ ...summary, note: 'RESEND_API_KEY absente : notifications désactivées, aucun message marqué.' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    for (const g of groups.values()) {
      try {
        // Email du destinataire via l'API admin d'auth.
        let email = '';
        try {
          const { data: u } = await admin.auth.admin.getUserById(g.recipient);
          email = (u && u.user && u.user.email) || '';
        } catch (_e) { /* utilisateur introuvable : on saute l'envoi */ }

        if (!email) continue;

        const count = g.messageIds.length;
        const subject = count === 1
          ? '✉️ Vous avez 1 nouveau message sur BâtiLink'
          : '✉️ Vous avez ' + count + ' nouveaux messages sur BâtiLink';

        const sent = await sendEmail(email, subject, buildEmail(count, g.conversationIds.size));
        if (!sent) continue;
        summary.emails_envoyes++;

        // Marque ces messages comme notifiés SEULEMENT après un envoi réussi.
        const { error: upErr } = await admin
          .from('messages')
          .update({ notifie: true })
          .in('id', g.messageIds);
        if (upErr) {
          console.error('Marquage notifie destinataire', g.recipient, ':', upErr.message);
          summary.erreurs++;
        } else {
          summary.messages_notifies += g.messageIds.length;
        }
      } catch (err) {
        summary.erreurs++;
        console.error('Destinataire', g.recipient, ':', (err as Error).message);
        // On continue : un destinataire en échec ne bloque pas les autres.
      }
    }
  } catch (err) {
    console.error('notify-messages:', err);
    return new Response(JSON.stringify({ error: 'Erreur de traitement du lot.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify(summary), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
