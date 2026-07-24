// ---------------------------------------------------------------------------
// BâtiLink — Fonction Edge « alertes-notify »
//
// Rôle : parcourir les alertes actives (table public.alertes_ao) et envoyer par
// email à chaque utilisateur les NOUVEAUX appels d'offres publics (BOAMP) qui
// correspondent à sa recherche depuis son dernier envoi.
//
// Déclenchement : appelée SUR PLANNING (pg_cron ou « Scheduled function »
// Supabase), typiquement une fois par jour. Voir ALERTES-SETUP.md.
// Appel machine-à-machine : pas de CORS, pas d'authentification navigateur.
//
// Fonctionnement, pour chaque alerte active :
//   1. Interroge l'API open data BOAMP (même dataset que /appels-offres/) avec
//      where=search("<mots_cles ou 'travaux'>") et order_by=dateparution desc.
//   2. Ne retient que les avis parus APRÈS derniere_execution (et, si un
//      département est renseigné, dont le texte contient ce département).
//   3. S'il y a au moins un nouvel avis → email au propriétaire via Resend.
//   4. Met à jour derniere_execution = now() (même sans nouvel avis, pour caler
//      la fenêtre de la prochaine exécution).
// Un try/catch entoure chaque alerte : une erreur isolée n'arrête pas le lot.
//
// Variables d'environnement (Supabase → Functions → Secrets) :
//   SUPABASE_URL                fourni automatiquement par Supabase
//   SUPABASE_SERVICE_ROLE_KEY   clé service_role (contourne la RLS) — SECRÈTE
//   RESEND_API_KEY              clé API Resend (envoi des emails). Si absente,
//                               les emails ne sont PAS envoyés (dégradation
//                               gracieuse) : le lot tourne quand même et cale
//                               les dates, mais rien n'est expédié.
//   SITE_URL                    ex. https://send.aemconseil.eu (liens de l'email)
//
// Planification (exemple pg_cron), voir ALERTES-SETUP.md pour le détail.
// ---------------------------------------------------------------------------

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const BOAMP_API =
  'https://boamp-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/boamp/records';

const SITE_URL = (Deno.env.get('SITE_URL') || 'https://send.aemconseil.eu').replace(/\/+$/, '');
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
// Expéditeur : à faire correspondre à un domaine/adresse vérifié sur Resend.
const FROM_EMAIL = Deno.env.get('ALERTES_FROM') || 'BâtiLink <alertes@aemconseil.eu>';

// Client Supabase « admin » (service_role) : contourne la RLS pour lire toutes
// les alertes actives et mettre à jour derniere_execution.
const admin = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
  { auth: { persistSession: false } },
);

interface Alerte {
  id: string;
  owner: string;
  mots_cles: string | null;
  departement: string | null;
  frequence: string | null;
  actif: boolean;
  derniere_execution: string | null;
}

// Échappe le HTML pour l'email.
function esc(s: unknown): string {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } as Record<string, string>)[c]);
}

// Récupère un champ parmi plusieurs clés possibles (l'API BOAMP varie).
function pick(o: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = o ? o[k] : undefined;
    if (v != null && v !== '') return String(v);
  }
  return '';
}

// Lien vers l'avis officiel BOAMP (même logique que la page /appels-offres/).
function noticeUrl(r: Record<string, unknown>): string {
  const id = pick(r, 'idweb', 'id_web', 'id', 'identifiant', 'id_avis', 'nodeboamp');
  if (id) return 'https://www.boamp.fr/avis/detail/' + encodeURIComponent(id);
  const url = pick(r, 'url_avis', 'url', 'lien');
  return url || 'https://www.boamp.fr/pages/recherche/';
}

// Date de parution (ISO ou brute) d'un enregistrement.
function parutionOf(r: Record<string, unknown>): string {
  return pick(r, 'dateparution', 'date_parution', 'datepublication');
}

// Interroge le BOAMP pour une alerte donnée (avis récents d'abord).
async function fetchBoamp(motsCles: string): Promise<Record<string, unknown>[]> {
  const term = (motsCles || 'travaux').replace(/"/g, '').trim() || 'travaux';
  const params = new URLSearchParams();
  params.set('limit', '30');
  params.set('offset', '0');
  params.set('order_by', 'dateparution desc');
  params.set('where', 'search("' + term + '")');
  const res = await fetch(BOAMP_API + '?' + params.toString(), {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error('BOAMP HTTP ' + res.status);
  const data = await res.json();
  if (data && Array.isArray(data.results)) return data.results;
  if (data && Array.isArray(data.records)) {
    return data.records.map((x: Record<string, unknown>) =>
      (x.fields as Record<string, unknown>) || x);
  }
  return [];
}

// Ne garde que les avis nouveaux (parus après « since ») et, si un département
// est demandé, ceux qui le mentionnent.
function filterNew(
  rows: Record<string, unknown>[],
  since: string | null,
  departement: string | null,
): Record<string, unknown>[] {
  const sinceT = since ? Date.parse(since) : NaN;
  const dep = (departement || '').trim();
  return rows.filter((r) => {
    // Fraîcheur : parution strictement après la dernière exécution.
    if (!isNaN(sinceT)) {
      const p = Date.parse(parutionOf(r));
      if (!isNaN(p) && p <= sinceT) return false;
    }
    // Département : présent quelque part dans les champs pertinents.
    if (dep) {
      const hay = [
        pick(r, 'code_departement', 'departement', 'dept', 'lieu_execution_code'),
        pick(r, 'ville', 'commune', 'lieu_execution'),
        pick(r, 'code_postal'),
      ].join(' ');
      if (hay.indexOf(dep) === -1) return false;
    }
    return true;
  });
}

// Construit le corps HTML de l'email récapitulatif.
function buildEmail(alerte: Alerte, rows: Record<string, unknown>[]): string {
  const items = rows.slice(0, 10).map((r) => {
    const objet = pick(r, 'objet', 'libelle_objet', 'intitule', 'titre', 'title') ||
      'Avis de marché — Travaux';
    const acheteur = pick(r, 'nomacheteur', 'nom_acheteur', 'acheteur', 'organisme');
    const dept = pick(r, 'code_departement', 'departement', 'dept');
    const dlr = pick(r, 'datelimitereponse', 'date_limite_reponse', 'date_limite');
    const bits: string[] = [];
    if (acheteur) bits.push('🏢 ' + esc(acheteur));
    if (dept) bits.push('📍 Dép. ' + esc(dept));
    if (dlr) bits.push('⏱️ Limite : ' + esc(dlr));
    return (
      '<li style="margin:0 0 14px;padding:0 0 14px;border-bottom:1px solid #eee">' +
      '<a href="' + noticeUrl(r) + '" style="color:#b26a00;font-weight:700;text-decoration:none">' +
      esc(objet) + '</a>' +
      (bits.length ? '<div style="color:#666;font-size:13px;margin-top:4px">' + bits.join(' · ') + '</div>' : '') +
      '</li>'
    );
  }).join('');

  const critere = [
    alerte.mots_cles ? 'mots-clés « ' + esc(alerte.mots_cles) + ' »' : 'travaux',
    alerte.departement ? 'département ' + esc(alerte.departement) : '',
  ].filter(Boolean).join(', ');

  return (
    '<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">' +
    '<h2 style="font-size:19px">🔔 Nouveaux appels d\'offres — BâtiLink</h2>' +
    '<p style="color:#444;font-size:14px">Votre alerte (' + critere + ') a trouvé ' +
    '<b>' + rows.length + '</b> nouvel(s) avis depuis la dernière fois :</p>' +
    '<ul style="list-style:none;padding:0;margin:18px 0">' + items + '</ul>' +
    '<p style="font-size:13px"><a href="' + SITE_URL + '/appels-offres/" ' +
    'style="color:#b26a00;font-weight:700">Voir tous les appels d\'offres sur BâtiLink →</a></p>' +
    '<hr style="border:none;border-top:1px solid #eee;margin:24px 0">' +
    '<p style="color:#999;font-size:12px">Vous recevez cet email car vous avez créé une alerte ' +
    'appels d\'offres sur BâtiLink. Gérez ou supprimez vos alertes depuis la page ' +
    '<a href="' + SITE_URL + '/appels-offres/" style="color:#999">Appels d\'offres</a>. ' +
    'Source : BOAMP (open data).</p>' +
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
    alertes: 0,
    emails_envoyes: 0,
    avec_nouveaux: 0,
    erreurs: 0,
    resend_configure: !!RESEND_API_KEY,
  };

  try {
    // Toutes les alertes actives (service_role → contourne la RLS).
    const { data: alertes, error } = await admin
      .from('alertes_ao')
      .select('*')
      .eq('actif', true);

    if (error) {
      console.error('Lecture alertes_ao:', error.message);
      return new Response(JSON.stringify({ error: 'Lecture des alertes impossible.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const list = (alertes || []) as Alerte[];
    summary.alertes = list.length;

    for (const alerte of list) {
      try {
        const rows = await fetchBoamp(alerte.mots_cles || 'travaux');
        const fresh = filterNew(rows, alerte.derniere_execution, alerte.departement);

        if (fresh.length > 0) {
          summary.avec_nouveaux++;
          // Récupère l'email de l'utilisateur via l'API admin d'auth.
          let email = '';
          try {
            const { data: u } = await admin.auth.admin.getUserById(alerte.owner);
            email = (u && u.user && u.user.email) || '';
          } catch (_e) { /* utilisateur introuvable : on saute l'envoi */ }

          if (email) {
            const subject = '🔔 ' + fresh.length + ' nouvel(s) appel(s) d\'offres — BâtiLink';
            const sent = await sendEmail(email, subject, buildEmail(alerte, fresh));
            if (sent) summary.emails_envoyes++;
          }
        }

        // Cale la fenêtre de la prochaine exécution, même sans nouvel avis.
        await admin
          .from('alertes_ao')
          .update({ derniere_execution: new Date().toISOString() })
          .eq('id', alerte.id);
      } catch (err) {
        summary.erreurs++;
        console.error('Alerte', alerte.id, ':', (err as Error).message);
        // On continue : une alerte en échec ne bloque pas les autres.
      }
    }
  } catch (err) {
    console.error('alertes-notify:', err);
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
