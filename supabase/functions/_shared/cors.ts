// ---------------------------------------------------------------------------
// BâtiLink — En-têtes CORS partagés par les fonctions appelées depuis le
// navigateur (create-checkout, customer-portal).
//
// Le site étant statique (GitHub Pages), l'appel part d'une origine différente
// de *.functions.supabase.co : il faut donc autoriser explicitement l'origine
// et répondre au preflight OPTIONS.
//
// On lit SITE_URL pour autoriser précisément l'origine du site en production ;
// on autorise aussi les origines de développement local. À défaut, on retombe
// sur « * » pour ne jamais bloquer le site (dégradation gracieuse).
// ---------------------------------------------------------------------------

const SITE_URL = (Deno.env.get('SITE_URL') || 'https://send.aemconseil.eu').replace(/\/+$/, '');

// Origines explicitement autorisées (production + dev local courant).
const ALLOWED = [
  SITE_URL,
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5500',
];

// Renvoie les en-têtes CORS adaptés à l'origine de la requête.
export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') || '';
  const allowOrigin = ALLOWED.indexOf(origin) !== -1 ? origin : SITE_URL;
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

// Réponse standard au preflight OPTIONS.
export function handleOptions(req: Request): Response {
  return new Response('ok', { status: 200, headers: corsHeaders(req) });
}
